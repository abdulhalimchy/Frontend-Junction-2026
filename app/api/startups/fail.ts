import { BackendError } from "@/lib/backend/client";

export function fail(e: unknown, fallback: string) {
  if (!(e instanceof BackendError)) console.error(`[api/startups] ${fallback}`, e);
  const err = e instanceof BackendError ? e : new BackendError(fallback, 500);
  return Response.json({ error: err.message }, { status: err.status >= 400 && err.status < 600 ? err.status : 500 });
}
