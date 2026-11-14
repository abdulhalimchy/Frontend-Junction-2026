import "server-only";
import { cookies } from "next/headers";
import type { Role } from "@/lib/types";
import { getLatestDeckCheck } from "@/lib/backend/deck-checks";
import { alerts, metByRole, profiles } from "@/lib/mocks/misc";

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

export async function getAlerts() {
  const role = await getRole();
  return alerts.filter((a) => a.roles.includes(role)).sort((a, b) => b.date.localeCompare(a.date));
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
