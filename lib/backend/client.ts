import "server-only";
import { connection } from "next/server";

// Server-side client for the Django API (../Backend-Junction-2026). The browser never sees the JWT:
// pages and route handlers call this, and the route handlers under app/api/ proxy what the UI needs.
//
// Phase 1 auth: the app has no real sign-in yet (the sign-in page is a demo), so every request runs as one
// demo account, logged in (or registered on first use) from BACKEND_DEMO_EMAIL / BACKEND_DEMO_PASSWORD.
// Replace `getToken` with the signed-in user's token when real auth lands.

const BASE = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/$/, "");
const API = `${BASE}/api/v1`;

export class BackendError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

let token: { access: string; at: number } | null = null;
const TOKEN_TTL_MS = 10 * 60 * 1000; // backend access tokens last 15 minutes by default

async function authenticate(): Promise<string> {
  const email = process.env.BACKEND_DEMO_EMAIL;
  const password = process.env.BACKEND_DEMO_PASSWORD;
  if (!email || !password) throw new BackendError("BACKEND_DEMO_EMAIL and BACKEND_DEMO_PASSWORD are not set (see .env.example)", 500);

  const post = (path: string, body: unknown) =>
    fetch(`${API}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });

  let res = await post("/accounts/auth/login/", { email, password }).catch(unreachable);
  if (res.status === 401) res = await post("/accounts/auth/register/", { email, password, full_name: "Demo user", role: "founder" }).catch(unreachable);
  if (!res.ok) throw new BackendError(`Backend sign-in failed (${res.status}). Check BACKEND_DEMO_EMAIL / BACKEND_DEMO_PASSWORD.`, res.status);
  const { access } = (await res.json()) as { access: string };
  token = { access, at: Date.now() };
  return access;
}

function unreachable(): never {
  throw new BackendError(`Cannot reach the backend at ${BASE}. Is it running? (python manage.py runserver)`, 503);
}

async function getToken(force = false) {
  return !force && token && Date.now() - token.at < TOKEN_TTL_MS ? token.access : authenticate();
}

/** Authenticated fetch against /api/v1. Retries once with a fresh token on 401. */
export async function backendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  // Backend data is per user and per request: never prerender it (Cache Components would otherwise trip
  // over Date.now() in the token cache).
  await connection();
  const send = async (force: boolean) =>
    fetch(`${API}${path}`, {
      ...init,
      cache: "no-store",
      headers: { ...init.headers, Authorization: `Bearer ${await getToken(force)}` },
    }).catch(unreachable);
  const res = await send(false);
  return res.status === 401 ? send(true) : res;
}

/** The backend's error envelope is { error: { message, details } }. */
export async function backendError(res: Response): Promise<BackendError> {
  const body = await res.json().catch(() => null);
  const details = body?.error?.details;
  const first = details && typeof details === "object" ? Object.values(details).flat()[0] : null;
  return new BackendError(typeof first === "string" ? first : (body?.error?.message ?? `Backend returned ${res.status}`), res.status);
}
