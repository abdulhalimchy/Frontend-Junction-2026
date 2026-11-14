import "server-only";
import { memoCala } from "@/lib/cala/client";
import type { Money, Source } from "@/lib/types";
import { backendError, backendFetch } from "./client";

// LLM steps of a market analysis, run by the backend (/api/v1/markets/), like deck checks. Cala stays here:
// the frontend fetches and caches the Cala facts, the backend writes and checks the text from them.

export type TokenUsage = { input: number; output: number; thinking: number; total: number };

/** LLM tokens the backend reported since this server started (shown by /api/dev/cala-usage). */
const g = globalThis as unknown as { __llmUsage?: TokenUsage & { calls: number } };
export const llmUsage = (g.__llmUsage ??= { calls: 0, input: 0, output: 0, thinking: 0, total: 0 });

function count(t?: TokenUsage) {
  if (!t) return;
  llmUsage.calls++;
  llmUsage.input += t.input;
  llmUsage.output += t.output;
  llmUsage.thinking += t.thinking;
  llmUsage.total += t.total;
  if (process.env.CALA_LOG === "1") console.log(`[llm] tokens in=${t.input} out=${t.output} thinking=${t.thinking}`);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await backendFetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw await backendError(res);
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------------------------------------
// Guard: is the typed text a market, a company or neither? Saves Cala credit, so it must never block work.

export type GuardVerdict = {
  kind: "market" | "company" | "not_market";
  reason: string;
  /** Short market descriptions the user may have meant (empty when the text is a market). */
  suggestions: string[];
  /** For markets: the standard name to analyse and cache under, so different wordings share one report. */
  canonical?: string;
};

const PASS: GuardVerdict = { kind: "market", reason: "", suggestions: [] };

/** Cached per text for 24h. If the backend or its LLM is unavailable, the search goes ahead. */
export async function checkMarketText(text: string, known: string[] = []): Promise<GuardVerdict> {
  const key = text.trim().replace(/\s+/g, " ").toLowerCase();
  try {
    return await memoCala(`guard:v3:${key}`, async () => {
      const { tokens, ...verdict } = await post<GuardVerdict & { tokens: TokenUsage }>("/markets/guard/", {
        text: text.slice(0, 120),
        known: known.slice(-120),
      });
      count(tokens);
      return verdict;
    });
  } catch (e) {
    console.warn(`[guard] skipped: ${e instanceof Error ? e.message : e}`);
    return PASS;
  }
}

// ---------------------------------------------------------------------------------------------------------
// Summary: written only from the numbered facts sent; the backend checks every claim against its facts.

export type Fact = { id: string; text: string; sources: Source[] };

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
  tokens?: TokenUsage;
  checked: number;
  dropped: { what: string; reason: string }[];
};

type ApiSummary = Omit<ReportSummary, "factCount" | "sizes"> & {
  fact_count: number;
  sizes: (Omit<SizeFigure, "factId"> & { fact_id: string })[];
};

export async function summariseMarket(input: { market: string; region: string; year: number; facts: Fact[] }): Promise<ReportSummary> {
  const { fact_count, sizes, ...s } = await post<ApiSummary>("/markets/summary/", input);
  count(s.tokens);
  return { ...s, factCount: fact_count, sizes: sizes.map(({ fact_id, ...z }) => ({ ...z, factId: fact_id })) };
}
