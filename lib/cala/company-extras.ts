import "server-only";
import type { Source, Sourced } from "@/lib/types";
import {
  introspectEntity,
  retrieveEntity,
  toSources,
  type EntityQuery,
  type GetEntityResponse,
  type NumericalObservation,
  type ObservationInfo,
  type RelationshipEdge,
} from "./client";

// Everything else Cala holds about a company beyond the core profile: financials, listing, registry IDs,
// group structure, products, its own investments, countries and ESG. Introspection says which of these
// exist for this company, so the one extra request asks only for those. Both calls are cached for 7 days,
// and the core profile request (shared with every market list) is left untouched.

export type Linked = { id: string; name: string; entityType: string; since: string | null; until: string | null; sources: Source[] };

export type Listing = {
  exchange: string;
  symbol: string | null;
  currency: string | null;
  lastClose: { value: number; time: string } | null;
  sources: Source[];
};

export type MetricPoint = { period: string; value: number; source: Source | null };
export type Metric = { key: MetricKey; label: string; unit: string; points: MetricPoint[] };
type MetricKey = "revenue" | "ebitda" | "operatingCashFlow" | "capex" | "netDebt";

export type CompanyExtras = {
  aliases: string[];
  registry: { label: string; value: string; sources: Source[] }[];
  esg: Sourced<string> | null;
  listings: Listing[];
  indices: Linked[];
  financials: Metric[];
  parents: Linked[];
  subsidiaries: Linked[];
  subsidiaryCountMayBeMore: boolean;
  products: Linked[];
  investments: Linked[];
  countries: Linked[];
};

export const EMPTY_EXTRAS: CompanyExtras = {
  aliases: [],
  registry: [],
  esg: null,
  listings: [],
  indices: [],
  financials: [],
  parents: [],
  subsidiaries: [],
  subsidiaryCountMayBeMore: false,
  products: [],
  investments: [],
  countries: [],
};

const INDEX = /\b(S&P|Nasdaq[- ]?100|Dow Jones|FTSE|Russell \d|STOXX|DAX|CAC 40|OMX|Nikkei|MSCI|Hang Seng|ASX|TSX|IBEX|AEX|SMI|Index)\b/i;

const PROPS = ["aliases", "lei", "cik", "registered_address", "fiscal_year_end", "esg_policy"];

const SUBSIDIARY_LIMIT = 25;
const OUTGOING: Record<string, number> = {
  TRADED_ON: 3,
  LISTED_ON: 3,
  IS_MEMBER_OF: 10,
  IS_SUBSIDIARY_OF: 3,
  IS_DIRECT_PARENT_OF: SUBSIDIARY_LIMIT,
  INVESTED_IN: 25,
  HAS_OPERATIONAL_PRESENCE_IN: 80,
};
const INCOMING: Record<string, number> = {
  IS_SUBSIDIARY_OF: SUBSIDIARY_LIMIT,
  CREATED_BY: 15,
};

/**
 * Metrics shown, in order. Cala's curated set (cleaned from filings) comes first; for companies without it,
 * the raw XBRL concept is the fallback (revenue only, where the names are unambiguous).
 */
const METRICS: { key: MetricKey; label: string; curated: string; cadence: string; fallback?: string[] }[] = [
  { key: "revenue", label: "Revenue", curated: "Revenue", cadence: "annually", fallback: ["Revenues", "Revenue from Contract with Customer, Excluding Assessed Tax"] },
  { key: "ebitda", label: "EBITDA", curated: "EBITDA", cadence: "annually" },
  { key: "operatingCashFlow", label: "Operating cash flow", curated: "Cash flows from (used in) operating activities", cadence: "annually" },
  { key: "capex", label: "Capex", curated: "CAPEX", cadence: "annually" },
  { key: "netDebt", label: "Net debt", curated: "Net debt", cadence: "instantaneous" },
];

