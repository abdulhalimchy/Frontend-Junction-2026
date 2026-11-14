"use server";

import { refresh } from "next/cache";
import { addRsvp, removeRsvp } from "@/lib/backend/rsvps";
import { SIDE_EVENTS } from "@/lib/slush/side-events";

// Phase 1: runs as the backend demo account (see lib/backend/client.ts).

const EVENT = "slush-2026";

export async function setGoingAction(sideEventId: string, going: boolean) {
  if (!SIDE_EVENTS.some((e) => e.id === sideEventId)) return { ok: false as const, error: "Unknown side event." };
  try {
    if (going) await addRsvp(EVENT, sideEventId);
    else await removeRsvp(EVENT, sideEventId);
    refresh();
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
