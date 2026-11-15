import type { Role } from "@/lib/types";

// Watch list shapes and labels, shared by server and client code. The data lives in the Django backend
// (/api/v1/watchlist/); lib/backend/watchlist.ts reads and writes it.

export type WatchEntityType = "company" | "investor" | "person";
export type WatchTag = "competitor" | "target_investor" | "partner" | "pipeline" | "portfolio" | "passed";

export type WatchItem = {
  id: string;
  entityType: WatchEntityType;
  calaId: string;
  name: string;
  tag: WatchTag | null;
  note: string;
  origin: "manual" | "suggested";
  createdAt: string;
  /** When the nightly scan last checked it in Cala; null until the first check. */
  lastCheckedAt: string | null;
  /** False for demo entries, which the nightly scan skips. */
  inCala: boolean;
};

export type WatchSummary = {
  total: number;
  byType: Partial<Record<WatchEntityType, number>>;
  byTag: Partial<Record<WatchTag, number>>;
};

/** Tags in display order. `roles` decides which ones a role is offered first; everyone can use all of them. */
export const WATCH_TAGS: { value: WatchTag; label: string; roles: Role[] }[] = [
  { value: "competitor", label: "Competitor", roles: ["founder", "investor"] },
  { value: "target_investor", label: "Target investor", roles: ["founder"] },
  { value: "partner", label: "Partner", roles: ["founder"] },
  { value: "pipeline", label: "Pipeline", roles: ["investor"] },
  { value: "portfolio", label: "Portfolio", roles: ["investor"] },
  { value: "passed", label: "Passed", roles: ["investor"] },
];

export const tagLabel = (tag: WatchTag | null) => WATCH_TAGS.find((t) => t.value === tag)?.label ?? "Saved";

export function watchHref(item: Pick<WatchItem, "entityType" | "calaId">) {
  if (item.entityType === "company") return `/company/${item.calaId}`;
  if (item.entityType === "investor") return `/investor/${item.calaId}`;
  return null; // no person page yet
}
