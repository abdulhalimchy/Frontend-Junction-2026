import "server-only";
import { memoCala } from "@/lib/cala/client";
import type { MarketCompany, Money, Source } from "@/lib/types";
import { backendError, backendFetch } from "./client";

// Market analysis runs in the backend (/api/v1/markets/): it asks Cala, has the LLM write and check the
// summary, and stores every report as the user's history. This file is the typed client for it.

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

// ---------------------------------------------------------------------------------------------------------
// Stored market analyses: the backend asks Cala, writes the summary, and keeps each report as the user's
// history. Opening a stored report spends no Cala credit; refresh re-asks Cala and updates it.


export type Evidence = { id: string; text: string; sources: Source[] };
/** A question answered by Cala: its markdown summary plus every fact it rests on, each with its origin. */
export type EvidenceSection = { question: string; summary: string; evidence: Evidence[]; fetchedAt?: number };
export type PlayersSection = { definition: string; companies: MarketCompany[]; unresolved: number; fetchedAt?: number };
export type SectionError = { message: string; kind: string };
export type SectionName = "size" | "deals" | "trends" | "players" | "summary";

export type MarketAnalysisRow = {
  id: string;
  sector: string;
  typed: string;
  region: string;
  year: number;
  status: "loading" | "ready" | "failed";
  runs: number;
  error: string;
  headline: string;
  playerCount: number;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
};

export type MarketAnalysis = MarketAnalysisRow & {
  startedAt: string | null;
  changes: string[];
  size?: EvidenceSection;
  deals?: EvidenceSection;
  trends?: EvidenceSection;
  players?: PlayersSection;
  summary?: ReportSummary & { fetchedAt?: number };
  errors: Partial<Record<SectionName, SectionError>>;
};

type ApiRow = {
  id: string;
  sector: string;
  typed: string;
  region: string;
  year: number;
  status: MarketAnalysisRow["status"];
  runs: number;
  error: string;
  headline: string;
  player_count: number;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
};
type WithFetched = { fetched_at?: number };
type ApiAnalysis = ApiRow & {
  started_at: string | null;
  changes: string[];
  data: {
    size?: EvidenceSection & WithFetched;
    deals?: EvidenceSection & WithFetched;
    trends?: EvidenceSection & WithFetched;
    players?: PlayersSection & WithFetched;
    summary?: ApiSummary & WithFetched;
    errors?: MarketAnalysis["errors"];
  };
};

function toRow(r: ApiRow): MarketAnalysisRow {
  return {
    id: r.id,
    sector: r.sector,
    typed: r.typed,
    region: r.region,
    year: r.year,
    status: r.status,
    runs: r.runs,
    error: r.error,
    headline: r.headline,
    playerCount: r.player_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    finishedAt: r.finished_at,
  };
}

function section<T extends object>(s: (T & WithFetched) | undefined): (T & { fetchedAt?: number }) | undefined {
  if (!s) return undefined;
  const { fetched_at, ...rest } = s;
  return { ...(rest as T), fetchedAt: fetched_at };
}

function toAnalysis(a: ApiAnalysis): MarketAnalysis {
  const d = a.data ?? {};
  let summary: MarketAnalysis["summary"];
  if (d.summary) {
    const { fact_count, sizes, fetched_at, ...s } = d.summary;
    summary = { ...s, factCount: fact_count, sizes: sizes.map(({ fact_id, ...z }) => ({ ...z, factId: fact_id })), fetchedAt: fetched_at };
  }
  return {
    ...toRow(a),
    startedAt: a.started_at,
    changes: a.changes ?? [],
    size: section(d.size),
    deals: section(d.deals),
    trends: section(d.trends),
    players: section(d.players),
    summary,
    errors: d.errors ?? {},
  };
}

async function call<T>(path: string, method: "GET" | "POST" | "DELETE", body?: unknown): Promise<T> {
  const res = await backendFetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw await backendError(res);
  return (res.status === 204 ? null : await res.json()) as T;
}

/**
 * Opens the analysis of typed market text: the backend checks the text (unless force), then returns the stored
 * analysis for that market, starting it if it never ran. analysis is null when the text is not a market.
 */
export async function openMarketAnalysis(input: { text: string; region: string; force?: boolean }) {
  const res = await call<{ verdict: GuardVerdict; analysis: ApiAnalysis | null }>("/markets/analyses/", "POST", input);
  return { verdict: res.verdict, analysis: res.analysis ? toAnalysis(res.analysis) : null };
}

export async function getMarketAnalysis(id: string) {
  return toAnalysis(await call<ApiAnalysis>(`/markets/analyses/${encodeURIComponent(id)}/`, "GET"));
}

export async function listMarketAnalyses() {
  return (await call<ApiRow[]>("/markets/analyses/", "GET")).map(toRow);
}

export async function refreshMarketAnalysis(id: string) {
  return toAnalysis(await call<ApiAnalysis>(`/markets/analyses/${encodeURIComponent(id)}/refresh/`, "POST"));
}

export async function deleteMarketAnalysis(id: string) {
  await call<null>(`/markets/analyses/${encodeURIComponent(id)}/`, "DELETE");
}

export async function clearMarketAnalyses() {
  return (await call<{ deleted: number }>("/markets/analyses/", "DELETE")).deleted;
}
