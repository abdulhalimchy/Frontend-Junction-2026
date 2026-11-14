import "server-only";
import type { MarketCompany, MarketData, Source } from "@/lib/types";
import { assertCalaKey, knowledgeQuery, knowledgeSearch, type KnowBit } from "./client";
import { fetchMarket, loadCandidates, regionOf } from "./market";

// Market report: each section is gathered from Cala independently so the page can stream them as they
// arrive. Text answers come from knowledge_search together with the facts (KnowBits) behind them;
// companies and funding come from sourced entities, as in the market view.

export type ReportQuery = { sector: string; region: string; year: number };

export type Evidence = { id: string; text: string; sources: Source[] };

/** A question answered by Cala: its markdown summary plus every fact it rests on, each with its origin. */
export type EvidenceSection = { question: string; summary: string; evidence: Evidence[] };

function where(regionKey: string) {
  const countries = regionOf(regionKey).countries;
  if (!countries.length) return " worldwide";
  return countries.length > 6 ? " in Europe" : ` in ${countries.join(", ")}`;
}

function toEvidence(k: KnowBit): Evidence {
  return {
    id: k.id,
    text: k.content,
    // KnowBit origins carry no date or rank: shown as unranked sources with their document title.
    sources: k.origins.map((o) => ({
      name: o.document.name || o.source.name,
      document: o.document.url || o.source.url,
      date: "",
      date_precision: null,
      source_rank: null,
    })),
  };
}

async function ask(question: string): Promise<EvidenceSection> {
  assertCalaKey();
  const res = await knowledgeSearch(question);
  return { question, summary: res.content, evidence: (res.context ?? []).map(toEvidence) };
}

export function marketSize(q: ReportQuery) {
  return ask(
    `What is the market size and expected growth rate (CAGR) of the ${q.sector} market${where(q.region)}? ` +
      `Give figures from market research reports with their year, currency and forecast period.`,
  );
}

export function marketTrends(q: ReportQuery) {
  return ask(`What are the key trends, growth drivers and challenges in the ${q.sector} market${where(q.region)} in ${q.year - 1} and ${q.year}?`);
}

export function marketFunding(q: ReportQuery) {
  return ask(
    `What notable funding rounds did ${q.sector} startups${where(q.region)} raise in ${q.year - 1} and ${q.year}? ` +
      `For each, give the company, amount with currency, round type, date and lead investors.`,
  );
}

export function marketDeals(q: ReportQuery) {
  return ask(`What notable acquisitions, mergers, IPOs and exits happened in the ${q.sector} market${where(q.region)} since ${q.year - 2}?`);
}

/** Leading companies of any size and age, public or private, resolved to sourced Cala entities. */
export async function marketPlayers(q: ReportQuery): Promise<{ definition: string; companies: MarketCompany[]; unresolved: number }> {
  assertCalaKey();
  const definition = `Leading and largest companies in the ${q.sector} market${where(q.region)}, including public companies.return(name, country)`;
  const res = await knowledgeQuery(definition);
  const { companies, unresolved } = await loadCandidates(res, q.region);
  return { definition, companies, unresolved };
}

/** Startups that raised recently: the funding analysis from the market view. */
export function marketCapital(q: ReportQuery): Promise<MarketData> {
  return fetchMarket({ sector: q.sector, region: q.region, since: q.year - 1 });
}
