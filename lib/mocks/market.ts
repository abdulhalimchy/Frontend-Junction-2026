import type { MarketData, MarketQuery } from "@/lib/types";
import { companies } from "./companies";
import { investors } from "./investors";

/** Fixture market built from the mock companies, in the same shape the live Cala market returns. */
export function mockMarket(q: MarketQuery): MarketData {
  const list = companies.filter((c) => c.sector === "Maritime robotics");
  return {
    query: q,
    definition: `(mock data) startups.description=${q.sector}`,
    companies: list.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      hq: c.hq,
      founded: c.founded,
      rounds: c.rounds,
      investors: investors
        .filter((i) => i.portfolioIds.includes(c.id))
        .map((i) => ({ id: i.id, name: i.name, sources: i.description.sources })),
    })),
  };
}
