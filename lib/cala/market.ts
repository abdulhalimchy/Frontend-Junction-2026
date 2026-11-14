import "server-only";
import { normaliseName } from "@/lib/names";
import type { FundingRound, FuzzyDate, MarketCompany, MarketData, MarketQuery, Sourced } from "@/lib/types";
import {
  assertCalaKey,
  knowledgeQuery,
  mapLimit,
  retrieveEntity,
  searchEntities,
  toSources,
  type CalaProp,
  type GetEntityResponse,
  type QueryResponse,
  type RelationshipEdge,
} from "./client";

// Market data from Cala, in three steps:
// 1. knowledge_query finds candidate companies whose descriptions match the sector (rows have no sources,
//    so they are only used to pick entity IDs, never shown as facts).
// 2. entity retrieval loads each company's sourced properties, funding-round edges and investors.
// 3. entity retrieval loads each round's sourced instrument, amount, currency and date.

const EUROPE = [
  "Finland", "Sweden", "Norway", "Denmark", "Iceland", "Estonia", "Latvia", "Lithuania", "Germany", "Austria", "Switzerland",
  "Netherlands", "Belgium", "Luxembourg", "United Kingdom", "Ireland", "France", "Spain", "Portugal", "Italy", "Poland",
  "Czechia", "Slovakia", "Hungary", "Romania", "Bulgaria", "Greece", "Croatia", "Slovenia",
];

/** Regions for the picker. An empty country list means anywhere: no location filter at all. */
export const REGIONS: Record<string, { label: string; countries: string[] }> = {
  anywhere: { label: "Anywhere", countries: [] },
  europe: { label: "Europe", countries: EUROPE },
  nordics: { label: "Nordics", countries: ["Finland", "Sweden", "Norway", "Denmark", "Iceland"] },
  finland: { label: "Finland", countries: ["Finland"] },
  baltics: { label: "Baltics", countries: ["Estonia", "Latvia", "Lithuania"] },
  dach: { label: "DACH", countries: ["Germany", "Austria", "Switzerland"] },
  benelux: { label: "Benelux", countries: ["Netherlands", "Belgium", "Luxembourg"] },
  uki: { label: "UK & Ireland", countries: ["United Kingdom", "Ireland"] },
  us: { label: "United States", countries: ["United States"] },
};

// ISO codes used to read the "…, DK" suffix on Cala addresses.
const ISO: Record<string, string> = {
  FI: "Finland", SE: "Sweden", NO: "Norway", DK: "Denmark", IS: "Iceland", EE: "Estonia", LV: "Latvia", LT: "Lithuania",
  DE: "Germany", AT: "Austria", CH: "Switzerland", NL: "Netherlands", BE: "Belgium", LU: "Luxembourg",
  GB: "United Kingdom", UK: "United Kingdom", IE: "Ireland", FR: "France", ES: "Spain", PT: "Portugal", IT: "Italy",
  PL: "Poland", CZ: "Czechia", SK: "Slovakia", HU: "Hungary", RO: "Romania", BG: "Bulgaria", GR: "Greece", HR: "Croatia",
  SI: "Slovenia", US: "United States", USA: "United States", CA: "Canada", JP: "Japan", CN: "China", IN: "India",
  KR: "South Korea", SG: "Singapore", IL: "Israel", AU: "Australia", BR: "Brazil",
};
const COUNTRY_TYPES = new Set(["Country", "DependentTerritory"]);

export { normaliseName };

const MAX_COMPANIES = 12;
const MAX_ROUNDS_PER_COMPANY = 12;
// Corporate events mix funding with results updates, board changes, M&A… in no date order, so read
// more of them and keep only the financings.
const MAX_CORPORATE_EVENTS = 50;
const MAX_FINANCING_EVENTS = 10;
const CONCURRENCY = 4;
const COMPANY_TYPES = new Set(["Company", "Organization"]);

