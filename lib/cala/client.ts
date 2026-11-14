import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { backendFetchShared } from "@/lib/backend/client";
import type { Source } from "@/lib/types";

// Typed client for Cala's REST API (https://docs.cala.ai). The frontend never calls Cala itself: every request
// goes through the backend's Cala gateway (/api/v1/cala/…), which holds the API key and forwards only the
// endpoints below. This file keeps the request shapes, the cache and the error kinds the pages rely on.

export class CalaError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly kind: "missing_key" | "rate_limited" | "invalid_request" | "no_credit" | "upstream",
  ) {
    super(message);
  }
}

/** Errors thrown inside "use cache" lose their class when serialised, so classify by message as well. */
export function calaErrorKind(e: unknown): CalaError["kind"] {
  if (e instanceof CalaError) return e.kind;
  const m = e instanceof Error ? e.message : String(e);
  if (/CALA_API_KEY|rejected the API key/.test(m)) return "missing_key";
  if (/credit balance|Insufficient balance|returned 402/i.test(m)) return "no_credit";
  if (/rate limit/i.test(m)) return "rate_limited";
  if (/rejected the request/.test(m)) return "invalid_request";
  return "upstream";
}

export function mocksEnabled() {
  return process.env.USE_MOCKS === "true";
}

/** A tiny semaphore: at most `max` callers hold a slot at once. */
function limiter(max: number) {
  let inFlight = 0;
  const waiting: (() => void)[] = [];
  return {
    acquire(): Promise<void> {
      if (inFlight < max) {
        inFlight++;
        return Promise.resolve();
      }
      return new Promise((resolve) => waiting.push(resolve)); // slot handed over by release()
    },
    release() {
      const next = waiting.shift();
      if (next) next();
      else inFlight--;
    },
  };
}

// Entity calls are fast and numerous; knowledge calls are slow (~45–60s) and few. Separate limits keep a
// report's long questions from blocking its entity lookups while staying under Cala's rate limit.
const entityLimit = limiter(4);
const knowledgeLimit = limiter(6); // a report asks 6 questions; Cala accepted 6 in parallel in testing

/**
 * Cala requests per endpoint since the server started (cache hits are not counted). Kept on
 * globalThis because pages and route handlers load separate copies of this module.
 */
const g = globalThis as unknown as { __calaUsage?: Record<string, number> };
export const calaUsage: Record<string, number> = (g.__calaUsage ??= {});

function endpointName(path: string, method: string) {
  if (path.startsWith("/v1/knowledge/search")) return "knowledge_search";
  if (path.startsWith("/v1/knowledge/query")) return "knowledge_query";
  if (path.endsWith("/introspection")) return "entity_introspection";
  if (path === "/v1/entities") return "entity_search";
  if (path.startsWith("/v1/entities/lookup")) return "entity_lookup";
  return method === "POST" ? "entity_retrieval" : "other";
}

// After Cala reports an empty credit balance (402), stop calling for a while instead of failing every
// request one by one. Cached results keep working. Shared process-wide like the cache.
const CREDIT_PAUSE_MS = 10 * 60 * 1000;
const gb = globalThis as unknown as { __calaNoCreditUntil?: number };

const KINDS = new Set<CalaError["kind"]>(["missing_key", "rate_limited", "invalid_request", "no_credit", "upstream"]);

/**
 * One Cala request, sent through the backend gateway. The backend retries Cala's rate limits and transient
 * errors itself, so a failure here is final; it comes back as { error: { code, message } } with code set to
 * one of our error kinds.
 */
