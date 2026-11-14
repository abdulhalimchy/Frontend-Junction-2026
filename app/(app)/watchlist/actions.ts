"use server";

import { refresh } from "next/cache";
import { addWatchItem, removeWatchItem, updateWatchItem } from "@/lib/backend/watchlist";
import type { WatchEntityType, WatchItem, WatchTag } from "@/lib/watchlist";

// Phase 1: every request runs as the backend demo account (see lib/backend/client.ts), and the backend only
// ever touches that account's items. When real sign-in lands, backendFetch carries the user's own token.

type Result = { ok: true; item: WatchItem | null } | { ok: false; error: string };

async function run(fn: () => Promise<WatchItem | null>): Promise<Result> {
  try {
    const item = await fn();
    refresh();
    return { ok: true, item };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function watchAction(input: { entityType: WatchEntityType; calaId: string; name: string; tag?: WatchTag | null }) {
  return run(() => addWatchItem(input));
}

export async function unwatchAction(id: string) {
  return run(async () => {
    await removeWatchItem(id);
    return null;
  });
}

export async function updateWatchAction(id: string, patch: { tag?: WatchTag | null; note?: string }) {
  return run(() => updateWatchItem(id, patch));
}
