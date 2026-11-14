import "server-only";
import { summariseMarket, type Fact, type ReportSummary } from "@/lib/backend/markets";
import { lastEquityRound } from "@/lib/market";
import { formatFuzzyDate, formatMoney } from "@/lib/format";
import { TTL, calaFetchedAt, memoCala } from "./client";
import { REFRESH_WINDOW_MS, marketDeals, marketPlayers, marketSize, marketTrends, type EvidenceSection, type ReportQuery } from "./report";

// Executive summary for a market report. This file gathers the numbered Cala facts (from the same cached
// calls as the report sections, so no extra Cala requests); the backend has the LLM write from them and drops
// any claim that does not check out against the facts it cites.

export type { Claim, Insight, ReportSummary, SizeFigure } from "@/lib/backend/markets";

export async function reportSummary(q: ReportQuery): Promise<ReportSummary & { fetchedAt?: number }> {
  const key = `summary:v5:${q.sector}|${q.region}|${q.year}`;
  const s = await memoCala(key, () => build(q), TTL.knowledge, q.refresh ? REFRESH_WINDOW_MS : undefined);
  return { ...s, fetchedAt: calaFetchedAt(key) };
}

async function build(q: ReportQuery): Promise<ReportSummary> {
  // The same Cala calls as the sections below (memoised), so the summary costs no extra Cala requests.
  const [size, deals, trends, players] = await Promise.allSettled([marketSize(q), marketDeals(q), marketTrends(q), marketPlayers(q)]);

  const facts: Fact[] = [];
  const add = (prefix: string, s: PromiseSettledResult<EvidenceSection>, max: number) => {
    if (s.status !== "fulfilled") return;
    s.value.evidence.slice(0, max).forEach((e, i) => facts.push({ id: `${prefix}${i + 1}`, text: e.text.slice(0, 1500), sources: e.sources }));
  };
  add("S", size, 15);
  add("D", deals, 18);
  add("T", trends, 15);
  if (players.status === "fulfilled") {
    players.value.companies.slice(0, 10).forEach((c, i) => {
      const last = lastEquityRound(c);
      const text = [
        `${c.name}: ${c.description?.value ?? "no description on record"}`,
        c.hq ? `Headquarters: ${c.hq.value}.` : "",
        last ? `Last equity round on record: ${last.stage}, ${formatMoney(last.amount)}, ${formatFuzzyDate(last.date)}.` : "No funding rounds on record.",
      ].join(" ");
      facts.push({ id: `P${i + 1}`, text, sources: [...(c.description?.sources ?? []), ...(last?.sources ?? [])] });
    });
  }
  if (!facts.length) throw new Error("Cala returned no facts for this market, so there is nothing to summarise.");

  return summariseMarket({ market: q.sector, region: q.region, year: q.year, facts });
}
