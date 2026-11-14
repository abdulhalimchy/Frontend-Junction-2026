import type { FundingRound, FuzzyDate, Money } from "@/lib/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Formats a date at the precision Cala actually has. Never pads a year into a full date. */
export function formatFuzzyDate(d: FuzzyDate): string {
  const [y, m, day] = d.date.split("-");
  if (d.precision === "year" || !m) return y;
  if (d.precision === "month" || !day) return `${MONTHS[Number(m) - 1]} ${y}`;
  return `${Number(day)} ${MONTHS[Number(m) - 1]} ${y}`;
}

/** ISO day string (e.g. a source date) to "12 Mar 2024". */
export function formatDay(iso: string): string {
  return formatFuzzyDate({ date: iso.slice(0, 10), precision: "day" });
}

const SYMBOLS: Record<string, string> = { EUR: "€", USD: "$", GBP: "£" };

/** Compact money, always with its currency: €2.4M, NOK 18M. */
export function formatMoney(m: Money | null): string {
  if (!m) return "Undisclosed";
  const n = m.amount;
  const compact =
    n >= 1e9 ? `${trim(n / 1e9)}B` : n >= 1e6 ? `${trim(n / 1e6)}M` : n >= 1e3 ? `${trim(n / 1e3)}k` : `${n}`;
  const sym = SYMBOLS[m.currency];
  return sym ? `${sym}${compact}` : `${m.currency} ${compact}`;
}

function trim(n: number) {
  return n >= 100 ? n.toFixed(0) : n.toFixed(1).replace(/\.0$/, "");
}

/** Sums rounds of one kind, grouped by currency. Never converts between currencies. */
export function totalsByCurrency(rounds: FundingRound[], kind: FundingRound["kind"]): Money[] {
  const map = new Map<string, number>();
  for (const r of rounds) {
    if (r.kind !== kind || !r.amount) continue;
    map.set(r.amount.currency, (map.get(r.amount.currency) ?? 0) + r.amount.amount);
  }
  return [...map.entries()].map(([currency, amount]) => ({ amount, currency }));
}

export function formatTotals(totals: Money[]): string {
  return totals.length ? totals.map(formatMoney).join(" + ") : "None on record";
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
