import "server-only";
import { cookies } from "next/headers";
import type { Role } from "@/lib/types";
import { getUnreadCount, listAlerts } from "@/lib/backend/alerts";
import { getLatestDeckCheck } from "@/lib/backend/deck-checks";
import { metByRole, profiles } from "@/lib/mocks/misc";

// Phase 1: the role lives in a cookie so it can be switched from the UI.
// Phase 2 reads the signed-in user and their profile from Supabase instead.

export const ROLE_COOKIE = "wl_role";

export async function getRole(): Promise<Role> {
  const store = await cookies();
  return store.get(ROLE_COOKIE)?.value === "investor" ? "investor" : "founder";
}

export async function getProfile() {
  return profiles[await getRole()];
}

/** The user's alerts from the backend (created by its alert scan), or a readable error. */
export async function getAlerts() {
  try {
    return { alerts: await listAlerts(), error: null };
  } catch (e) {
    return { alerts: [], error: e instanceof Error ? e.message : "Could not load alerts." };
  }
}

/** For the sidebar badge. 0 when the backend is unavailable, so the shell never fails over a badge. */
export async function getUnread() {
  return getUnreadCount().catch(() => 0);
}

export async function getMet() {
  return metByRole[await getRole()];
}

/** The latest deck check from the backend, or a readable error when the backend is unavailable. */
export async function getDeckCheck() {
  try {
    return { result: await getLatestDeckCheck(), error: null };
  } catch (e) {
    return { result: null, error: e instanceof Error ? e.message : "Could not load deck checks." };
  }
}
