import "server-only";
import type { Alert, AlertKind, Source } from "@/lib/types";
import { backendError, backendFetch } from "./client";

// Alerts from /api/v1/alerts/ (snake_case). The backend's alert scan creates them; clients only read them
// and mark them read.
type ApiAlert = {
  id: string;
  kind: AlertKind;
  title: string;
  body: string;
  reason: string;
  href: string;
  event: string | null;
  occurred_on: string;
  is_read: boolean;
  sources: Source[];
};

export type ScanResult = { entities: number; alerts_created: number; skipped: number; errors: Record<string, string> };

const toAlert = (a: ApiAlert): Alert => ({
  id: a.id,
  kind: a.kind,
  title: a.title,
  body: a.body,
  reason: a.reason || undefined,
  date: a.occurred_on,
  read: a.is_read,
  href: a.href || "/alerts",
  slush: a.event === "slush-2026",
  sources: a.sources,
});

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw await backendError(res);
  return res.json() as Promise<T>;
}

export async function listAlerts(): Promise<Alert[]> {
  const body = await json<{ results: ApiAlert[] }>(await backendFetch("/alerts/?page_size=100"));
  return body.results.map(toAlert);
}

export async function getUnreadCount(): Promise<number> {
  return (await json<{ unread: number }>(await backendFetch("/alerts/unread-count/"))).unread;
}

export async function markAlertRead(id: string) {
  await json(await backendFetch(`/alerts/${encodeURIComponent(id)}/read/`, { method: "POST" }));
}

export async function markAllAlertsRead() {
  return (await json<{ marked_read: number }>(await backendFetch("/alerts/read-all/", { method: "POST" }))).marked_read;
}

/** Checks the watched companies and investors for changes now (one Cala lookup each, plus new rounds). */
export async function scanForChanges(): Promise<ScanResult> {
  return json<ScanResult>(await backendFetch("/alerts/scan/", { method: "POST" }));
}
