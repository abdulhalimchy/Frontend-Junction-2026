import type { FundingRound, MarketCompany, MarketData, Money, Source, Sourced } from "@/lib/types";

// Pure aggregation over MarketData. Rules:
// - Equity, grants and other instruments (debt, loans, …) are never added together.
// - Totals and the chart use one currency (the most common one); rounds in other currencies are counted, not converted.
// - Rounds without an amount or a date are counted and excluded, never estimated.
// - Every aggregate carries the sources of the rounds that went into it.

export type YearPoint = { year: number; equity: number; grants: number; rounds: number };

export type MarketSummary = {
  currency: string | null;
  companyCount: number;
  withoutFunding: number;
  equityTotal: Sourced<Money> | null;
  grantTotal: Sourced<Money> | null;
  medianSeed: Sourced<Money> | null;
  seedCount: number;
  byYear: YearPoint[];
  yearSources: Source[];
  excluded: { otherCurrency: number; otherCurrencies: string[]; undisclosed: number; undated: number; otherInstrument: number };
  investors: { id: string; name: string; companies: string[]; sources: Source[] }[];
};

export function summariseMarket(data: MarketData): MarketSummary {
  const rounds = data.companies.flatMap((c) => c.rounds);
  const money = rounds.filter((r) => r.kind !== "other" && r.amount);

  // Most common currency among rounds with an amount.
  const counts = new Map<string, number>();
  for (const r of money) counts.set(r.amount!.currency, (counts.get(r.amount!.currency) ?? 0) + 1);
  const currency = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const inCurrency = money.filter((r) => r.amount!.currency === currency);
  const equity = inCurrency.filter((r) => r.kind === "equity");
  const grants = inCurrency.filter((r) => r.kind === "grant");
  const seeds = equity.filter((r) => /^seed$/i.test(r.stage));

  const dated = inCurrency.filter((r) => r.date);
  const years = new Map<number, YearPoint>();
  for (const r of dated) {
    const year = Number(r.date!.date.slice(0, 4));
    const p = years.get(year) ?? { year, equity: 0, grants: 0, rounds: 0 };
    if (r.kind === "equity") p.equity += r.amount!.amount;
    else p.grants += r.amount!.amount;
    p.rounds += 1;
    years.set(year, p);
  }
  const byYear = fillYears([...years.values()]).map((p) => ({ ...p, equity: toMillions(p.equity), grants: toMillions(p.grants) }));

  const otherCurrencyRounds = money.filter((r) => r.amount!.currency !== currency);

  // Investors that appear across the market, most companies first.
  const inv = new Map<string, { id: string; name: string; companies: string[]; sources: Source[] }>();
  for (const c of data.companies) {
    for (const i of c.investors) {
      const e = inv.get(i.id) ?? { id: i.id, name: i.name, companies: [], sources: [] };
      if (!e.companies.includes(c.name)) e.companies.push(c.name);
      e.sources = dedupe([...e.sources, ...i.sources]);
      inv.set(i.id, e);
    }
  }

  return {
    currency,
    companyCount: data.companies.length,
    withoutFunding: data.companies.filter((c) => !c.rounds.length).length,
    equityTotal: total(equity, currency),
    grantTotal: total(grants, currency),
    medianSeed: seeds.length && currency ? { value: { amount: median(seeds.map((r) => r.amount!.amount)), currency }, sources: roundSources(seeds) } : null,
    seedCount: seeds.length,
    byYear,
    yearSources: roundSources(dated),
    excluded: {
      otherCurrency: otherCurrencyRounds.length,
      otherCurrencies: [...new Set(otherCurrencyRounds.map((r) => r.amount!.currency))],
      undisclosed: rounds.filter((r) => r.kind !== "other" && !r.amount).length,
      undated: inCurrency.filter((r) => !r.date).length,
      otherInstrument: rounds.filter((r) => r.kind === "other").length,
    },
    investors: [...inv.values()].sort((a, b) => b.companies.length - a.companies.length || a.name.localeCompare(b.name)),
  };
}

export function lastEquityRound(c: MarketCompany): FundingRound | undefined {
  return c.rounds
    .filter((r) => r.kind === "equity")
    .sort((a, b) => (b.date?.date ?? "").localeCompare(a.date?.date ?? ""))[0];
}

function total(rounds: FundingRound[], currency: string | null): Sourced<Money> | null {
  if (!currency || !rounds.length) return null;
  return { value: { amount: rounds.reduce((s, r) => s + r.amount!.amount, 0), currency }, sources: roundSources(rounds) };
}

function roundSources(rounds: FundingRound[]) {
  return dedupe(rounds.flatMap((r) => r.sources));
}

function dedupe(sources: Source[]) {
  return sources.filter((s, i, arr) => arr.findIndex((x) => x.name === s.name && x.document === s.document) === i);
}

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function toMillions(n: number) {
  return Math.round((n / 1e6) * 100) / 100;
}

/** Fills gaps so the chart shows empty years as zero rather than skipping them. Capped at the last 8 years. */
function fillYears(points: YearPoint[]): YearPoint[] {
  if (!points.length) return [];
  const max = Math.max(...points.map((p) => p.year));
  const min = Math.max(Math.min(...points.map((p) => p.year)), max - 7);
  const out: YearPoint[] = [];
  for (let y = min; y <= max; y++) out.push(points.find((p) => p.year === y) ?? { year: y, equity: 0, grants: 0, rounds: 0 });
  return out;
}
