import "server-only";
import type { CompanyMatch, CompanyProfile, MarketData, Money, Source, Sourced } from "@/lib/types";
import {
  assertCalaKey,
  knowledgeQuery,
  retrieveEntity,
  searchEntities,
  toSources,
  type GetEntityResponse,
  type RelationshipEdge,
} from "./client";
import {
  COMPANY_PROPS,
  COMPANY_RELATIONSHIPS,
  companyCountries,
  enrichInvestors,
  labelise,
  loadCandidates,
  normaliseName,
  prop,
  regionOf,
  sourced,
  toMarketCompany,
} from "./market";

// Company analysis: one company's sourced profile and funding, plus the market of its competitors.

export { normaliseName };

/**
 * Company names matching the text. `exact` holds only names equal to the text once case and legal
 * suffixes are ignored; Cala's name search is fuzzy and always returns something, so a looser rule
 * would flag every market phrase ("climate tech") as a company.
 */
export async function findCompanies(text: string): Promise<{ exact: CompanyMatch[]; all: CompanyMatch[] }> {
  assertCalaKey();
  const res = await searchEntities(text.slice(0, 100), ["Company", "Organization"], 8);
  const all = res.entities.map((e) => ({ id: e.id, name: e.name, entityType: e.entity_type, description: e.description ?? null }));
  const target = normaliseName(text);
  return { exact: all.filter((m) => normaliseName(m.name) === target), all };
}

export async function fetchCompanyProfile(id: string): Promise<CompanyProfile> {
  assertCalaKey();
  // Same request shape as every other company view, so it shares their cache entry.
  const e = await retrieveEntity(id, { properties: COMPANY_PROPS, relationships: COMPANY_RELATIONSHIPS });
  const base = await toMarketCompany(e);
  await enrichInvestors([base]);
  const stage = sourced<string>(e, "funding_stage");
  const status = sourced<string>(e, "operational_status") ?? sourced<string>(e, "company_ownership_status");

  return {
    ...base,
    legalName: sourced<string>(e, "legal_name"),
    website: sourced<string>(e, "website"),
    employees: employees(e),
    status: status && { value: labelise(String(status.value)), sources: status.sources },
    fundingStage: stage && { value: labelise(String(stage.value)), sources: stage.sources },
    totalFunding: money(e, "total_funding", "total_funding_units"),
    totalFundingExDebt: money(e, "total_funding_excluding_debt", "total_funding_excluding_debt_units"),
    industries: (e.relationships.outgoing.OPERATES_IN_INDUSTRY ?? []).map((i) => ({
      name: labelise(i.name),
      label: typeof i.properties.original_label === "string" ? i.properties.original_label : null,
      sources: toSources(i.properties.sources),
    })),
    countries: companyCountries(e),
    deals: corporateDeals(e),
  };
}

const DEAL_EVENTS: Record<string, string> = {
  MNA_COMPLETED: "Acquisition completed",
  MNA_ANNOUNCED: "Acquisition announced",
  MATERIAL_AGREEMENT_ANNOUNCED: "Agreement announced",
  MATERIAL_AGREEMENT_TERMINATED: "Agreement terminated",
  IPO: "IPO",
};

