import "server-only";
import type { Source } from "@/lib/types";
import { cite, type CitedSource } from "./citations";
import { CalaError, TTL, assertCalaKey, knowledgeSearch, memoCala, retrieveEntity, searchEntities, toSources } from "./client";
import { normaliseName } from "@/lib/names";

// Slush 2026 from Cala's event graph. The event is an `Event` entity; attendees are its incoming
// PARTICIPATES_IN_EVENT relationships (all typed Company, each sourced to slush.org). Cala has no
// investor flag on attendees, so this module does not guess one.

/** Cala's entity for Slush 2026 (entity_search "Slush 2026", type Event). */
export const SLUSH_2026_CALA_ID = "bc844d56-6ab4-452b-96bf-2661e86e592b";

const PAGE = 1000; // Cala's largest relationship page
const MAX_PAGES = 10;

export type SlushAttendee = {
  /** Entity id from the attendance edge. Some point at merged entities; resolveAttendee fixes those. */
  id: string;
  name: string;
  role: string; // ATTENDEE or ORGANIZER
  sources: Source[];
  /** Earliest source date: when Cala first saw this company on the attendee list. */
  firstSeen: string | null;
};

export type SlushEvent = {
  id: string;
  name: string;
  date: { value: string | null; sources: Source[] };
  location: { value: string | null; sources: Source[] };
  description: string | null;
  attendees: SlushAttendee[];
  /** Sources behind the attendee list as a whole (deduplicated by document). */
  listSources: Source[];
  /** Attendees (not the organiser) Cala first saw on the list in the last 7 days. */
  addedLast7Days: number;
};

/** The event and every attendee. Refreshed daily: a few large calls, cached for 24 hours. */
export async function fetchSlush(): Promise<SlushEvent> {
  assertCalaKey();
  const [event, attendees] = await Promise.all([
    retrieveEntity(SLUSH_2026_CALA_ID, { properties: ["name", "event_date", "location", "description"] }, TTL.knowledge),
    loadAttendees(),
  ]);
  const p = event.properties;
  const str = (k: string) => (typeof p[k]?.value === "string" ? (p[k]!.value as string) : null);

  // Same clock as the Cala cache (client.ts): Date.now() is not allowed while Next prerenders.
  const now = performance.timeOrigin + performance.now();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const seen = new Set<string>();
  const listSources: Source[] = [];
  for (const a of attendees)
    for (const s of a.sources)
      if (!seen.has(s.document)) {
        seen.add(s.document);
        listSources.push(s);
      }

  return {
    id: event.id,
    name: event.name,
    date: { value: str("event_date"), sources: toSources(p.event_date?.sources) },
    location: { value: str("location"), sources: toSources(p.location?.sources) },
    description: str("description") ?? event.description ?? null,
    attendees,
    listSources,
    addedLast7Days: attendees.filter((a) => a.role !== "ORGANIZER" && a.firstSeen && a.firstSeen >= weekAgo).length,
  };
}

async function loadAttendees(): Promise<SlushAttendee[]> {
  const out: SlushAttendee[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await retrieveEntity(
      SLUSH_2026_CALA_ID,
      { properties: ["id"], relationships: { incoming: { PARTICIPATES_IN_EVENT: { limit: PAGE, offset: page * PAGE } } } },
      TTL.knowledge,
    );
    const edges = res.relationships?.incoming?.PARTICIPATES_IN_EVENT ?? [];
    for (const e of edges) {
      const sources = toSources(e.properties.sources);
      const dates = sources.map((s) => s.date).filter(Boolean).sort();
      out.push({ id: e.id, name: e.name, role: String(e.properties.role ?? "ATTENDEE"), sources, firstSeen: dates[0] ?? null });
    }
    if (edges.length < PAGE) break;
  }
  // The same company can be listed twice; keep one row per entity.
  return [...new Map(out.map((a) => [a.id, a])).values()];
}

export type ResolvedAttendee = {
  /** Entity id to link to, or null when Cala has no retrievable entity for this attendee. */
  id: string | null;
  description: string | null;
  hq: string | null;
  website: string | null;
  sources: Source[];
};

/**
 * Description and HQ for one attendee. Some attendance edges point at entity ids Cala has since merged
 * (retrieve returns 404); those fall back to an exact-name entity search. Cached for 7 days.
 */
export function resolveAttendee(a: { id: string; name: string }): Promise<ResolvedAttendee> {
  return memoCala(
    `slush-attendee:${a.id}`,
    async () => {
      const direct = await describe(a.id);
      if (direct) return direct;
      const hits = await searchEntities(a.name.slice(0, 100), ["Company", "Organization"], 5);
      const target = normaliseName(a.name);
      const match = hits.entities.find((h) => normaliseName(h.name) === target);
      if (!match) return { id: null, description: null, hq: null, website: null, sources: [] };
      return (await describe(match.id)) ?? { id: match.id, description: match.description ?? null, hq: null, website: null, sources: [] };
    },
    TTL.entity,
  );
}

async function describe(id: string): Promise<ResolvedAttendee | null> {
  try {
    const e = await retrieveEntity(id, { properties: ["description", "headquarters_address", "website"] });
    const p = e.properties;
    const val = (k: string) => (typeof p[k]?.value === "string" && (p[k]!.value as string).trim() ? (p[k]!.value as string) : null);
    return {
      id: e.id,
      description: val("description") || e.description || null,
      hq: val("headquarters_address"),
      website: val("website"),
      sources: toSources([...(p.description?.sources ?? []), ...(p.headquarters_address?.sources ?? [])]),
    };
  } catch (err) {
    if (err instanceof CalaError && err.status === 404) return null;
    throw err;
  }
}

/**
 * Investors at Slush 2026, as Cala's written answer with the documents it rests on. The attendee list
 * cannot answer this (no investor flag), and knowledge_query's firm list carries no sources, so this uses
 * knowledge_search: every sentence is tied to the facts it rests on. ~60s uncached, then cached for 24h.
 */
export async function fetchSlushInvestors(): Promise<{ answer: string; sources: CitedSource[] }> {
  assertCalaKey();
  const res = await knowledgeSearch("Which venture capital firms and investors are attending or speaking at Slush 2026 in Helsinki?");
  return cite(res.content, res.context ?? [], "Slush 2026 Helsinki");
}

/** Ids and normalised names of every attendee, for "attends Slush" tags elsewhere (e.g. search). */
export async function slushAttendeeIndex(): Promise<{ ids: Set<string>; names: Set<string> }> {
  const { attendees } = await fetchSlush();
  return { ids: new Set(attendees.map((a) => a.id)), names: new Set(attendees.map((a) => normaliseName(a.name))) };
}