async function calaFetch<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown; query?: Record<string, string | string[] | number>; unlimited?: boolean /* true = knowledge lane */ },
): Promise<T> {
  if ((gb.__calaNoCreditUntil ?? 0) > performance.timeOrigin + performance.now()) {
    throw new CalaError("Cala credit balance is empty (paused new calls for 10 minutes)", 402, "no_credit");
  }

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(init.query ?? {})) {
    for (const item of Array.isArray(v) ? v : [v]) params.append(k, String(item));
  }
  const name = endpointName(path, init.method);
  calaUsage[name] = (calaUsage[name] ?? 0) + 1;

  // Requests go through a per-lane limit so a page that needs many lookups queues instead of flooding.
  const lane = init.unlimited ? knowledgeLimit : entityLimit;
  await lane.acquire();
  let res: Response;
  try {
    res = await backendFetchShared(`/cala${path}${params.size ? `?${params}` : ""}`, {
      method: init.method,
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      // A hung request must not hold a page (or a lane slot) forever. The backend retries, so allow for that.
      signal: AbortSignal.timeout(init.unlimited ? 240_000 : 90_000),
    });
  } catch (e) {
    const timeout = e instanceof Error && e.name === "TimeoutError";
    throw new CalaError(timeout ? "The data source did not answer in time" : e instanceof Error ? e.message : String(e), timeout ? 504 : 503, "upstream");
  } finally {
    lane.release();
  }
  if (process.env.CALA_LOG === "1") console.log(`[cala] ${name} ${path}${params.size ? `?${params}` : ""} -> ${res.status}`);

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    const code = body?.error?.code as CalaError["kind"] | undefined;
    const kind: CalaError["kind"] = code && KINDS.has(code) ? code : "upstream";
    const message = body?.error?.message ?? `Backend returned ${res.status} for a Cala request`;
    if (kind === "no_credit") gb.__calaNoCreditUntil = performance.timeOrigin + performance.now() + CREDIT_PAUSE_MS;
    throw new CalaError(message, res.status, kind);
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
  numerical_observations?: NumericalObservation[];
};

/** A metric time series (e.g. annual revenue from SEC filings); each point names the filing it came from. */
export type NumericalObservation = {
  type: string;
  id: string;
  name: string;
  properties: { unit?: string; cadence?: string };
  data: {
    time: string;
    value: number;
    origin?: { name?: string; url?: string; source?: string; published_time?: string; method?: string };
  }[];
};

/** Metrics available for an entity, from introspection: pass their ids back to retrieveEntity to get values. */
export type ObservationInfo = { id: string; name: string; cadence: string; unit?: string; taxonomy?: string };

export type EntityQuery = {
  properties?: string[];
  relationships?: {
    outgoing?: Record<string, { limit?: number; offset?: number }>;
    incoming?: Record<string, { limit?: number; offset?: number }>;
  };
  /** Keyed by observation type (e.g. CuratedFinancialMetric), values are metric ids from introspection. */
  numerical_observations?: Record<string, string[]>;
};

// ---- Endpoints ----

/**
 * One cache for every Cala call (and the report summary), so each distinct request is paid for once:
 * - in memory, so identical requests in flight at the same time share one call (Next renders a page
 *   several times in development, and "use cache" does not merge in-flight requests);
 * - on disk (CALA_CACHE_DIR, default .cache/cala), so a restart does not spend credits again.
 * Failures are never cached. Phase 2 moves the disk layer to Supabase so servers share it.
 */
const HOUR = 60 * 60 * 1000;
export const TTL = { knowledge: 24 * HOUR, search: 24 * HOUR, entity: 7 * 24 * HOUR };
const CACHE_DIR = process.env.CALA_CACHE_DIR || path.join(process.cwd(), ".cache", "cala");
// On globalThis: pages and route handlers load separate copies of this module, and they must share one cache.
const gc = globalThis as unknown as { __calaCache?: Map<string, { at: number; promise: Promise<unknown> }> };
const knowledgeCache = (gc.__calaCache ??= new Map());

/**
 * Returns the cached value for `key`, or loads and caches it. `maxAge` (e.g. for a user-requested refresh)
 * shortens the lifetime for this read only, so a refresh refetches once and repeated renders within the
 * window share that one fetch.
 */
