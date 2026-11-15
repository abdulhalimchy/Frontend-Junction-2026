import "server-only";
import { cookies } from "next/headers";
import type { Role, StartupSummary } from "@/lib/types";
import { listAlerts } from "@/lib/backend/alerts";
import { listStartups } from "@/lib/backend/startups";
import { STARTUP_COOKIE } from "@/lib/startup-cookie";
import { getDeckCheckById, getLatestDeckCheck, listDeckChecks } from "@/lib/backend/deck-checks";
import { profiles } from "@/lib/mocks/misc";
import { ACCOUNT_COOKIE, ROLE_COOKIE, parseAccount } from "@/lib/account";

export { ROLE_COOKIE };

/** The signed-in account's name and email (set by Google sign-in, lib/auth.ts), or null when signed out. */
export async function getAccount() {
  return parseAccount((await cookies()).get(ACCOUNT_COOKIE)?.value);
}

// getRole reads the role cookie, which mirrors the backend profile's role (set at sign-in, onboarding and by the
// founder/investor switch). getProfile below is the fixture persona, used only by the fixture pages (USE_MOCKS).

export async function getRole(): Promise<Role> {
  const store = await cookies();
  return store.get(ROLE_COOKIE)?.value === "investor" ? "investor" : "founder";
}

/** The persona profile for the role, with the signed-in account's name and email on top. */
export async function getProfile() {
  const base = profiles[await getRole()];
  const account = await getAccount();
  if (!account) return base;
  return { ...base, name: account.name || base.name, email: account.email || base.email };
}

/** Changes on the watched entities, newest first (created by the backend's nightly scan), or a readable error. */
export async function getChanges() {
  try {
    return { changes: await listAlerts(), error: null };
  } catch (e) {
    return { changes: [], error: e instanceof Error ? e.message : "Could not load changes." };
  }
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

/**
 * The deck check page's data: every past check (newest first) and the one to show, with its claims.
 * `wanted` is the check asked for in the URL (?check=); it is shown only when it is in this history, else the newest.
 */
export async function getDeckChecks(startupId?: string | null, wanted?: string) {
  try {
    const history = await listDeckChecks(startupId);
    const pick = history.find((h) => h.id === wanted) ?? history[0];
    return { history, result: pick ? await getDeckCheckById(pick.id) : null, error: null };
  } catch (e) {
    return { history: [], result: null, error: e instanceof Error ? e.message : "Could not load deck checks." };
  }
}

/** The startups the founder added, for the sidebar. */
export async function getStartups(): Promise<{ items: StartupSummary[]; error: string | null }> {
  try {
    const added = await listStartups();
    return { items: added.map((s) => ({ id: s.id, name: s.name, domain: s.domain })), error: null };
  } catch (e) {
    return { items: [], error: e instanceof Error ? e.message : "Could not load your startups." };
  }
}

/** Which startup "My startup" shows: the cookie's, when it is still in the list; else the first one; null when none. */
export async function getActiveStartupId(items: StartupSummary[]): Promise<string | null> {
  const id = (await cookies()).get(STARTUP_COOKIE)?.value;
  return id && items.some((s) => s.id === id) ? id : (items[0]?.id ?? null);
}
