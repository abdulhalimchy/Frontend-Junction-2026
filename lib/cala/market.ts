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

// ISO codes for region countries, used to read the "…, DK" suffix on Cala addresses.
const ISO: Record<string, string> = {
  FI: "Finland", SE: "Sweden", NO: "Norway", DK: "Denmark", IS: "Iceland", EE: "Estonia", LV: "Latvia", LT: "Lithuania",
  DE: "Germany", AT: "Austria", CH: "Switzerland", NL: "Netherlands", BE: "Belgium", LU: "Luxembourg",
  GB: "United Kingdom", US: "United States", FR: "France", ES: "Spain", IT: "Italy", PL: "Poland", IE: "Ireland",
};
const COUNTRY_TYPES = new Set(["Country", "DependentTerritory"]);

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

  const fetched = await mapLimit(candidates.slice(0, MAX_COMPANIES), CONCURRENCY, (e) => fetchMarketCompany(e.id));

  // Cala's query does not strictly enforce location. Drop companies whose location on record is outside
  // the region; keep those with no location on record. Dropped ones are listed on the page.
  const region = new Set((REGIONS[q.region] ?? REGIONS.nordics).countries);
  const companies: MarketCompany[] = [];
  const outsideRegion: MarketData["outsideRegion"] = [];
  for (const { company, countries } of fetched) {
    if (!countries.length || countries.some((c) => region.has(c))) companies.push(company);
    else outsideRegion.push({ name: company.name, country: countries[0] });
  }
  return { query: q, definition, companies, outsideRegion };
}

/**
 * Countries on record for a company: headquarters first (HAS_HEADQUARTERS_IN country, then the ISO suffix of
 * the HQ address), registration only when there is no HQ information.
 */
function companyCountries(e: GetEntityResponse): string[] {
  const out = e.relationships.outgoing;
  const names = (key: string) => (out[key] ?? []).filter((r) => COUNTRY_TYPES.has(r.entity_type)).map((r) => r.name);
  const hq = names("HAS_HEADQUARTERS_IN");
  const address = prop(e, "headquarters_address")?.value;
  if (typeof address === "string") {
    const tail = address.split(",").pop()?.trim() ?? "";
    const fromAddress = ISO[tail] ?? Object.values(ISO).find((c) => tail === c);
    if (fromAddress) hq.push(fromAddress);
  }
  return hq.length ? [...new Set(hq)] : names("IS_REGISTERED_IN");
}

async function fetchMarketCompany(id: string): Promise<{ company: MarketCompany; countries: string[] }> {
  const e = await retrieveEntity(id, {
    properties: ["name", "description", "founding_date", "headquarters_address"],
    relationships: {
      outgoing: {
        PARTICIPATES_IN_FUNDING_ROUND: { limit: MAX_ROUNDS_PER_COMPANY },
        PARTICIPATES_IN_CORPORATE_EVENT: { limit: MAX_ROUNDS_PER_COMPANY },
        HAS_HEADQUARTERS_IN: { limit: 3 },
        IS_REGISTERED_IN: { limit: 3 },
      },
      incoming: { INVESTED_IN: { limit: 25 } },
    },
  });

  // Cala models funding two ways: FundingRound entities (PARTICIPATES_IN_FUNDING_ROUND) and
  // PrivateCompanyFundingRound corporate events (PARTICIPATES_IN_CORPORATE_EVENT). Read both,
  // keeping only rounds where this company raised money (role ISSUER).
  const out = e.relationships.outgoing;
  const roundEdges = [
    ...(out.PARTICIPATES_IN_FUNDING_ROUND ?? []),
    ...(out.PARTICIPATES_IN_CORPORATE_EVENT ?? []).filter((r) => ROUND_TYPES.has(r.entity_type)),
  ].filter((r) => (r.properties.role ?? "ISSUER") === "ISSUER");

  const rounds = dedupeRounds(
    (await mapLimit(roundEdges, CONCURRENCY, (r) => fetchRound(r.id, r.name))).filter((r): r is FundingRound => r !== null),
  );

  const company: MarketCompany = {
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
  return { company, countries: companyCountries(e) };
}

const ROUND_TYPES = new Set(["FundingRound", "PrivateCompanyFundingRound"]);
const ROUND_PROPS = [
  "round_label", "round_type", "instrument", "transaction_value", "transaction_value_units", "announcement_date", "event_date",
];

async function fetchRound(id: string, fallbackName: string): Promise<FundingRound | null> {
  const r = await retrieveEntity(id, { properties: ROUND_PROPS });
  const instrument = String(prop(r, "instrument")?.value ?? "").toUpperCase();
  const value = prop(r, "transaction_value");
  const units = prop(r, "transaction_value_units");
  const date = fuzzyDate(r, "announcement_date") ?? fuzzyDate(r, "event_date");
  // FundingRound uses round_label ("SERIES_A"); PrivateCompanyFundingRound uses round_type ("Series A").
  const label = prop(r, "round_label")?.value;
  const type = prop(r, "round_type")?.value;
  const stage = typeof label === "string" ? labelise(label) : typeof type === "string" ? type : fallbackName;

  // Every source that backs this round, deduplicated by document.
  const all = ROUND_PROPS.flatMap((k) => toSources(prop(r, k)?.sources)).filter(
    (s, i, arr) => arr.findIndex((x) => x.document === s.document && x.name === s.name) === i,
  );

  return {
    id: r.id,
    kind: classify(instrument, stage),
    stage,
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

/** Uses the explicit instrument when Cala has one, otherwise the round name. Anything unclear is "other" (not counted). */
function classify(instrument: string, stage: string): FundingRound["kind"] {
  if (instrument === "EQUITY") return "equity";
  if (instrument === "GRANT") return "grant";
  if (instrument) return "other";
  if (/grant/i.test(stage)) return "grant";
  if (/debt|loan|facility|note|bond|lease/i.test(stage)) return "other";
  if (/seed|series|angel|venture|equity|growth/i.test(stage)) return "equity";
  return "other";
}

/**
 * The same round can exist in both models. Treat two rounds as one when kind, month, amount and currency match,
 * keeping the first (FundingRound edges come first) and merging their sources.
 */
function dedupeRounds(rounds: FundingRound[]): FundingRound[] {
  const out: FundingRound[] = [];
  for (const r of rounds) {
    const twin = r.amount
      ? out.find(
          (o) =>
            o.kind === r.kind &&
            o.amount?.amount === r.amount!.amount &&
            o.amount?.currency === r.amount!.currency &&
            o.date?.date.slice(0, 7) === r.date?.date.slice(0, 7),
        )
      : undefined;
    if (twin) twin.sources = [...twin.sources, ...r.sources.filter((s) => !twin.sources.some((t) => t.document === s.document))];
    else out.push(r);
  }
  return out;
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
