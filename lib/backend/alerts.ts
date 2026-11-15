import "server-only";
import type { Alert, AlertKind, Source } from "@/lib/types";
import { backendError, backendFetch } from "./client";

// Changes on watched entities, from /api/v1/alerts/ (snake_case). The backend's nightly scan creates them;
// the watch list shows them next to each entity. Clients only read them.
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
  sources: Source[];
};

/** When the watch list is checked: nightly at `time` in `timezone`. */
export type AlertSchedule = { time: string; timezone: string };

export type ScanResult = { entities: number; alerts_created: number; skipped: number; errors: Record<string, string> };

const toAlert = (a: ApiAlert): Alert => ({
  id: a.id,
  kind: a.kind,
  title: a.title,
  body: a.body,
  reason: a.reason || undefined,
  date: a.occurred_on,
  href: a.href || "/watchlist",
  calaId: a.cala_id || undefined,
  slush: a.event === "slush-2026",
  sources: a.sources,
});

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw await backendError(res);
  return res.json() as Promise<T>;
}

/** Newest first. */
export async function listAlerts(): Promise<Alert[]> {
  const body = await json<{ results: ApiAlert[] }>(await backendFetch("/alerts/?page_size=100"));
  return body.results.map(toAlert);
}

export async function getAlertSchedule(): Promise<AlertSchedule> {
  const s = await json<{ time: string; timezone: string }>(await backendFetch("/alerts/schedule/"));
  return { time: s.time, timezone: s.timezone };
}

/** Checks the watched companies and investors for changes now (one Cala lookup each, plus new rounds). */
export async function scanForChanges(): Promise<ScanResult> {
  return json<ScanResult>(await backendFetch("/alerts/scan/", { method: "POST" }));
}
