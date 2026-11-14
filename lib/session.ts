import "server-only";
import { cookies } from "next/headers";
import type { Role } from "@/lib/types";
import { alerts, deckChecks, metByRole, profiles } from "@/lib/mocks/misc";

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

export async function getDeckCheck(companyId: string) {
  return deckChecks[companyId] ?? null;
}
