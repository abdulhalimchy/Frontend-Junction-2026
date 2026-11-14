import "server-only";
import type { FundingRound, Source } from "@/lib/types";
import { retrieveEntity, toSources } from "./client";
import { ROUND_PROPS, parseRound } from "./market";

// One funding round with its participants: who raised it (ISSUER), who led it (is_lead) and who joined.
// One Cala call per round, cached 7 days. Used by company and investor briefs only, never by market analysis,
// so opening a brief does not change the cached request shape of the market views.

export type Party = { id: string; name: string; sources: Source[] };
export type RoundDetail = {
  round: FundingRound;
  issuer: Party | null;
  leads: Party[];
  participants: Party[];
};

export async function fetchRoundDetail(id: string, fallbackName = "Funding round"): Promise<RoundDetail> {
  const r = await retrieveEntity(id, {
    properties: ROUND_PROPS,
    relationships: { incoming: { PARTICIPATES_IN_FUNDING_ROUND: { limit: 25 } } },
  });
  const edges = r.relationships.incoming.PARTICIPATES_IN_FUNDING_ROUND ?? [];
  const party = (e: (typeof edges)[number]): Party => ({ id: e.id, name: e.name, sources: toSources(e.properties.sources) });
  const issuerEdge = edges.find((e) => e.properties.role === "ISSUER");
  const investors = edges.filter((e) => e.properties.role !== "ISSUER");
  return {
    round: parseRound(r, fallbackName),
    issuer: issuerEdge ? party(issuerEdge) : null,
    leads: investors.filter((e) => e.properties.is_lead === true).map(party),
    participants: investors.filter((e) => e.properties.is_lead !== true).map(party),
  };
}
