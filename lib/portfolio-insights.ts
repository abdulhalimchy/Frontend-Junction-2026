import type { PortfolioAnalysis, PortfolioAnalysisKind } from "@/lib/types";

/** Portfolio analyses by company id, then kind. Built on the server, read by the client panels. */
export type AnalysisIndex = Record<string, Partial<Record<PortfolioAnalysisKind, PortfolioAnalysis>>>;

export function indexAnalyses(list: PortfolioAnalysis[]): AnalysisIndex {
  const out: AnalysisIndex = {};
  for (const a of list) (out[a.company] ??= {})[a.kind] = a;
  return out;
}

/**
 * An error message fit to show. Backend messages that name the data provider are replaced by a plain one;
 * anything else (validation messages, "already in your portfolio") is shown as is.
 */
export function plainError(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (!msg) return fallback;
  if (!/\bcala\b/i.test(msg)) return msg;
  if (/rate limit/i.test(msg)) return "Too many lookups at once. Try again in a minute.";
  if (/credit/i.test(msg)) return "The data source is out of credit. Try again later.";
  if (/not configured|api[_ ]key/i.test(msg)) return "The data source is not set up on the server.";
  return fallback;
}
