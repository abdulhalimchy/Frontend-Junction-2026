import "server-only";
import type { Company, EventInfo, Investor, InvestorCheck, MarketData, MarketQuery, Person } from "@/lib/types";
import { companies, competitorsOf } from "@/lib/mocks/companies";
import { investorChecks, investors, people } from "@/lib/mocks/investors";
import { slushEvent } from "@/lib/mocks/misc";
import { mockMarket } from "@/lib/mocks/market";
import { assertCalaKey, mocksEnabled, searchEntities } from "./client";
import { fetchMarket, normaliseName } from "./market";
import { slushAttendeeIndex } from "./slush";

// Market (getMarket) and search (searchEntity) are live from Cala; see ./market.ts. The live Slush event
// space is in ./slush.ts. Everything else still returns fixtures from lib/mocks.
// Phase 3 replaces the bodies with real Cala calls (entity_search, entity_lookup, entity_retrieval,
// entity_introspection) behind the USE_MOCKS flag, keeping these signatures.

export type SearchHit =
  | { type: "company"; id: string; name: string; subtitle: string; attendsSlush: boolean }
  | { type: "investor"; id: string; name: string; subtitle: string; attendsSlush: boolean }
  | { type: "person"; id: string; name: string; subtitle: string; href: string };

/**
 * Companies matching the text, from Cala's fuzzy name search (entity_search). Live unless USE_MOCKS=true.
 * Cala types investors as companies too, so live hits are all "company"; their pages detect investing
 * activity. People are left out until there is a live person page to link to.
 */
export async function searchEntity(query: string, limit = 20): Promise<SearchHit[]> {
  if (mocksEnabled()) return searchMockEntities(query);
  const q = query.trim();
  if (q.length < 2) return [];
  assertCalaKey();
  const [res, slush] = await Promise.all([
    searchEntities(q.slice(0, 100), ["Company", "Organization"], limit),
    slushAttendeeIndex().catch(() => null), // the Slush tag is a nice-to-have; search works without it
  ]);
  return res.entities.map((e) => ({
    type: "company" as const,
    id: e.id,
    name: e.name,
    subtitle: e.description ?? (e.entity_type === "Organization" ? "Organisation" : "Company"),
    attendsSlush: !!slush && (slush.ids.has(e.id) || slush.names.has(normaliseName(e.name))),
  }));
}

function searchMockEntities(query: string): SearchHit[] {
  const q = query.trim().toLowerCase();
  const match = (...fields: string[]) => !q || fields.some((f) => f.toLowerCase().includes(q));
  const hits: SearchHit[] = [];
  for (const c of companies)
    if (match(c.name, c.description.value, c.sector, c.hq.value))
      hits.push({ type: "company", id: c.id, name: c.name, subtitle: `${c.sector} · ${c.hq.value}`, attendsSlush: c.attendsSlush });
  for (const i of investors)
    if (match(i.name, i.description.value, i.focus.value.join(" ")))
      hits.push({ type: "investor", id: i.id, name: i.name, subtitle: `${i.kind} · ${i.hq.value}`, attendsSlush: i.attendsSlush });
  for (const p of people) {
    const org = p.companyId ? getCompanySync(p.companyId)?.name : getInvestorSync(p.investorId!)?.name;
    if (match(p.name, p.title, org ?? ""))
      hits.push({
        type: "person",
        id: p.id,
        name: p.name,
        subtitle: `${p.title}, ${org}`,
        href: p.companyId ? `/company/${p.companyId}` : `/investor/${p.investorId}`,
      });
  }
  return hits;
}

export async function getCompany(id: string): Promise<Company | null> {
  return getCompanySync(id);
}

export async function getCompanies(ids: string[]): Promise<Company[]> {
  return ids.map(getCompanySync).filter((c): c is Company => !!c);
}

/** Funding rounds for a company. An empty list is a normal state ("No funding on record"). */
export async function getRounds(companyId: string) {
  return getCompanySync(companyId)?.rounds ?? [];
}

export async function getInvestor(id: string): Promise<{ investor: Investor; check: InvestorCheck } | null> {
  const investor = getInvestorSync(id);
  if (!investor) return null;
  return { investor, check: investorChecks[id] };
}

export async function getInvestors(ids?: string[]): Promise<Investor[]> {
  return ids ? ids.map(getInvestorSync).filter((i): i is Investor => !!i) : investors;
}

export async function getPeople(ids: string[]): Promise<Person[]> {
  return ids.map((id) => people.find((p) => p.id === id)).filter((p): p is Person => !!p);
}

export async function getPerson(id: string): Promise<Person | null> {
  return people.find((p) => p.id === id) ?? null;
}

/** Companies matched on description, with the reason. Industry codes are only a rough pre-filter. */
export async function getSimilarCompanies(companyId: string) {
  return (competitorsOf[companyId] ?? [])
    .map((c) => ({ ...c, company: getCompanySync(c.id)! }))
    .filter((c) => c.company);
}

/** Market view. Live from Cala unless USE_MOCKS=true. Throws CalaError on API problems. */
export async function getMarket(q: MarketQuery): Promise<MarketData> {
  return mocksEnabled() ? mockMarket(q) : fetchMarket(q);
}

/** Attendees are the event's incoming PARTICIPATES_IN_EVENT relationships. */
export async function getEventAttendees(_eventId: string) {
  return {
    event: slushEvent as EventInfo,
    companies: companies.filter((c) => c.attendsSlush),
    investors: investors.filter((i) => i.attendsSlush),
  };
}

/** Investors whose portfolio overlaps a company's competitors or sector. Used for "Investors" tab. */
export async function getInvestorsForCompany(companyId: string) {
  const competitorIds = (competitorsOf[companyId] ?? []).map((c) => c.id);
  return investors
    .filter((i) => !i.portfolioIds.includes(companyId))
    .map((i) => ({
      investor: i,
      check: investorChecks[i.id],
      backsCompetitors: i.portfolioIds.filter((p) => competitorIds.includes(p)),
    }));
}

function getCompanySync(id: string) {
  return companies.find((c) => c.id === id) ?? null;
}

function getInvestorSync(id: string) {
  return investors.find((i) => i.id === id) ?? null;
}
