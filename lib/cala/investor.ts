import "server-only";
import type { Source, Sourced } from "@/lib/types";
import { assertCalaKey, retrieveEntity, toSources, type RelationshipEdge } from "./client";
import { companyCountries, labelise, sourced } from "./market";

// Investor overview from Cala: one request per investor (cached 7 days) for its profile, portfolio
// (outgoing INVESTED_IN), funding-round participations (with role and is_lead) and team.

const PORTFOLIO_LIMIT = 100;
const ROUNDS_LIMIT = 100;

export type PortfolioCompany = {
  id: string;
  name: string;
  /**
   * Earliest date among press, primary and filing sources that mention the investment. It is a source date,
   * not the round date (pages are re-read over time), and is shown as such. Aggregator and unranked sources
   * are dated when collected, so they are ignored (null when only such sources exist).
   */
  firstReported: string | null;
  sources: Source[];
};

export type InvestorProfile = {
  id: string;
  name: string;
  entityType: string;
  description: Sourced<string> | null;
  website: Sourced<string> | null;
  address: Sourced<string> | null;
  countries: string[];
  industries: { name: string; label: string | null; sources: Source[] }[];
  portfolio: PortfolioCompany[];
  portfolioCapped: boolean;
  rounds: { total: number; led: number; capped: boolean; byStage: { stage: string; count: number }[]; sources: Source[] };
  team: { id: string; name: string; role: string; sources: Source[] }[];
  /** People and organisations that invested in this investor (e.g. fund LPs, when on record). */
  backers: { id: string; name: string; sources: Source[] }[];
};

const QUERY = {
  properties: ["name", "description", "website", "headquarters_address", "registered_address", "founding_date"],
  relationships: {
    outgoing: {
      INVESTED_IN: { limit: PORTFOLIO_LIMIT },
      PARTICIPATES_IN_FUNDING_ROUND: { limit: ROUNDS_LIMIT },
      HAS_HEADQUARTERS_IN: { limit: 3 },
      IS_REGISTERED_IN: { limit: 3 },
      OPERATES_IN_INDUSTRY: { limit: 5 },
    },
    incoming: { WORKS_AT: { limit: 25 }, INVESTED_IN: { limit: 15 } },
  },
};

export async function fetchInvestorProfile(id: string): Promise<InvestorProfile> {
  assertCalaKey();
  const e = await retrieveEntity(id, QUERY);
  const out = e.relationships.outgoing;
  const inc = e.relationships.incoming;

  const portfolio = (out.INVESTED_IN ?? [])
    .map((r) => {
      const sources = toSources(r.properties.sources);
      const dated = sources.filter((s) => s.source_rank === "PRESS" || s.source_rank === "PRIMARY" || s.source_rank === "FILING");
      const first = dated.map((s) => s.date.slice(0, 10)).filter(Boolean).sort()[0] ?? null;
      return { id: r.id, name: r.name, firstReported: first, sources };
    })
    .sort((a, b) => (b.firstReported ?? "").localeCompare(a.firstReported ?? ""));

  const roundEdges = (out.PARTICIPATES_IN_FUNDING_ROUND ?? []).filter((r) => r.properties.role !== "ISSUER");
  const stages = new Map<string, number>();
  for (const r of roundEdges) stages.set(r.name, (stages.get(r.name) ?? 0) + 1);

  return {
    id: e.id,
    name: e.name,
    entityType: e.entity_type,
    description: sourced<string>(e, "description"),
    website: sourced<string>(e, "website"),
    address: sourced<string>(e, "headquarters_address") ?? sourced<string>(e, "registered_address"),
    countries: companyCountries(e),
    industries: (out.OPERATES_IN_INDUSTRY ?? []).map((i) => ({
      name: labelise(i.name),
      label: typeof i.properties.original_label === "string" ? i.properties.original_label : null,
      sources: toSources(i.properties.sources),
    })),
    portfolio,
    portfolioCapped: (out.INVESTED_IN ?? []).length >= PORTFOLIO_LIMIT,
    rounds: {
      total: roundEdges.length,
      led: roundEdges.filter((r) => r.properties.is_lead === true).length,
      capped: (out.PARTICIPATES_IN_FUNDING_ROUND ?? []).length >= ROUNDS_LIMIT,
      byStage: [...stages.entries()].map(([stage, count]) => ({ stage, count })).sort((a, b) => b.count - a.count),
      sources: dedupe(roundEdges.flatMap((r) => toSources(r.properties.sources))),
    },
    team: (inc.WORKS_AT ?? []).map((r: RelationshipEdge) => ({
      id: r.id,
      name: r.name,
      role: typeof r.properties.role === "string" && r.properties.role ? r.properties.role : "Team member",
      sources: toSources(r.properties.sources),
    })),
    backers: (inc.INVESTED_IN ?? []).map((r) => ({ id: r.id, name: r.name, sources: toSources(r.properties.sources) })),
  };
}

function dedupe(sources: Source[]) {
  return sources.filter((s, i, arr) => arr.findIndex((x) => x.name === s.name && x.document === s.document) === i);
}
