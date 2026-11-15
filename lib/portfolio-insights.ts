import type { PortfolioAnalysis, PortfolioAnalysisKind } from "@/lib/types";

/** Portfolio analyses by company id, then kind. Built on the server, read by the client panels. */
export type AnalysisIndex = Record<string, Partial<Record<PortfolioAnalysisKind, PortfolioAnalysis>>>;

export function indexAnalyses(list: PortfolioAnalysis[]): AnalysisIndex {
  const out: AnalysisIndex = {};
  for (const a of list) (out[a.company] ??= {})[a.kind] = a;
  return out;
}
