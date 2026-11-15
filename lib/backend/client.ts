import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { ACCESS_COOKIE, BACKEND_API } from "@/lib/auth";

// Server-side client for the Django API (../Backend-Junction-2026). The browser never sees the JWT: pages and
// route handlers call this, and the route handlers under app/api/ proxy what the UI needs.
//
// Requests run as the signed-in user: their access token is in an httpOnly cookie (lib/auth.ts), kept fresh by
// proxy.ts. Cala gateway calls are shared across users (lib/cala/client.ts caches them), so they carry the
// server's CALA_GATEWAY_KEY instead of a user token.

const API = BACKEND_API;

export class BackendError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function unreachable(): never {
  throw new BackendError(`Cannot reach the backend at ${API}. Is it running? (python manage.py runserver)`, 503);
}

/** Authenticated fetch against /api/v1, as the signed-in user. */
export async function backendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  // Backend data is per user and per request: never prerender it.
  await connection();
  const access = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!access) throw new BackendError("You are signed out. Sign in again.", 401);
  const res = await send(path, init, { Authorization: `Bearer ${access}` });
  if (res.status === 401) throw new BackendError("Your session has ended. Sign in again.", 401);
  return res;
}

/**
 * Fetch for the Cala gateway (lib/cala/client.ts), without marking the render dynamic or tying the request to
 * one user: its results are shared across renders and users by the Cala cache.
 */
export function backendFetchShared(path: string, init: RequestInit = {}): Promise<Response> {
  const key = process.env.CALA_GATEWAY_KEY;
  if (!key) throw new BackendError("CALA_GATEWAY_KEY is not set (see .env.example)", 500);
  return send(path, init, { "X-Gateway-Key": key });
}

function send(path: string, init: RequestInit, auth: Record<string, string>): Promise<Response> {
  return fetch(`${API}${path}`, { ...init, cache: "no-store", headers: { ...init.headers, ...auth } }).catch((e: unknown) => {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) throw e;
    return unreachable();
  });
}

/** The backend's error envelope is { error: { message, details } }. */
export async function backendError(res: Response): Promise<BackendError> {
  const body = await res.json().catch(() => null);
  const details = body?.error?.details;
  const first = details && typeof details === "object" ? Object.values(details).flat()[0] : null;
  return new BackendError(typeof first === "string" ? first : (body?.error?.message ?? `Backend returned ${res.status}`), res.status);
}