export function memoCala<T>(key: string, load: () => Promise<T>, ttl = TTL.knowledge, maxAge?: number): Promise<T> {
  const now = performance.timeOrigin + performance.now();
  const life = Math.min(ttl, maxAge ?? ttl);
  const hit = knowledgeCache.get(key);
  if (hit && now - hit.at < life) return hit.promise as Promise<T>;
  const entry: { at: number; promise: Promise<unknown> } = { at: now, promise: Promise.resolve() };
  const promise = fromDisk<T>(key, now, life).then(async (saved) => {
    if (saved) {
      entry.at = saved.at; // keep the original fetch time, so pages can say how old the data is
      return saved.value;
    }
    const value = await load();
    entry.at = performance.timeOrigin + performance.now();
    await toDisk(key, { at: entry.at, value });
    return value;
  });
  entry.promise = promise;
  knowledgeCache.set(key, entry);
  promise.catch(() => knowledgeCache.delete(key));
  return promise;
}

/** When the cached value for `key` was fetched from Cala (ms since epoch); call after awaiting it. */
export function calaFetchedAt(key: string): number | undefined {
  return knowledgeCache.get(key)?.at;
}

function cacheFile(key: string) {
  return path.join(CACHE_DIR, `${createHash("sha256").update(key).digest("hex").slice(0, 32)}.json`);
}

async function fromDisk<T>(key: string, now: number, ttl: number): Promise<{ at: number; value: T } | null> {
  try {
    const saved = JSON.parse(await readFile(cacheFile(key), "utf8")) as { key: string; at: number; value: T };
    return saved.key === key && now - saved.at < ttl ? saved : null;
  } catch {
    return null; // missing or unreadable: ask Cala
  }
}

async function toDisk(key: string, entry: { at: number; value: unknown }) {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(cacheFile(key), JSON.stringify({ key, ...entry }));
  } catch {
    // Read-only filesystems (e.g. serverless) just keep the in-memory cache.
  }
}

/** POST /v1/knowledge/query: structured rows plus matched entities. Rows carry no sources. */
export function knowledgeQuery(input: string, maxAge?: number): Promise<QueryResponse> {
  return memoCala(
    `query:${input}`,
    () => calaFetch<QueryResponse>("/v1/knowledge/query", { method: "POST", body: { input, return_entities: true }, unlimited: true }),
    TTL.knowledge,
    maxAge,
  );
}

export type KnowBit = {
  id: string;
  content: string;
  origins: { source: { name: string; url: string }; document: { name: string; url: string } }[];
};
export type SearchAnswer = { content: string; context: KnowBit[]; entities: EntityMention[] | null };

/** POST /v1/knowledge/search: a markdown answer plus the facts (KnowBits) it rests on, each with its origin URLs. */
export function knowledgeSearch(input: string, maxAge?: number): Promise<SearchAnswer> {
  return memoCala(
    `search:${input}`,
    () =>
      calaFetch<SearchAnswer>("/v1/knowledge/search", {
        method: "POST",
        body: { input, explainability: false, return_entities: true },
        unlimited: true,
      }),
    TTL.knowledge,
    maxAge,
  );
}

/** GET /v1/entities: fuzzy search by name. */
export function searchEntities(name: string, entityTypes: string[] = [], limit = 20) {
  const key = `entities:${name.toLowerCase()}|${[...entityTypes].sort().join(",")}|${limit}`;
  return memoCala(key, () => calaFetch<{ entities: (EntityMention & { description?: string | null })[] }>("/v1/entities", {
    method: "GET",
    query: { name, limit, ...(entityTypes.length ? { entity_types: entityTypes } : {}) },
  }), TTL.search);
}

/** POST /v1/entities/{id}: properties and relationships, each with sources. */
export function retrieveEntity(id: string, query?: EntityQuery, ttl = TTL.entity): Promise<GetEntityResponse> {
  return memoCala(
    `entity:${id}|${JSON.stringify(query ?? {})}`,
    () => calaFetch<GetEntityResponse>(`/v1/entities/${encodeURIComponent(id)}`, { method: "POST", body: query ?? {} }),
    ttl,
  );
}

/** GET /v1/entities/{id}/introspection: which properties and relationships exist for an entity. */
export function introspectEntity(id: string) {
  return memoCala(`introspection:${id}`, () => calaFetch<{
    properties: string[];
    relationships: { outgoing: string[]; incoming: string[] };
    numerical_observations?: Record<string, ObservationInfo[]>;
  }>(
    `/v1/entities/${encodeURIComponent(id)}/introspection`,
    { method: "GET" },
  ), TTL.entity);
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
