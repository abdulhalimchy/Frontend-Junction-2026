import "server-only";
import { LLM_MODEL, generateJson } from "@/lib/llm/gemini";
import { lastEquityRound } from "@/lib/market";
import { formatFuzzyDate, formatMoney } from "@/lib/format";
import type { Money, Source } from "@/lib/types";
import { memoCala } from "./client";
import { marketDeals, marketFunding, marketPlayers, marketSize, marketTrends, type EvidenceSection, type ReportQuery } from "./report";

// Executive summary for a market report: Gemini writes only from numbered Cala facts, then code checks every
// claim against the facts it cites. Anything that does not check out is dropped and counted, never shown.

type Fact = { id: string; text: string; sources: Source[] };

export type SizeFigure = {
  factId: string;
  publisher: string;
  scope: string;
  kind: "size" | "forecast";
  year: number;
  value: Money;
  cagr: { percent: number; period: string } | null;
  quote: string;
  sources: Source[];
};
export type Claim = { text: string; sources: Source[] };
export type Insight = Claim & { kind: "trend" | "opportunity" | "risk"; title: string };

export type ReportSummary = {
  model: string;
  headline: Claim | null;
  bullets: Claim[];
  sizes: SizeFigure[];
  insights: Insight[];
  factCount: number;
  checked: number;
  dropped: { what: string; reason: string }[];
};

export function reportSummary(q: ReportQuery): Promise<ReportSummary> {
  return memoCala(`summary:v3:${LLM_MODEL}:${q.sector}|${q.region}|${q.year}`, () => build(q));
}

async function build(q: ReportQuery): Promise<ReportSummary> {
  // The same Cala calls as the sections below (memoised), so the summary costs no extra Cala requests.
  const [size, funding, trends, deals, players] = await Promise.allSettled([
    marketSize(q),
    marketFunding(q),
    marketTrends(q),
    marketDeals(q),
    marketPlayers(q),
  ]);

  const facts: Fact[] = [];
  const add = (prefix: string, s: PromiseSettledResult<EvidenceSection>, max: number) => {
    if (s.status !== "fulfilled") return;
    s.value.evidence.slice(0, max).forEach((e, i) => facts.push({ id: `${prefix}${i + 1}`, text: e.text.slice(0, 1500), sources: e.sources }));
  };
  add("S", size, 15);
  add("F", funding, 12);
  add("T", trends, 15);
  add("D", deals, 12);
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

  const raw = await generateJson<RawSummary>({ system: SYSTEM, prompt: prompt(q, facts), schema: SCHEMA });
  return check(raw, facts);
}

const SYSTEM = `You are a market analyst writing for founders and investors.
Use ONLY the numbered facts provided. Never add knowledge of your own, never estimate, never fill gaps.
Every claim must cite the ids of the facts that support it. Numbers must be copied exactly as written in the facts.
Keep currencies as written; never convert between currencies. Keep grants separate from equity funding.
Market research publishers define markets differently: report their figures separately, never average them.
If facts conflict, say so. If the facts do not support a section, return an empty list for it.
Write plainly and concisely. No hype.`;

function prompt(q: ReportQuery, facts: Fact[]) {
  return `Market: ${q.sector}
Region: ${q.region}
Current year: ${q.year}

Facts (S = market size, F = funding, T = trends, D = deals, P = companies):
${facts.map((f) => `[${f.id}] ${f.text.replace(/\s+/g, " ")}`).join("\n")}

Write:
1. headline: one sentence on the state of this market, with fact ids.
2. bullets: 3 to 5 key takeaways for a founder or investor, each with fact ids.
3. sizes: every market size or forecast figure in the S facts. For each: publisher, scope (what market the figure covers, e.g. "global mobile application market"), kind (size or forecast), year, amount exactly as the number appears in the quote, scale (unit, thousand, million, billion, trillion), currency (ISO code), cagrPercent and cagrPeriod if the same fact states them, quote (copied word for word from the fact, containing the amount and currency), and factId.
4. insights: up to 6 trends, opportunities or risks, each with a short title, one or two sentences, and fact ids.`;
}

const ids = { type: "array", items: { type: "string" } };
const SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "object", properties: { text: { type: "string" }, factIds: ids }, required: ["text", "factIds"] },
    bullets: { type: "array", items: { type: "object", properties: { text: { type: "string" }, factIds: ids }, required: ["text", "factIds"] } },
    sizes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          publisher: { type: "string" },
          scope: { type: "string" },
          kind: { type: "string", enum: ["size", "forecast"] },
          year: { type: "integer" },
          amount: { type: "number" },
          scale: { type: "string", enum: ["unit", "thousand", "million", "billion", "trillion"] },
          currency: { type: "string" },
          cagrPercent: { type: "number" },
          cagrPeriod: { type: "string" },
          quote: { type: "string" },
          factId: { type: "string" },
        },
        required: ["publisher", "scope", "kind", "year", "amount", "scale", "currency", "quote", "factId"],
      },
    },
    insights: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["trend", "opportunity", "risk"] },
          title: { type: "string" },
          text: { type: "string" },
          factIds: ids,
        },
        required: ["kind", "title", "text", "factIds"],
      },
    },
  },
  required: ["headline", "bullets", "sizes", "insights"],
};

type RawClaim = { text: string; factIds: string[] };
type RawSummary = {
  headline: RawClaim;
  bullets: RawClaim[];
  sizes: {
    publisher: string;
    scope: string;
    kind: "size" | "forecast";
    year: number;
    amount: number;
    scale: keyof typeof SCALE;
    currency: string;
    cagrPercent?: number;
    cagrPeriod?: string;
    quote: string;
    factId: string;
  }[];
  insights: (RawClaim & { kind: Insight["kind"]; title: string })[];
};

