// The signed-in account's name and email, for display. Set by Google sign-in (app/api/auth/google) in an
// httpOnly cookie, so only the server reads it (lib/session.ts). The backend is the source of truth.

import type { Role } from "./types";

export const ACCOUNT_COOKIE = "wl_account";

/** The founder or investor view. The backend profile's role is the source of truth; this cookie mirrors it. */
export const ROLE_COOKIE = "wl_role";
export const roleCookieOptions = { path: "/", sameSite: "lax" as const, maxAge: 60 * 60 * 24 * 365 };

/** Where each side lands after onboarding or a switch of role. */
export const ROLE_HOME: Record<Role, string> = { founder: "/startup/overview", investor: "/portfolio" };

export type Account = { name: string; email: string };

export function parseAccount(raw: string | undefined): Account | null {
  if (!raw) return null;
  for (const text of [raw, safeDecode(raw)]) {
    try {
      const v = JSON.parse(text) as Partial<Account>;
      if (v && typeof v === "object")
        return { name: typeof v.name === "string" ? v.name : "", email: typeof v.email === "string" ? v.email : "" };
    } catch {
      /* try the decoded form next */
    }
  }
  return null;
}

function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
