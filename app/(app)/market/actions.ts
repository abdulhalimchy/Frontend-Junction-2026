"use server";

import { refresh } from "next/cache";
import { cancelMarketAnalysis, clearMarketAnalyses, deleteMarketAnalysis, refreshMarketAnalysis } from "@/lib/backend/markets";

// Market analysis history lives in the backend database. Phase 1: every request runs as the backend demo
// account (see lib/backend/client.ts), so the backend only ever touches that account's analyses.

type Result = { ok: true; count?: number; deleted?: boolean } | { ok: false; error: string };

async function run(fn: () => Promise<number | boolean | void>): Promise<Result> {
  try {
    const out = await fn();
    refresh();
    return { ok: true, count: typeof out === "number" ? out : undefined, deleted: typeof out === "boolean" ? out : undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

/** Stops a running analysis and rolls it back to the last saved result (a first run is removed). */
export async function cancelAnalysisAction(id: string) {
  return run(() => cancelMarketAnalysis(id));
}

/** Re-asks Cala and rewrites the summary; the stored report is updated section by section. */
export async function refreshAnalysisAction(id: string) {
  return run(async () => {
    await refreshMarketAnalysis(id);
  });
}

export async function deleteAnalysisAction(id: string) {
  return run(() => deleteMarketAnalysis(id));
}

/** Deletes every stored analysis of this account from the database. */
export async function clearHistoryAction() {
  return run(() => clearMarketAnalyses());
}
