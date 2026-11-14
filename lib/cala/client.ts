import "server-only";
import { cacheLife } from "next/cache";
import type { Source } from "@/lib/types";

// Typed client for Cala's REST API (https://docs.cala.ai, OpenAPI at https://api.cala.ai/openapi.json).
// Server-only: the API key never reaches the browser.
// Caching: Next's "use cache" for now. Phase 2 moves this to a Supabase table so the cache survives deploys.

const BASE = "https://api.cala.ai";

export class CalaError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly kind: "missing_key" | "rate_limited" | "invalid_request" | "upstream",
  ) {
    super(message);
  }
}

/** Errors thrown inside "use cache" lose their class when serialised, so classify by message as well. */
export function calaErrorKind(e: unknown): CalaError["kind"] {
  if (e instanceof CalaError) return e.kind;
  const m = e instanceof Error ? e.message : String(e);
  if (/CALA_API_KEY|rejected the API key/.test(m)) return "missing_key";
  if (/rate limit/i.test(m)) return "rate_limited";
  if (/rejected the request/.test(m)) return "invalid_request";
  return "upstream";
}

/** Call before any cached Cala request so a missing key fails fast with a clear error. */
export function assertCalaKey() {
  if (!process.env.CALA_API_KEY) throw new CalaError("CALA_API_KEY is not set", 401, "missing_key");
}

export function mocksEnabled() {
  return process.env.USE_MOCKS === "true";
}

async function calaFetch<T>(path: string, init: { method: "GET" | "POST"; body?: unknown; query?: Record<string, string | string[] | number> }): Promise<T> {
  const key = process.env.CALA_API_KEY;
  if (!key) throw new CalaError("CALA_API_KEY is not set", 401, "missing_key");

  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(init.query ?? {})) {
    for (const item of Array.isArray(v) ? v : [v]) url.searchParams.append(k, String(item));
  }

  const res = await fetch(url, {
    method: init.method,
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) throw new CalaError("Cala rate limit exceeded", 429, "rate_limited");
    if (res.status === 401 || res.status === 403) throw new CalaError("Cala rejected the API key", res.status, "missing_key");
    if (res.status === 422) throw new CalaError(`Cala rejected the request: ${text.slice(0, 300)}`, 422, "invalid_request");
    throw new CalaError(`Cala returned ${res.status}: ${text.slice(0, 300)}`, res.status, "upstream");
  }
  return (await res.json()) as T;
}

// ---- Response types (only the fields we use) ----

export type CalaSource = {
  name: string;
  document: string | { endpoint: string; params?: unknown; response_hash?: string };
  date: string;
  date_precision?: "year" | "month" | "day" | null;
  source_rank?: string | null;
};

export type CalaProp<T> = { value: T; sources: CalaSource[] };

export type EntityMention = { id: string; name: string; entity_type: string; mentions?: string[] };

export type QueryResponse = { results: Record<string, unknown>[]; entities: EntityMention[] | null };

export type RelationshipEdge = {
  id: string;
  name: string;
  entity_type: string;
  properties: { sources?: CalaSource[]; role?: string; [k: string]: unknown };
};

export type GetEntityResponse = {
  id: string;
  name: string;
  entity_type: string;
  description?: string | null;
  properties: Record<string, CalaProp<unknown> | undefined>;
  relationships: { outgoing: Record<string, RelationshipEdge[]>; incoming: Record<string, RelationshipEdge[]> };
};

export type EntityQuery = {
  properties?: string[];
  relationships?: {
    outgoing?: Record<string, { limit?: number; offset?: number }>;
    incoming?: Record<string, { limit?: number; offset?: number }>;
  };
};

// ---- Endpoints ----

/**
 * POST /v1/knowledge/query: structured rows plus matched entities. Rows carry no sources.
 *
 * Not in "use cache": a query Cala has not seen before takes ~45–50s, which hits Next's 50s limit for
 * cached functions. Instead we keep an in-process cache (6h) that also merges concurrent identical
 * requests. Phase 2 moves this to Supabase so it survives restarts and is shared between instances.
 */
const QUERY_TTL_MS = 6 * 60 * 60 * 1000;
const queryCache = new Map<string, { at: number; promise: Promise<QueryResponse> }>();

export function knowledgeQuery(input: string): Promise<QueryResponse> {
  const now = performance.timeOrigin + performance.now();
  const hit = queryCache.get(input);
  if (hit && now - hit.at < QUERY_TTL_MS) return hit.promise;
  const promise = calaFetch<QueryResponse>("/v1/knowledge/query", { method: "POST", body: { input, return_entities: true } });
  queryCache.set(input, { at: now, promise });
  promise.catch(() => queryCache.delete(input)); // never cache failures
  return promise;
}

/** GET /v1/entities: fuzzy search by name. */
export async function searchEntities(name: string, entityTypes: string[] = [], limit = 20) {
  "use cache";
  cacheLife("hours");
  return calaFetch<{ entities: (EntityMention & { description?: string | null })[] }>("/v1/entities", {
    method: "GET",
    query: { name, limit, ...(entityTypes.length ? { entity_types: entityTypes } : {}) },
  });
}

/** POST /v1/entities/{id}: properties and relationships, each with sources. */
export async function retrieveEntity(id: string, query?: EntityQuery): Promise<GetEntityResponse> {
  "use cache";
  cacheLife("days");
  return calaFetch<GetEntityResponse>(`/v1/entities/${encodeURIComponent(id)}`, { method: "POST", body: query ?? {} });
}

/** GET /v1/entities/{id}/introspection: which properties and relationships exist for an entity. */
export async function introspectEntity(id: string) {
  "use cache";
  cacheLife("days");
  return calaFetch<{ properties: string[]; relationships: { outgoing: string[]; incoming: string[] } }>(
    `/v1/entities/${encodeURIComponent(id)}/introspection`,
    { method: "GET" },
  );
}

// ---- Helpers ----

const RANKS = new Set(["FILING", "PRIMARY", "PRESS", "AGGREGATOR"]);

/** Normalises a Cala source into our Source shape. Endpoint-style documents become their endpoint URL. */
export function toSource(s: CalaSource): Source {
  const document = typeof s.document === "string" ? s.document : (s.document?.endpoint ?? "");
  const rank = s.source_rank && RANKS.has(s.source_rank) ? (s.source_rank as Source["source_rank"]) : null;
  return { name: s.name, document, date: s.date, date_precision: s.date_precision ?? null, source_rank: rank };
}

export function toSources(list: CalaSource[] | undefined): Source[] {
  return (list ?? []).map(toSource);
}

/** Runs async work over items with a fixed number in flight, to stay under Cala's rate limit. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
