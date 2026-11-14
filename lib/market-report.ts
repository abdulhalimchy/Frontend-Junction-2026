import type { MarketAnalysis, ReportSummary, SizeFigure } from "@/lib/backend/markets";
import type { MarketCompany, Money } from "@/lib/types";

// Chart and headline numbers for a market report, derived from the stored, sourced data (no extra requests).
// Money is never converted: every money chart uses one currency (the most common one among the rounds) and
// says how many rounds in other currencies it leaves out. Grants are kept apart from equity.

export type BarDatum = { label: string; value: number; display: string; href?: string; note?: string };
export type YearDatum = { year: number; equity: number; grants: number; rounds: number };

export type ReportNumbers = {
  currency: string | null;
  otherCurrencyRounds: number;
  size: { latest: SizeFigure | null; forecast: SizeFigure | null; cagr: SizeFigure["cagr"]; publisher: string; scope: string; series: SizeFigure[] } | null;
  companies: number;
  equityTotal: Money | null;
  /** Companies counted with their reported total because their rounds carry no amounts. */
  reportedTotals: number;
  recentRounds: number;
  recentSince: number;
  fundingByYear: YearDatum[];
  topFunded: BarDatum[];
  stages: BarDatum[];
  investors: BarDatum[];
};

const STAGE_ORDER = ["Pre-seed", "Seed", "Series A", "Series B", "Series C", "Series D+", "Growth / late", "Other equity"];

export function stageBucket(stage: string): string {
  const s = stage.toLowerCase();
  if (/pre[-\s]?seed/.test(s)) return "Pre-seed";
  if (/seed|angel/.test(s)) return "Seed";
  const m = s.match(/series\s+([a-z])/);
  if (m) return m[1] <= "c" ? `Series ${m[1].toUpperCase()}` : "Series D+";
  if (/growth|late|private equity|pe\b/.test(s)) return "Growth / late";
  return "Other equity";
}

export function compact(n: number) {
  const a = Math.abs(n);
  const t = (x: number) => (x >= 100 ? x.toFixed(0) : x.toFixed(1).replace(/\.0$/, ""));
  return a >= 1e12 ? `${t(n / 1e12)}T` : a >= 1e9 ? `${t(n / 1e9)}B` : a >= 1e6 ? `${t(n / 1e6)}M` : a >= 1e3 ? `${t(n / 1e3)}k` : `${n}`;
}

const SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥" };
export const money = (amount: number, currency: string) => `${SYMBOLS[currency] ?? `${currency} `}${compact(amount)}`;

function dominantCurrency(companies: MarketCompany[]): string | null {
  const count = new Map<string, number>();
  for (const c of companies) {
    for (const r of c.rounds) if (r.amount && r.kind !== "other") count.set(r.amount.currency, (count.get(r.amount.currency) ?? 0) + 1);
    const t = c.totalFunding?.value;
    if (t) count.set(t.currency, (count.get(t.currency) ?? 0) + 1);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** The market-size series to chart: the publisher group with the most figures, regional scopes first. */
function sizeSeries(summary: ReportSummary | undefined): ReportNumbers["size"] {
  const sizes = summary?.sizes ?? [];
  if (!sizes.length) return null;
  const groups = new Map<string, SizeFigure[]>();
  for (const f of sizes) {
    const k = `${f.factId}|${f.scope.toLowerCase()}|${f.value.currency}`;
    groups.set(k, [...(groups.get(k) ?? []), f]);
  }
  const global = (f: SizeFigure) => Number(/global|world/i.test(f.scope));
  const best = [...groups.values()].sort((a, b) => b.length - a.length || global(a[0]) - global(b[0]))[0];
  const series = [...new Map(best.map((f) => [f.year, f])).values()].sort((a, b) => a.year - b.year);
  const reported = series.filter((f) => f.kind === "size");
  return {
    latest: reported.at(-1) ?? series[0],
    forecast: series.filter((f) => f.kind === "forecast").at(-1) ?? null,
    cagr: best.find((f) => f.cagr)?.cagr ?? sizes.find((f) => f.cagr)?.cagr ?? null,
    publisher: best[0].publisher,
    scope: best[0].scope,
    series,
  };
}

export function reportNumbers(a: MarketAnalysis): ReportNumbers {
  const companies = a.players?.companies ?? [];
  const currency = dominantCurrency(companies);
  const since = a.year - 2;
  const byYear = new Map<number, YearDatum>();
  const stageCount = new Map<string, number>();
  const investors = new Map<string, { name: string; companies: Set<string> }>();
  let otherCurrencyRounds = 0;
  let equityTotal = 0;
  let recentRounds = 0;
  let reportedTotals = 0;

  const funded: BarDatum[] = [];
  for (const c of companies) {
    let raised = 0;
    for (const r of c.rounds) {
      if (r.kind === "other") continue;
      const year = r.date ? Number(r.date.date.slice(0, 4)) : null;
      if (r.kind === "equity") stageCount.set(stageBucket(r.stage), (stageCount.get(stageBucket(r.stage)) ?? 0) + 1);
      if (year && year >= since) recentRounds++;
      if (!r.amount) continue;
      if (r.amount.currency !== currency) {
        otherCurrencyRounds++;
        continue;
      }
      if (r.kind === "equity") {
        raised += r.amount.amount;
        equityTotal += r.amount.amount;
      }
      if (year) {
        const d = byYear.get(year) ?? { year, equity: 0, grants: 0, rounds: 0 };
        if (r.kind === "equity") d.equity += r.amount.amount;
        else d.grants += r.amount.amount;
        d.rounds++;
        byYear.set(year, d);
      }
    }
    // Equity rounds summed; when none carry an amount, the company's reported total (all instruments).
    const reported = c.totalFunding?.value;
    if (raised > 0 && currency) funded.push({ label: c.name, value: raised, display: money(raised, currency), href: `/company/${c.id}` });
    else if (reported && reported.currency === currency) {
      funded.push({ label: c.name, value: reported.amount, display: `${money(reported.amount, reported.currency)}*`, href: `/company/${c.id}`, note: "reported total, all instruments" });
      equityTotal += reported.amount;
      reportedTotals++;
    }
    for (const i of c.investors) {
      const key = i.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const e = investors.get(key) ?? { name: i.name, companies: new Set<string>() };
      e.companies.add(c.name);
      investors.set(key, e);
    }
  }

  const years = [...byYear.values()].sort((x, y) => x.year - y.year).filter((d) => d.year >= a.year - 9);
  return {
    currency,
    otherCurrencyRounds,
    size: sizeSeries(a.summary),
    companies: companies.length,
    equityTotal: currency && equityTotal ? { amount: equityTotal, currency } : null,
    reportedTotals,
    recentRounds,
    recentSince: since,
    fundingByYear: years,
    topFunded: funded.sort((x, y) => y.value - x.value).slice(0, 10),
    stages: STAGE_ORDER.filter((s) => stageCount.has(s)).map((s) => ({ label: s, value: stageCount.get(s)!, display: `${stageCount.get(s)} ${stageCount.get(s) === 1 ? "round" : "rounds"}` })),
    investors: [...investors.values()]
      .filter((i) => i.companies.size > 0)
      .sort((x, y) => y.companies.size - x.companies.size || x.name.localeCompare(y.name))
      .slice(0, 8)
      .map((i) => ({ label: i.name, value: i.companies.size, display: `${i.companies.size} ${i.companies.size === 1 ? "company" : "companies"}`, note: [...i.companies].join(", ") })),
  };
}