const SCALE = { unit: 1, thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12 };
const CURRENCY_MARKS: Record<string, string[]> = {
  USD: ["$", "usd", "dollar"],
  EUR: ["€", "eur", "euro"],
  GBP: ["£", "gbp", "pound"],
  SEK: ["sek", "kronor", "krona"],
  NOK: ["nok", "krone"],
  DKK: ["dkk", "krone"],
  JPY: ["¥", "jpy", "yen"],
  CNY: ["cny", "rmb", "yuan"],
  INR: ["₹", "inr", "rupee"],
};

/** Lower case, markdown stripped, whitespace collapsed. */
function norm(s: string) {
  return s.toLowerCase().replace(/[*_#`>|]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Numbers as written: "1,234.5" → 1234.5. Digits glued to letters ("H1", "Q3", "5G", "B2B") are labels,
 * not figures, so they are skipped.
 */
function numbers(s: string) {
  return (s.match(/(?<![A-Za-z\d.,])\d[\d,]*(?:\.\d+)?(?![A-Za-z])/g) ?? [])
    .map((n) => Number(n.replace(/,/g, "")))
    .filter((n) => !Number.isNaN(n));
}

function check(raw: RawSummary, facts: Fact[]): ReportSummary {
  const byId = new Map(facts.map((f) => [f.id, f]));
  const dropped: ReportSummary["dropped"] = [];
  let checked = 0;

  // A claim survives if it cites at least one known fact and every number in it appears in a cited fact.
  const claim = (c: RawClaim | undefined, what: string): Claim | null => {
    if (!c?.text) return null;
    checked++;
    const cited = (c.factIds ?? []).map((id) => byId.get(id)).filter((f): f is Fact => !!f);
    if (!cited.length) {
      dropped.push({ what: `${what}: ${c.text}`, reason: "cites no known fact" });
      return null;
    }
    const known = new Set(cited.flatMap((f) => numbers(f.text)));
    const missing = numbers(c.text).filter((n) => !known.has(n));
    if (missing.length) {
      dropped.push({ what: `${what}: ${c.text}`, reason: `number ${missing.join(", ")} not found in the cited facts` });
      return null;
    }
    return { text: c.text, sources: dedupe(cited.flatMap((f) => f.sources)) };
  };

  const sizes: SizeFigure[] = [];
  for (const s of raw.sizes ?? []) {
    checked++;
    const what = `Size figure: ${s.publisher} ${s.year}`;
    const fact = byId.get(s.factId);
    if (!fact) {
      dropped.push({ what, reason: "cites no known fact" });
      continue;
    }
    const quote = norm(s.quote ?? "");
    if (!quote || !norm(fact.text).includes(quote)) {
      dropped.push({ what, reason: "quote not found word for word in the cited fact" });
      continue;
    }
    if (!numbers(s.quote).some((n) => Math.abs(n - s.amount) < 1e-9)) {
      dropped.push({ what, reason: `amount ${s.amount} not in the quote` });
      continue;
    }
    const marks = CURRENCY_MARKS[s.currency?.toUpperCase()] ?? [s.currency?.toLowerCase()];
    if (!s.currency || !marks.some((m) => m && quote.includes(m))) {
      dropped.push({ what, reason: `currency ${s.currency || "missing"} not stated in the quote` });
      continue;
    }
    // CAGR is kept only if the same fact states that percentage.
    const factText = norm(fact.text);
    const cagr =
      typeof s.cagrPercent === "number" && new RegExp(`${String(s.cagrPercent).replace(".", "\\.")}\\s?%`).test(factText)
        ? { percent: s.cagrPercent, period: s.cagrPeriod ?? "" }
        : null;
    // Fall back to the source's name when the fact does not name its publisher.
    const named = s.publisher && !/^(unspecified|unknown|n\/?a|not (stated|specified)|none)$/i.test(s.publisher.trim());
    sizes.push({
      factId: fact.id,
      publisher: named ? s.publisher : siteName(fact.sources[0]),
      scope: s.scope,
      kind: s.kind,
      year: s.year,
      value: { amount: s.amount * (SCALE[s.scale] ?? 1), currency: s.currency.toUpperCase() },
      cagr,
      quote: s.quote,
      sources: fact.sources,
    });
  }

  const insights: Insight[] = [];
  for (const i of raw.insights ?? []) {
    const c = claim({ text: `${i.title}. ${i.text}`, factIds: i.factIds }, "Insight");
    if (c) insights.push({ kind: i.kind, title: i.title, text: i.text, sources: c.sources });
  }

  return {
    model: LLM_MODEL,
    headline: claim(raw.headline, "Headline"),
    bullets: (raw.bullets ?? []).map((b) => claim(b, "Takeaway")).filter((b): b is Claim => !!b),
    sizes: sizes.sort((a, b) => a.year - b.year),
    insights,
    factCount: facts.length,
    checked,
    dropped,
  };
}

/** "https://www.giiresearch.com/report/…" → "giiresearch.com". */
function siteName(source?: Source) {
  if (!source) return "Unnamed source";
  try {
    return new URL(source.document).hostname.replace(/^www\./, "");
  } catch {
    return source.name.slice(0, 40);
  }
}

function dedupe(sources: Source[]) {
  return sources.filter((s, i, arr) => arr.findIndex((x) => x.document === s.document && x.name === s.name) === i);
}