/** Acquisitions and similar deals from the corporate events already in the company request (no extra call). */
function corporateDeals(e: GetEntityResponse): CompanyProfile["deals"] {
  return (e.relationships.outgoing.PARTICIPATES_IN_CORPORATE_EVENT ?? [])
    .filter((r) => r.entity_type === "CorporateEvent" && DEAL_EVENTS[r.name])
    .map((r) => ({
      id: r.id,
      kind: DEAL_EVENTS[r.name],
      role: typeof r.properties.role === "string" ? labelise(r.properties.role) : null,
      date: typeof r.properties.event_date === "string" ? r.properties.event_date.slice(0, 10) : null,
      sources: toSources(r.properties.sources),
    }))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

export type PersonLink = { id: string; name: string; role: string; since: string | null; until: string | null; sources: Source[] };
export type CompanyPeople = {
  founders: PersonLink[];
  leadership: PersonLink[];
  board: PersonLink[];
  team: PersonLink[];
  events: { id: string; name: string; role: string | null; sources: Source[] }[];
};

const PEOPLE_QUERY = {
  properties: ["name"],
  relationships: {
    incoming: {
      FOUNDED: { limit: 10 },
      IS_CEO_OF: { limit: 5 },
      IS_CTO_OF: { limit: 5 },
      IS_VICEPRESIDENT_OF: { limit: 10 },
      IS_BOARD_MEMBER_OF: { limit: 15 },
      WORKS_AT: { limit: 25 },
    },
    outgoing: { PARTICIPATES_IN_EVENT: { limit: 10 } },
  },
};

/** People and events for a company page: one extra Cala call per company, cached for 7 days. */
export async function fetchCompanyPeople(id: string): Promise<CompanyPeople> {
  assertCalaKey();
  const e = await retrieveEntity(id, PEOPLE_QUERY);
  const inc = e.relationships.incoming;
  const person = (r: RelationshipEdge, role: string): PersonLink => ({
    id: r.id,
    name: r.name,
    role: typeof r.properties.role === "string" && r.properties.role ? r.properties.role : role,
    since: typeof r.properties.valid_since === "string" ? r.properties.valid_since.slice(0, 10) : null,
    until: typeof r.properties.valid_until === "string" ? r.properties.valid_until.slice(0, 10) : null,
    sources: toSources(r.properties.sources),
  });
  const leadership = [
    ...(inc.IS_CEO_OF ?? []).map((r) => person(r, "CEO")),
    ...(inc.IS_CTO_OF ?? []).map((r) => person(r, "CTO")),
    ...(inc.IS_VICEPRESIDENT_OF ?? []).map((r) => person(r, "Vice President")),
  ];
  const shown = new Set(leadership.map((p) => `${p.id}|${p.role}`));
  return {
    founders: (inc.FOUNDED ?? []).map((r) => person(r, "Founder")),
    leadership,
    board: (inc.IS_BOARD_MEMBER_OF ?? []).map((r) => person(r, "Board member")),
    team: (inc.WORKS_AT ?? []).map((r) => person(r, "Team member")).filter((p) => !shown.has(`${p.id}|${p.role}`)),
    events: (e.relationships.outgoing.PARTICIPATES_IN_EVENT ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      role: typeof r.properties.role === "string" ? labelise(r.properties.role) : null,
      sources: toSources(r.properties.sources),
    })),
  };
}

/** Competitors of a company, as a market: same aggregation and rules as a sector market. */
export async function fetchCompetitorMarket(profile: CompanyProfile, regionKey: string): Promise<MarketData & { unresolved: number }> {
  const region = regionOf(regionKey);
  const location = region.countries.length && region.countries.length <= 6 ? `.location=${region.countries.join(" OR ")}` : region.countries.length ? ".location=Europe" : "";
  const definition = `companies.competitors_of=${profile.name}${location}.return(name, country)`;
  const res = await knowledgeQuery(definition);
  const { companies, outsideRegion, unresolved } = await loadCandidates(res, regionKey, [profile.id]);
  // Drop other legal entities of the same company (e.g. national subsidiaries with the same name).
  const self = normaliseName(profile.name);
  const peers = companies.filter((c) => normaliseName(c.name) !== self);
  return { query: { sector: profile.name, region: regionKey }, definition, companies: peers, outsideRegion, unresolved };
}

function money(e: GetEntityResponse, valueKey: string, unitKey: string): Sourced<Money> | null {
  const v = prop(e, valueKey);
  const u = prop(e, unitKey);
  // No currency on record → not shown; we never assume one.
  if (typeof v?.value !== "number" || typeof u?.value !== "string") return null;
  return { value: { amount: v.value, currency: u.value }, sources: toSources(v.sources) };
}

/** employee_count_range is [n] or [min, max]. */
function employees(e: GetEntityResponse): Sourced<string> | null {
  const p = sourced<unknown>(e, "employee_count_range");
  if (!p || !Array.isArray(p.value) || !p.value.length) return null;
  const [a, b] = p.value as number[];
  return { value: b !== undefined && b !== a ? `${a.toLocaleString("en")}–${b.toLocaleString("en")}` : a.toLocaleString("en"), sources: p.sources };
}
