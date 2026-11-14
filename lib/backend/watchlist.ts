import "server-only";
import type { WatchEntityType, WatchItem, WatchSummary, WatchTag } from "@/lib/watchlist";
import { backendError, backendFetch } from "./client";

// Shapes returned by /api/v1/watchlist/ (snake_case).
type ApiWatchItem = {
  id: string;
  entity_type: WatchEntityType;
  cala_id: string;
  name: string;
  tag: WatchTag | "";
  note: string;
  origin: WatchItem["origin"];
  created_at: string;
};

const toItem = (w: ApiWatchItem): WatchItem => ({
  id: w.id,
  entityType: w.entity_type,
  calaId: w.cala_id,
  name: w.name,
  tag: w.tag || null,
  note: w.note,
  origin: w.origin,
  createdAt: w.created_at,
});

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw await backendError(res);
  return res.json() as Promise<T>;
}

/** The whole list (the backend pages at 100 by default; a watch list stays well under that for now). */
export async function listWatchItems(filters: { type?: WatchEntityType; tag?: WatchTag | "none"; calaId?: string } = {}) {
  const params = new URLSearchParams({ page_size: "100" });
  if (filters.type) params.set("type", filters.type);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.calaId) params.set("cala_id", filters.calaId);
  const body = await json<{ results: ApiWatchItem[] }>(await backendFetch(`/watchlist/?${params}`));
  return body.results.map(toItem);
}

export async function findWatchItem(entityType: WatchEntityType, calaId: string): Promise<WatchItem | null> {
  return (await listWatchItems({ type: entityType, calaId }))[0] ?? null;
}

export async function getWatchSummary(): Promise<WatchSummary> {
  const s = await json<{ total: number; by_type: WatchSummary["byType"]; by_tag: WatchSummary["byTag"] }>(
    await backendFetch("/watchlist/summary/"),
  );
  return { total: s.total, byType: s.by_type, byTag: s.by_tag };
}

export async function addWatchItem(input: { entityType: WatchEntityType; calaId: string; name: string; tag?: WatchTag | null }) {
  const res = await backendFetch("/watchlist/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entity_type: input.entityType, cala_id: input.calaId, name: input.name, tag: input.tag ?? "" }),
  });
  return toItem(await json<ApiWatchItem>(res));
}

export async function updateWatchItem(id: string, patch: { tag?: WatchTag | null; note?: string }) {
  const body: Record<string, string> = {};
  if (patch.tag !== undefined) body.tag = patch.tag ?? "";
  if (patch.note !== undefined) body.note = patch.note;
  const res = await backendFetch(`/watchlist/${encodeURIComponent(id)}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return toItem(await json<ApiWatchItem>(res));
}

export async function removeWatchItem(id: string) {
  const res = await backendFetch(`/watchlist/${encodeURIComponent(id)}/`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw await backendError(res);
}