/** "  Mobile   Applications " → "mobile applications": one cache entry per market however it is typed. */
export function normaliseSector(text: string) {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

export function regionOf(key: string) {
  return REGIONS[key] ?? REGIONS.nordics;
}

export function marketDefinition(q: MarketQuery) {
  const countries = regionOf(q.region).countries;
  const many = countries.length > 6;
  if (q.since) {
    // Recency filters in dot-notation (e.g. last_funding_date>=…) return nothing, while a plain question
    // with a year steers Cala to recently funded companies instead of the best-known names.
    const where = !countries.length ? "" : many ? " in Europe" : ` in ${countries.join(", ")}`;
    return `${q.sector} startups${where} that raised a funding round in ${q.since} or later`;
  }
  // Dot-notation as documented at docs.cala.ai: filter on description and location, project identity fields.
  const location = !countries.length ? "" : many ? ".location=Europe" : `.location=${countries.join(" OR ")}`;
  return `startups.description=${q.sector}${location}.return(name, country, founded_year)`;
}

/** Rows name the company under different keys depending on the question ("name", "company", "startup", …). */
function rowName(r: Record<string, unknown>) {
  for (const k of ["name", "company", "startup", "company_name", "organization"]) {
    if (typeof r[k] === "string" && r[k]) return (r[k] as string).trim();
  }
  const first = Object.values(r).find((v) => typeof v === "string" && v.trim());
  return typeof first === "string" ? first.trim() : "";
}

export async function fetchMarket(input: MarketQuery): Promise<MarketData> {
  assertCalaKey();
  const q = { ...input, sector: normaliseSector(input.sector) };
  const definition = marketDefinition(q);
  const res = await knowledgeQuery(definition);
  const { companies, outsideRegion } = await loadCandidates(res, q.region);
  return { query: q, definition, companies, outsideRegion };
}

/**
 * Turns a knowledge_query response into sourced companies. Rows are only used to pick entity IDs;
 * every value comes from entity retrieval. Companies whose location on record is outside the region are
 * returned separately so the page can list them.
 */
export async function loadCandidates(res: QueryResponse, regionKey: string, excludeIds: string[] = []) {
  const rows = [...new Set(res.results.map(rowName).filter(Boolean))];
  const seen = new Set<string>(excludeIds);
  const ids: string[] = [];
  let unresolved = 0;

  // 1. Entities Cala already linked to a row. 2. For rows it did not link, resolve the name with
  // entity_search and accept only an exact name match, so a fuzzy hit never stands in for another company.
  const linked = (res.entities ?? []).filter((e) => COMPANY_TYPES.has(e.entity_type));
  const resolved = await mapLimit(rows.slice(0, MAX_COMPANIES), CONCURRENCY, async (row) => {
    const key = normaliseName(row);
    const hit = linked.find((e) => [e.name, ...(e.mentions ?? [])].some((n) => normaliseName(n) === key));
    if (hit) return hit.id;
    const found = await searchEntities(row.replace(/\([^)]*\)/g, "").trim().slice(0, 100), ["Company", "Organization"], 5);
    return found.entities.find((e) => normaliseName(e.name) === key)?.id ?? null;
  });
  for (const id of resolved) {
    if (!id) unresolved++;
    else if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }

  const fetched = await mapLimit(ids, CONCURRENCY, (id) => fetchMarketCompany(id));
  await enrichInvestors(fetched.map((f) => f.company));

  // Cala's query does not strictly enforce location. Drop companies whose location on record is outside
  // the region; keep those with no location on record.
  const region = new Set(regionOf(regionKey).countries);
  const companies: MarketCompany[] = [];
  const outsideRegion: MarketData["outsideRegion"] = [];
  for (const { company, countries } of fetched) {
    if (!region.size || !countries.length || countries.some((c) => region.has(c))) companies.push(company);
    else outsideRegion.push({ name: company.name, country: countries[0] });
  }
  return { companies, outsideRegion, unresolved };
}

const MAX_INVESTORS_ENRICHED = 25;

/**
 * Adds each investor's Cala aliases and website (one cached lookup per investor), so the same firm recorded
 * as several entities ("a16z", "Andreessen Horowitz", "INDEX VENTURES (UK) LLP" / "Index Ventures Limited")
 * can be merged. A failed lookup just leaves that investor to be matched by name.
 */