export async function fetchCompanyExtras(id: string): Promise<CompanyExtras> {
  const intro = await introspectEntity(id);
  const out = new Set(intro.relationships.outgoing);
  const inc = new Set(intro.relationships.incoming);
  const has = new Set(intro.properties);

  const query: EntityQuery = {
    properties: PROPS.filter((p) => has.has(p)),
    relationships: {
      outgoing: Object.fromEntries(Object.entries(OUTGOING).filter(([k]) => out.has(k)).map(([k, limit]) => [k, { limit }])),
      incoming: Object.fromEntries(Object.entries(INCOMING).filter(([k]) => inc.has(k)).map(([k, limit]) => [k, { limit }])),
    },
  };
  const picked = pickMetrics(intro.numerical_observations ?? {});
  if (picked.ids.size) {
    query.numerical_observations = {};
    for (const [type, ids] of picked.ids) query.numerical_observations[type] = ids;
  }
  if (!query.properties!.length && !Object.keys(query.relationships!.outgoing!).length && !Object.keys(query.relationships!.incoming!).length && !picked.ids.size) {
    return EMPTY_EXTRAS;
  }

  const e = await retrieveEntity(id, query);
  const o = e.relationships.outgoing;
  const i = e.relationships.incoming;

  const subsidiaries = uniqueByName([...(i.IS_SUBSIDIARY_OF ?? []), ...(o.IS_DIRECT_PARENT_OF ?? [])].map(link)).filter((s) => s.id !== id);
  return {
    aliases: aliases(e),
    registry: registry(e),
    esg: text(e, "esg_policy"),
    listings: listings(o.TRADED_ON ?? [], o.LISTED_ON ?? []),
    // IS_MEMBER_OF also covers loyalty programmes and partner groups; keep stock indices only.
    indices: uniqueByName((o.IS_MEMBER_OF ?? []).filter((r) => r.entity_type === "Group" && INDEX.test(r.name)).map(link)),
    financials: financials(e.numerical_observations ?? [], picked.byId),
    parents: uniqueByName((o.IS_SUBSIDIARY_OF ?? []).map(link)),
    subsidiaries,
    subsidiaryCountMayBeMore: (i.IS_SUBSIDIARY_OF?.length ?? 0) >= SUBSIDIARY_LIMIT || (o.IS_DIRECT_PARENT_OF?.length ?? 0) >= SUBSIDIARY_LIMIT,
    // Cala files some websites and topics as products; keep names that read as products.
    products: uniqueByName((i.CREATED_BY ?? []).filter((r) => r.entity_type === "Product" && !/^https?:\/\//i.test(r.name)).map(link)),
    investments: uniqueByName((o.INVESTED_IN ?? []).map(link)),
    // Current presence only: an end date means the company left that country.
    countries: uniqueByName((o.HAS_OPERATIONAL_PRESENCE_IN ?? []).map(link).filter((c) => !c.until)).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function pickMetrics(available: Record<string, ObservationInfo[]>) {
  const ids = new Map<string, string[]>();
  const byId = new Map<string, MetricKey>();
  const add = (type: string, m: ObservationInfo, key: MetricKey) => {
    ids.set(type, [...(ids.get(type) ?? []), m.id]);
    byId.set(m.id, key);
  };
  for (const spec of METRICS) {
    const curated = (available.CuratedFinancialMetric ?? []).find((m) => m.name === spec.curated && m.cadence === spec.cadence);
    if (curated) {
      add("CuratedFinancialMetric", curated, spec.key);
      continue;
    }
    for (const name of spec.fallback ?? []) {
      const raw = (available.FinancialMetric ?? []).find((m) => m.name === name && m.cadence === spec.cadence);
      if (raw) {
        add("FinancialMetric", raw, spec.key);
        break;
      }
    }
  }
  return { ids, byId };
}

/** One value per period (the most recently published, so restatements win), newest last, at most 6. */
function financials(obs: NumericalObservation[], byId: Map<string, MetricKey>): Metric[] {
  const result: Metric[] = [];
  for (const spec of METRICS) {
    const series = obs.find((x) => byId.get(x.id) === spec.key);
    if (!series?.data?.length) continue;
    const perPeriod = new Map<string, NumericalObservation["data"][number]>();
    for (const d of series.data) {
      if (typeof d.value !== "number" || !d.time) continue;
      const period = spec.cadence === "annually" ? fiscalYear(d.time) : d.time.slice(0, 10);
      const prev = perPeriod.get(period);
      if (!prev || (d.origin?.published_time ?? "") > (prev.origin?.published_time ?? "")) perPeriod.set(period, d);
    }
    const points = [...perPeriod.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(spec.cadence === "annually" ? -6 : -1)
      .map(([period, d]) => ({ period, value: d.value, source: originSource(d.origin) }));
    if (points.length) result.push({ key: spec.key, label: spec.label, unit: series.properties.unit ?? "USD", points });
  }
  return result;
}

/** A fiscal year ending in early January belongs to the previous calendar year (e.g. 2025-01-03 → FY2024). */
function fiscalYear(time: string) {
  const d = new Date(time);
  const y = d.getUTCFullYear();
  return String(d.getUTCMonth() === 0 && d.getUTCDate() <= 15 ? y - 1 : y);
}

function originSource(o: NumericalObservation["data"][number]["origin"]): Source | null {
  if (!o?.url) return null;
  return {
    name: o.name || o.source || "Filing",
    document: o.url,
    date: (o.published_time ?? "").slice(0, 10),
    date_precision: "day",
    source_rank: o.source === "SEC" ? "FILING" : null,
  };
}

function listings(traded: RelationshipEdge[], listed: RelationshipEdge[]): Listing[] {
  const byExchange = new Map<string, Listing>();
  for (const r of [...traded, ...listed]) {
    const prev = byExchange.get(r.name);
    const symbol = typeof r.properties.symbol === "string" ? r.properties.symbol : null;
    const currency = typeof r.properties.trading_currency === "string" ? r.properties.trading_currency : null;
    const lastClose = lastPoint(r.properties.close_1h);
    const sources = toSources(r.properties.sources);
    if (!prev) byExchange.set(r.name, { exchange: r.name, symbol, currency, lastClose, sources });
    else {
      prev.symbol ??= symbol;
      prev.currency ??= currency;
      prev.lastClose ??= lastClose;
      prev.sources = dedupeSources([...prev.sources, ...sources]);
    }
  }
  return [...byExchange.values()];
}

function lastPoint(v: unknown): { value: number; time: string } | null {
  if (!Array.isArray(v)) return null;
  const pts = v.filter((p): p is { time: string; value: number } => typeof p?.time === "string" && typeof p?.value === "number");
  if (!pts.length) return null;
  return pts.reduce((a, b) => (b.time > a.time ? b : a));
}

function registry(e: GetEntityResponse): CompanyExtras["registry"] {
  const rows: CompanyExtras["registry"] = [];
  const add = (label: string, key: string, format: (v: string) => string = (v) => v) => {
    const p = text(e, key);
    if (p) rows.push({ label, value: format(p.value), sources: p.sources });
  };
  add("Registered address", "registered_address");
  add("LEI", "lei");
  add("SEC CIK", "cik", (v) => v.replace(/^0+/, ""));
  add("Fiscal year ends", "fiscal_year_end", fiscalYearEnd);
  return rows;
}

/** "--12-31" → "31 Dec". */
function fiscalYearEnd(v: string) {
  const m = /^-*(\d{2})-(\d{2})$/.exec(v);
  if (!m) return v;
  const month = new Date(Date.UTC(2000, Number(m[1]) - 1, 1)).toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
  return `${Number(m[2])} ${month}`;
}

function aliases(e: GetEntityResponse): string[] {
  const v = e.properties.aliases?.value;
  if (!Array.isArray(v)) return [];
  const seen = new Set([e.name.toLowerCase()]);
  return v.filter((a): a is string => typeof a === "string").filter((a) => {
    const k = a.toLowerCase().replace(/[.,]/g, "").trim();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function text(e: GetEntityResponse, key: string): Sourced<string> | null {
  const p = e.properties[key];
  if (!p || typeof p.value !== "string" || !p.value.trim()) return null;
  return { value: p.value.trim(), sources: toSources(p.sources) };
}

function link(r: RelationshipEdge): Linked {
  return {
    id: r.id,
    name: r.name,
    entityType: r.entity_type,
    since: typeof r.properties.valid_since === "string" ? r.properties.valid_since.slice(0, 10) : null,
    until: typeof r.properties.valid_until === "string" ? r.properties.valid_until.slice(0, 10) : null,
    sources: toSources(r.properties.sources),
  };
}

/** Cala sometimes holds one name as several entities; show it once, with all their sources. */
function uniqueByName(list: Linked[]): Linked[] {
  const byName = new Map<string, Linked>();
  for (const l of list) {
    const k = l.name.toLowerCase();
    const prev = byName.get(k);
    if (!prev) byName.set(k, { ...l });
    else {
      prev.sources = dedupeSources([...prev.sources, ...l.sources]);
      if (!l.until) prev.until = null;
    }
  }
  return [...byName.values()];
}

function dedupeSources(list: Source[]) {
  return list.filter((s, i, a) => a.findIndex((x) => x.document === s.document && x.name === s.name) === i);
}
