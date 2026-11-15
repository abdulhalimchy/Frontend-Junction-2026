// Sign-in state, kept in httpOnly cookies the browser's scripts cannot read:
// - wl_access / wl_refresh: the backend's JWTs for the signed-in user (Google sign-in, app/api/auth/google).
// - wl_account: the name and email to show, from the same sign-in.
// proxy.ts refreshes the access token before it expires; lib/backend/client.ts sends it to the backend.
// Imported by proxy.ts and route handlers, so nothing here may use next/headers or server-only modules.

import type { NextResponse } from "next/server";
import { ACCOUNT_COOKIE, type Account } from "./account";

export const ACCESS_COOKIE = "wl_access";
export const REFRESH_COOKIE = "wl_refresh";
export const AUTH_COOKIES = [ACCESS_COOKIE, REFRESH_COOKIE, ACCOUNT_COOKIE];

const BACKEND = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/$/, "");
export const BACKEND_API = `${BACKEND}/api/v1`;

/** Matches the backend's refresh token lifetime (JWT_REFRESH_DAYS, 7 by default). */
const SESSION_SECONDS = 60 * 60 * 24 * 7;

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_SECONDS,
};

export type Tokens = { access: string; refresh: string };

/** Seconds since the epoch at which the JWT expires, read without verifying it (the backend verifies). */
export function tokenExpiry(jwt: string | undefined): number | null {
  const part = jwt?.split(".")[1];
  if (!part) return null;
  try {
    const exp = (JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: unknown }).exp;
    return typeof exp === "number" ? exp : null;
  } catch {
    return null;
  }
}

/** True while the access token has more than a minute left. */
export function isFresh(access: string | undefined) {
  const exp = tokenExpiry(access);
  return exp !== null && exp - 60 > Date.now() / 1000;
}

/** A new token pair from the refresh token (the backend rotates refresh tokens), or null when it is no longer valid. */
export async function refreshTokens(refresh: string): Promise<Tokens | null> {
  try {
    const res = await fetch(`${BACKEND_API}/accounts/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as Partial<Tokens>;
    return body.access ? { access: body.access, refresh: body.refresh ?? refresh } : null;
  } catch {
    return null;
  }
}

/** Writes the sign-in cookies onto a response. */
export function setSession(res: NextResponse, tokens: Tokens, account?: Account) {
  res.cookies.set(ACCESS_COOKIE, tokens.access, cookieOptions);
  res.cookies.set(REFRESH_COOKIE, tokens.refresh, cookieOptions);
  if (account) res.cookies.set(ACCOUNT_COOKIE, JSON.stringify(account), cookieOptions);
}

export function clearSession(res: NextResponse) {
  for (const name of AUTH_COOKIES) res.cookies.delete(name);
}
