import "server-only";
import { cookies } from "next/headers";
import type { Role, StartupSummary } from "@/lib/types";
import { getCompany } from "@/lib/cala";
import { getUnreadCount, listAlerts } from "@/lib/backend/alerts";
import { listStartups } from "@/lib/backend/startups";
import { DEMO_STARTUP_ID, STARTUP_COOKIE } from "@/lib/startup-cookie";
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

/**
 * The latest deck check from the backend, or a readable error when the backend is unavailable.
 * startupId: one startup's decks; null: decks not tied to a startup (the demo company); omitted: all (investor view).
 */
export async function getDeckCheck(startupId?: string | null) {
  try {
    return { result: await getLatestDeckCheck(startupId), error: null };
  } catch (e) {
    return { result: null, error: e instanceof Error ? e.message : "Could not load deck checks." };
  }
}

/** The founder's startups for the sidebar: the demo persona's company first, then the ones they added. */
export async function getStartups(): Promise<{ items: StartupSummary[]; error: string | null }> {
  const profile = await getProfile();
  const demo = profile.companyId ? await getCompany(profile.companyId) : null;
  const items: StartupSummary[] = demo ? [{ id: DEMO_STARTUP_ID, name: demo.name, domain: demo.domain, demo: true }] : [];
  try {
    const added = await listStartups();
    return { items: [...items, ...added.map((s) => ({ id: s.id, name: s.name, domain: s.domain }))], error: null };
  } catch (e) {
    return { items, error: e instanceof Error ? e.message : "Could not load your startups." };
  }
}

/** Which startup "My startup" shows: the cookie's, when it is still in the list; else the demo. */
export async function getActiveStartupId(items?: StartupSummary[]): Promise<string> {
  const id = (await cookies()).get(STARTUP_COOKIE)?.value ?? DEMO_STARTUP_ID;
  return !items || items.some((s) => s.id === id) ? id : (items[0]?.id ?? DEMO_STARTUP_ID);
}
