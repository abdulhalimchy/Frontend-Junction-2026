import "server-only";
import type { FundingRound, FuzzyDate, MarketCompany, MarketData, MarketQuery, Sourced } from "@/lib/types";
import { assertCalaKey, knowledgeQuery, mapLimit, retrieveEntity, toSources, type CalaProp, type GetEntityResponse } from "./client";

// Market data from Cala, in three steps:
// 1. knowledge_query finds candidate companies whose descriptions match the sector (rows have no sources,
//    so they are only used to pick entity IDs, never shown as facts).
// 2. entity retrieval loads each company's sourced properties, funding-round edges and investors.
// 3. entity retrieval loads each round's sourced instrument, amount, currency and date.

export const REGIONS: Record<string, { label: string; countries: string[] }> = {
  nordics: { label: "Nordics", countries: ["Finland", "Sweden", "Norway", "Denmark", "Iceland"] },
  finland: { label: "Finland", countries: ["Finland"] },
  baltics: { label: "Baltics", countries: ["Estonia", "Latvia", "Lithuania"] },
  dach: { label: "DACH", countries: ["Germany", "Austria", "Switzerland"] },
  benelux: { label: "Benelux", countries: ["Netherlands", "Belgium", "Luxembourg"] },
};

const MAX_COMPANIES = 12;
const MAX_ROUNDS_PER_COMPANY = 12;
const CONCURRENCY = 4;
const COMPANY_TYPES = new Set(["Company", "Organization"]);

export function marketDefinition(q: MarketQuery) {
  const countries = (REGIONS[q.region] ?? REGIONS.nordics).countries.join(" OR ");
  // Dot-notation as documented at docs.cala.ai: filter on description and location, project identity fields.
  return `startups.description=${q.sector}.location=${countries}.return(name, country, founded_year)`;
}

export async function fetchMarket(q: MarketQuery): Promise<MarketData> {
  assertCalaKey();
  const definition = marketDefinition(q);
  const res = await knowledgeQuery(definition);

  // Keep only company-like entities that correspond to a result row.
  const rowNames = new Set(res.results.map((r) => String(r.name ?? r.company ?? "").toLowerCase()).filter(Boolean));
  const seen = new Set<string>();
  const candidates = (res.entities ?? []).filter((e) => {
    if (!COMPANY_TYPES.has(e.entity_type) || seen.has(e.id)) return false;
    const names = [e.name, ...(e.mentions ?? [])].map((n) => n.toLowerCase());
    if (!names.some((n) => rowNames.has(n))) return false;
    seen.add(e.id);
    return true;
  });

  const companies = await mapLimit(candidates.slice(0, MAX_COMPANIES), CONCURRENCY, (e) => fetchMarketCompany(e.id));
  return { query: q, definition, companies: companies.filter((c): c is MarketCompany => c !== null) };
}

async function fetchMarketCompany(id: string): Promise<MarketCompany | null> {
  const e = await retrieveEntity(id, {
    properties: ["name", "description", "founding_date", "headquarters_address"],
    relationships: {
      outgoing: { PARTICIPATES_IN_FUNDING_ROUND: { limit: MAX_ROUNDS_PER_COMPANY } },
      incoming: { INVESTED_IN: { limit: 25 } },
    },
  });

  // Only rounds where this company raised money (role ISSUER).
  const roundEdges = (e.relationships.outgoing.PARTICIPATES_IN_FUNDING_ROUND ?? []).filter(
    (r) => (r.properties.role ?? "ISSUER") === "ISSUER",
  );
  const rounds = (await mapLimit(roundEdges, CONCURRENCY, (r) => fetchRound(r.id, r.name))).filter(
    (r): r is FundingRound => r !== null,
  );

  return {
    id: e.id,
    name: e.name,
    description: sourced<string>(e, "description"),
    hq: sourced<string>(e, "headquarters_address"),
    founded: fuzzyDate(e, "founding_date"),
    rounds,
    investors: (e.relationships.incoming.INVESTED_IN ?? []).map((i) => ({
      id: i.id,
      name: i.name,
      sources: toSources(i.properties.sources),
    })),
  };
}

async function fetchRound(id: string, fallbackName: string): Promise<FundingRound | null> {
  const r = await retrieveEntity(id, {
    properties: ["round_label", "instrument", "transaction_value", "transaction_value_units", "announcement_date", "event_date"],
  });
  const instrument = String(prop(r, "instrument")?.value ?? "").toUpperCase();
  const value = prop(r, "transaction_value");
  const units = prop(r, "transaction_value_units");
  const date = fuzzyDate(r, "announcement_date") ?? fuzzyDate(r, "event_date");
  const label = prop(r, "round_label")?.value;

  // Every source that backs this round, deduplicated by document.
  const all = ["round_label", "instrument", "transaction_value", "transaction_value_units", "announcement_date", "event_date"]
    .flatMap((k) => toSources(prop(r, k)?.sources))
    .filter((s, i, arr) => arr.findIndex((x) => x.document === s.document && x.name === s.name) === i);

  return {
    id: r.id,
    kind: instrument === "EQUITY" ? "equity" : instrument === "GRANT" ? "grant" : "other",
    stage: typeof label === "string" ? labelise(label) : fallbackName,
    instrument: instrument || null,
    date: date?.value ?? null,
    // An amount without a stated currency is treated as undisclosed rather than guessing the unit.
    amount:
      typeof value?.value === "number" && typeof units?.value === "string"
        ? { amount: value.value, currency: units.value }
        : null,
    leadInvestorIds: [],
    participantIds: [],
    sources: all,
  };
}

// ---- small helpers ----

function prop(e: GetEntityResponse, key: string): CalaProp<unknown> | undefined {
  return e.properties[key];
}

function sourced<T>(e: GetEntityResponse, key: string): Sourced<T> | null {
  const p = prop(e, key);
  if (!p || p.value === null || p.value === undefined || p.value === "") return null;
  return { value: p.value as T, sources: toSources(p.sources) };
}

/** Reads a date property at the precision the value actually has ("2024", "2024-08", "2024-08-20"). */
function fuzzyDate(e: GetEntityResponse, key: string): Sourced<FuzzyDate> | null {
  const s = sourced<string>(e, key);
  if (!s || typeof s.value !== "string") return null;
  const v = s.value.slice(0, 10);
  const precision = /^\d{4}-\d{2}-\d{2}$/.test(v) ? "day" : /^\d{4}-\d{2}$/.test(v) ? "month" : /^\d{4}$/.test(v) ? "year" : null;
  if (!precision) return null;
  return { value: { date: v, precision }, sources: s.sources };
}

/** "SERIES_A" → "Series A", "PRE_SEED" → "Pre-seed", "VENTURE_ROUND" → "Venture round". */
export function labelise(label: string) {
  if (label === "PRE_SEED") return "Pre-seed";
  return label
    .toLowerCase()
    .split("_")
    .map((w, i) => (i === 0 || w.length === 1 ? w.toUpperCase().slice(0, 1) + w.slice(1) : w))
    .join(" ");
}
