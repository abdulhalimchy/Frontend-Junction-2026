import "server-only";
import type { CompanyMatch, CompanyProfile, MarketData, Money, Sourced } from "@/lib/types";
import { assertCalaKey, knowledgeQuery, retrieveEntity, searchEntities, toSources, type GetEntityResponse } from "./client";
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

const PROFILE_PROPS = [
  ...COMPANY_PROPS,
  "legal_name", "website", "employee_count_range", "operational_status", "company_ownership_status", "funding_stage",
  "total_funding", "total_funding_units", "total_funding_excluding_debt", "total_funding_excluding_debt_units",
];

export async function fetchCompanyProfile(id: string): Promise<CompanyProfile> {
  assertCalaKey();
  const e = await retrieveEntity(id, {
    properties: PROFILE_PROPS,
    relationships: {
      ...COMPANY_RELATIONSHIPS,
      outgoing: { ...COMPANY_RELATIONSHIPS.outgoing, OPERATES_IN_INDUSTRY: { limit: 5 } },
    },
  });
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
