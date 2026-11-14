"use server";

import { refresh } from "next/cache";
import { markAlertRead, markAllAlertsRead, scanForChanges } from "@/lib/backend/alerts";

// Phase 1: these run as the backend demo account (see lib/backend/client.ts); the backend only touches that
// account's alerts.

const message = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

export async function markReadAction(id: string) {
  try {
    await markAlertRead(id);
    refresh();
  } catch {
    // Opening an alert must never fail because the read flag could not be saved.
  }
}

export async function markAllReadAction() {
  try {
    const n = await markAllAlertsRead();
    refresh();
    return { ok: true as const, marked: n };
  } catch (e) {
    return { ok: false as const, error: message(e) };
  }
}

export async function scanAction() {
  try {
    const result = await scanForChanges();
    refresh();
    return { ok: true as const, result };
  } catch (e) {
    return { ok: false as const, error: message(e) };
  }
}
