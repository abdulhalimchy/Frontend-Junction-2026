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
  entity_type: string;
  cala_id: string;
  event: string | null;
  occurred_on: string;
  is_read: boolean;
  sources: Source[];
};

type ApiScanRun = {
  trigger: "nightly" | "manual" | "watch" | "command";
  status: "ok" | "failed";
  started_at: string;
  finished_at: string | null;
  entities: number;
  alerts_created: number;
  skipped: number;
};

export type ScanRun = { status: ApiScanRun["status"]; at: string; entities: number; alertsCreated: number };

/** When the watch list is checked: nightly at `time` in `timezone`. */
export type AlertSchedule = { time: string; timezone: string; nextRunAt: string; lastNightly: ScanRun | null; lastManual: ScanRun | null };

const toRun = (r: ApiScanRun | null): ScanRun | null =>
  r && { status: r.status, at: r.finished_at ?? r.started_at, entities: r.entities, alertsCreated: r.alerts_created };

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
  calaId: a.cala_id || undefined,
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

export async function getAlertSchedule(): Promise<AlertSchedule> {
  const s = await json<{ time: string; timezone: string; next_run_at: string; last_nightly: ApiScanRun | null; last_manual: ApiScanRun | null }>(
    await backendFetch("/alerts/schedule/"),
  );
  return { time: s.time, timezone: s.timezone, nextRunAt: s.next_run_at, lastNightly: toRun(s.last_nightly), lastManual: toRun(s.last_manual) };
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
