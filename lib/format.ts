import type { FundingRound, FuzzyDate, Money } from "@/lib/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Formats a date at the precision Cala actually has. Never pads a year into a full date. */
export function formatFuzzyDate(d: FuzzyDate | null): string {
  if (!d) return "Date not on record";
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

const COUNTRY_CODES: Record<string, string> = {
  FI: "Finland", SE: "Sweden", NO: "Norway", DK: "Denmark", EE: "Estonia", DE: "Germany", NL: "Netherlands", FR: "France",
  GB: "United Kingdom", UK: "United Kingdom", IE: "Ireland", ES: "Spain", IT: "Italy", CH: "Switzerland", AT: "Austria",
  BE: "Belgium", PL: "Poland", PT: "Portugal", US: "United States", USA: "United States", CA: "Canada", SG: "Singapore",
};

/**
 * City and region or country from a full address, for one-line headers:
 * "1515 3RD STREET, SAN FRANCISCO, US-CA, 94158, US" → "San Francisco, CA";
 * "Vitikka 6, 02630 Espoo, Finland" → "Espoo, Finland".
 */
export function shortPlace(address: string): string {
  let state: string | null = null;
  const parts = address
    .split(",")
    // Drop the street before a postcode: "Pursimiehenkatu 26 C 00150 Helsinki" → "Helsinki".
    .map((s) => s.trim().replace(/^.*?\b\d{4,6}\s+/, ""))
    .map((s) => {
      const sub = /^[A-Z]{2}-([A-Z0-9]{1,3})$/.exec(s);
      if (sub) state = sub[1];
      return sub ? sub[1] : s;
    })
    // Streets and bare postcodes carry digits.
    .filter((s) => s && !/\d/.test(s));
  const last = parts[parts.length - 1];
  if (last && /^[A-Z]{2,3}$/.test(last) && last !== state) {
    // "…, CA, US": the state is enough for US addresses; other codes become country names.
    if (state && (last === "US" || last === "USA")) parts.pop();
    else parts[parts.length - 1] = COUNTRY_CODES[last] ?? last;
  }
  return parts
    .slice(-2)
    .map((s) => (s === s.toUpperCase() && s.length > 3 ? s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : s))
    .join(", ");
}

/** ISO date (YYYY-MM-DD) `days` before now. For server components, which render once per request. */
export function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
}

/** A moment as "15 Nov, 02:00" in `timeZone` (the alert schedule's zone), with "today"/"tomorrow" when close. */
export function formatMoment(iso: string, timeZone: string): string {
  const d = new Date(iso);
  const day = (x: Date) => x.toLocaleDateString("en-CA", { timeZone });
  const time = d.toLocaleTimeString("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" });
  const now = new Date();
  if (day(d) === day(now)) return `today ${time}`;
  if (day(d) === day(new Date(now.getTime() + 864e5))) return `tomorrow ${time}`;
  if (day(d) === day(new Date(now.getTime() - 864e5))) return `yesterday ${time}`;
  return `${d.toLocaleDateString("en-GB", { timeZone, day: "numeric", month: "short" })}, ${time}`;
}

/** "Europe/Helsinki" -> "Helsinki". */
export const zoneCity = (tz: string) => tz.split("/").pop()!.replace(/_/g, " ");