export async function enrichInvestors(companies: MarketCompany[]) {
  const ids = [...new Set(companies.flatMap((c) => c.investors.map((i) => i.id)))].slice(0, MAX_INVESTORS_ENRICHED);
  const info = new Map<string, { aliases: string[]; website: string | null }>();
  await mapLimit(ids, CONCURRENCY, async (id) => {
    try {
      const e = await retrieveEntity(id, { properties: ["aliases", "website"] });
      const aliases = prop(e, "aliases")?.value;
      const website = prop(e, "website")?.value;
      info.set(id, {
        aliases: Array.isArray(aliases) ? aliases.filter((a): a is string => typeof a === "string") : [],
        website: typeof website === "string" ? website : null,
      });
    } catch {
      // Name matching still applies.
    }
  });
  for (const c of companies) for (const i of c.investors) Object.assign(i, info.get(i.id) ?? {});
}

/**
 * Countries on record for a company: headquarters first (HAS_HEADQUARTERS_IN country, then the ISO suffix of
 * the HQ address), registration only when there is no HQ information.
 */
export function companyCountries(e: GetEntityResponse): string[] {
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

/** Relationships every company view needs: rounds (both models), location, investors. */
/**
 * One request shape for every company view (market rows, players, competitors, company analysis), so each
 * company costs one cached Cala call however many pages show it.
 */
export const COMPANY_RELATIONSHIPS = {
  outgoing: {
    PARTICIPATES_IN_FUNDING_ROUND: { limit: MAX_ROUNDS_PER_COMPANY },
    PARTICIPATES_IN_CORPORATE_EVENT: { limit: MAX_CORPORATE_EVENTS },
    HAS_HEADQUARTERS_IN: { limit: 3 },
    IS_REGISTERED_IN: { limit: 3 },
    OPERATES_IN_INDUSTRY: { limit: 5 },
  },
  incoming: { INVESTED_IN: { limit: 25 } },
};
export const COMPANY_PROPS = [
  "name", "description", "founding_date", "founding_date__precision", "headquarters_address",
  "legal_name", "website", "employee_count_range", "operational_status", "company_ownership_status", "funding_stage",
  "total_funding", "total_funding_units", "total_funding_excluding_debt", "total_funding_excluding_debt_units",
];

async function fetchMarketCompany(id: string): Promise<{ company: MarketCompany; countries: string[] }> {
  const e = await retrieveEntity(id, { properties: COMPANY_PROPS, relationships: COMPANY_RELATIONSHIPS });
  return { company: await toMarketCompany(e), countries: companyCountries(e) };
}

/** Builds a sourced MarketCompany from a retrieved company entity, loading each of its rounds. */
export async function toMarketCompany(e: GetEntityResponse): Promise<MarketCompany> {
  // Cala models funding as FundingRound entities (PARTICIPATES_IN_FUNDING_ROUND) and as financing events
  // (PARTICIPATES_IN_CORPORATE_EVENT): PrivateCompanyFundingRound, or a CorporateEvent named
  // FINANCING_RAISED_OR_FACILITY_ENTERED from filings such as SEC Form D. Read all of them, keeping only
  // rounds where this company raised money (role ISSUER).
  const out = e.relationships.outgoing;
  const issuer = (r: RelationshipEdge) => (r.properties.role ?? "ISSUER") === "ISSUER";
  // Each round is one more Cala call, so financing events are capped to the most recent few; the edge
  // already carries event_date, so this costs nothing to decide.
  const events = (out.PARTICIPATES_IN_CORPORATE_EVENT ?? [])
    .filter((r) => issuer(r) && (ROUND_TYPES.has(r.entity_type) || r.name === FINANCING_EVENT))
    .sort((a, b) => String(b.properties.event_date ?? "").localeCompare(String(a.properties.event_date ?? "")))
    .slice(0, MAX_FINANCING_EVENTS);
  const roundEdges = [...(out.PARTICIPATES_IN_FUNDING_ROUND ?? []).filter(issuer), ...events];

  const rounds = dedupeRounds(
    (await mapLimit(roundEdges, CONCURRENCY, (r) => fetchRound(r.id, r.name))).filter((r): r is FundingRound => r !== null),
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

const ROUND_TYPES = new Set(["FundingRound", "PrivateCompanyFundingRound"]);
const FINANCING_EVENT = "FINANCING_RAISED_OR_FACILITY_ENTERED";
/** Label for financing filings with no round type: we cannot tell equity from debt, so they are never counted. */
export const FILING_LABEL = "Financing (filing)";
export const ROUND_PROPS = [
  "round_label", "round_type", "instrument", "transaction_value", "transaction_value_units",
  "announcement_date", "announcement_date__precision", "event_date", "event_date__precision",
];

async function fetchRound(id: string, fallbackName: string): Promise<FundingRound | null> {
  return parseRound(await retrieveEntity(id, { properties: ROUND_PROPS }), fallbackName);
}

/** Builds a FundingRound from a retrieved round entity (FundingRound, PrivateCompanyFundingRound or a filing). */
export function parseRound(r: GetEntityResponse, fallbackName: string): FundingRound {
  const instrument = String(prop(r, "instrument")?.value ?? "").toUpperCase();
  const value = prop(r, "transaction_value");
  const units = prop(r, "transaction_value_units");
  const date = fuzzyDate(r, "announcement_date") ?? fuzzyDate(r, "event_date");
  // FundingRound uses round_label ("SERIES_A"); PrivateCompanyFundingRound uses round_type ("Series A").
  const label = prop(r, "round_label")?.value;
  const type = prop(r, "round_type")?.value;
  const stage =
    typeof label === "string" ? labelise(label) : typeof type === "string" ? type : fallbackName === FINANCING_EVENT ? FILING_LABEL : fallbackName;

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
 * One financing can be recorded several times: as a FundingRound (announcements) and as a financing event
 * (filings). Per Cala's guide, match them by date and amount: same amount, currency and month count as one
 * round. A classified round wins over an unclassified filing; sources are merged.
 */
function dedupeRounds(rounds: FundingRound[]): FundingRound[] {
  const isFiling = (r: FundingRound) => r.stage === FILING_LABEL;
  // Classified rounds first, so filings merge into them rather than the other way round.
  const ordered = [...rounds].sort((a, b) => Number(isFiling(a)) - Number(isFiling(b)));
  const out: FundingRound[] = [];
  for (const r of ordered) {
    const twin = r.amount
      ? out.find(
          (o) =>
            (o.kind === r.kind || isFiling(r)) &&
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

export function prop(e: GetEntityResponse, key: string): CalaProp<unknown> | undefined {
  return e.properties[key];
}

export function sourced<T>(e: GetEntityResponse, key: string): Sourced<T> | null {
  const p = prop(e, key);
  if (!p || p.value === null || p.value === undefined || p.value === "") return null;
  return { value: p.value as T, sources: toSources(p.sources) };
}

const PRECISION_ORDER = ["year", "month", "day"] as const;
type Precision = (typeof PRECISION_ORDER)[number];

/**
 * Reads a date property at the precision Cala actually has. Starts from the value's own shape
 * ("2024", "2024-08", "2024-08-20") and coarsens it when Cala says so: a `<key>__precision` property,
 * or a source dated the same day as the value that states month or year precision
 * (e.g. founding_date 2019-01-01 with year precision means "2019").
 */
export function fuzzyDate(e: GetEntityResponse, key: string): Sourced<FuzzyDate> | null {
  const s = sourced<string>(e, key);
  if (!s || typeof s.value !== "string") return null;
  const v = s.value.slice(0, 10);
  let precision: Precision | null = /^\d{4}-\d{2}-\d{2}$/.test(v) ? "day" : /^\d{4}-\d{2}$/.test(v) ? "month" : /^\d{4}$/.test(v) ? "year" : null;
  if (!precision) return null;

  const stated = [
    prop(e, `${key}__precision`)?.value,
    ...s.sources.filter((src) => src.date.slice(0, 10) === v).map((src) => src.date_precision),
  ].map((p) => (typeof p === "string" ? p.toLowerCase() : null));
  for (const p of stated) {
    if (p && PRECISION_ORDER.includes(p as Precision) && PRECISION_ORDER.indexOf(p as Precision) < PRECISION_ORDER.indexOf(precision)) {
      precision = p as Precision;
    }
  }
  const len = precision === "year" ? 4 : precision === "month" ? 7 : 10;
  return { value: { date: v.slice(0, len), precision }, sources: s.sources };
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
