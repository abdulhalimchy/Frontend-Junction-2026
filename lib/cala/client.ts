import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Source } from "@/lib/types";

// Typed client for Cala's REST API (https://docs.cala.ai, OpenAPI at https://api.cala.ai/openapi.json).
// Server-only: the API key never reaches the browser.
// Caching: Next's "use cache" for now. Phase 2 moves this to a Supabase table so the cache survives deploys.

const BASE = "https://api.cala.ai";

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

/** Call before any cached Cala request so a missing key fails fast with a clear error. */
export function assertCalaKey() {
  if (!process.env.CALA_API_KEY) throw new CalaError("CALA_API_KEY is not set", 401, "missing_key");
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Real Cala network calls per endpoint since the server started (cache hits are not counted). Kept on
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

async function calaFetch<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown; query?: Record<string, string | string[] | number>; unlimited?: boolean /* true = knowledge lane */ },
): Promise<T> {
  const key = process.env.CALA_API_KEY;
  if (!key) throw new CalaError("CALA_API_KEY is not set", 401, "missing_key");
  if ((gb.__calaNoCreditUntil ?? 0) > performance.timeOrigin + performance.now()) {
    throw new CalaError("Cala credit balance is empty (paused new calls for 10 minutes)", 402, "no_credit");
  }

  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(init.query ?? {})) {
    for (const item of Array.isArray(v) ? v : [v]) url.searchParams.append(k, String(item));
  }

  // Requests go through a per-lane limit, and rate limits or transient server errors are retried with
  // growing waits, so a page that needs many lookups slows down instead of failing.
  let res: Response;
  for (let attempt = 0; ; attempt++) {
    const name = endpointName(url.pathname, init.method);
    calaUsage[name] = (calaUsage[name] ?? 0) + 1;
    const lane = init.unlimited ? knowledgeLimit : entityLimit;
    await lane.acquire();
    try {
      res = await fetch(url, {
        method: init.method,
        headers: { "X-API-KEY": key, "Content-Type": "application/json" },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        // A hung request must not hold a page (or a lane slot) forever.
        signal: AbortSignal.timeout(init.unlimited ? 120_000 : 30_000),
      });
    } catch (e) {
      if (attempt < 1 && e instanceof Error && e.name === "TimeoutError") continue; // one retry
      throw new CalaError(e instanceof Error && e.name === "TimeoutError" ? "Cala did not answer in time" : `Could not reach Cala: ${String(e)}`, 504, "upstream");
    } finally {
      lane.release();
    }
    if (process.env.CALA_LOG === "1") console.log(`[cala] ${name} ${url.pathname}${url.search} -> ${res.status}`);
    // Retry rate limits (up to 3 times) and transient server errors such as 502 (up to 2 times).
    const retryable = res.status === 429 ? attempt < 3 : res.status >= 500 && attempt < 2;
    if (!retryable) break;
    await res.body?.cancel();
    const retryAfter = Number(res.headers.get("retry-after"));
    await sleep(retryAfter > 0 ? Math.min(retryAfter, 10) * 1000 : 1000 * 2 ** attempt);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) throw new CalaError("Cala rate limit exceeded", 429, "rate_limited");
    if (res.status === 402) {
      gb.__calaNoCreditUntil = performance.timeOrigin + performance.now() + CREDIT_PAUSE_MS;
      throw new CalaError("Cala credit balance is empty", 402, "no_credit");
    }
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

export function memoCala<T>(key: string, load: () => Promise<T>, ttl = TTL.knowledge): Promise<T> {
  const now = performance.timeOrigin + performance.now();
  const hit = knowledgeCache.get(key);
  if (hit && now - hit.at < ttl) return hit.promise as Promise<T>;
  const promise = fromDisk<T>(key, now, ttl).then(async (saved) => {
    if (saved) return saved.value;
    const value = await load();
    await toDisk(key, { at: now, value });
    return value;
  });
  knowledgeCache.set(key, { at: now, promise });
  promise.catch(() => knowledgeCache.delete(key));
  return promise;
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
export function knowledgeQuery(input: string): Promise<QueryResponse> {
  return memoCala(`query:${input}`, () =>
    calaFetch<QueryResponse>("/v1/knowledge/query", { method: "POST", body: { input, return_entities: true }, unlimited: true }),
  );
}

export type KnowBit = {
  id: string;
  content: string;
  origins: { source: { name: string; url: string }; document: { name: string; url: string } }[];
};
export type SearchAnswer = { content: string; context: KnowBit[]; entities: EntityMention[] | null };

/** POST /v1/knowledge/search: a markdown answer plus the facts (KnowBits) it rests on, each with its origin URLs. */
export function knowledgeSearch(input: string): Promise<SearchAnswer> {
  return memoCala(`search:${input}`, () =>
    calaFetch<SearchAnswer>("/v1/knowledge/search", {
      method: "POST",
      body: { input, explainability: false, return_entities: true },
      unlimited: true,
    }),
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
export function retrieveEntity(id: string, query?: EntityQuery): Promise<GetEntityResponse> {
  return memoCala(
    `entity:${id}|${JSON.stringify(query ?? {})}`,
    () => calaFetch<GetEntityResponse>(`/v1/entities/${encodeURIComponent(id)}`, { method: "POST", body: query ?? {} }),
    TTL.entity,
  );
}

/** GET /v1/entities/{id}/introspection: which properties and relationships exist for an entity. */
export function introspectEntity(id: string) {
  return memoCala(`introspection:${id}`, () => calaFetch<{ properties: string[]; relationships: { outgoing: string[]; incoming: string[] } }>(
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
