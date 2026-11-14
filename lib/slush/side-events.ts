import "server-only";
import { TTL, memoCala, searchEntities } from "@/lib/cala/client";
import { normaliseName } from "@/lib/names";
import data from "@/lib/slush-side-events.json";

// Slush Week 2026 side events. Cala has almost none of them, and Slush's own calendar sits behind its
// attendee login, so these are curated by hand from public listings (Luma, organiser pages). Each event
// keeps the URL it was read from and the day it was checked. Who attends is only what those pages say
// publicly: hosts, sponsors and speakers. Never guest lists.

export const SIDE_EVENT_TOPICS = [
  "AI",
  "Climate",
  "Life science",
  "Deeptech",
  "Defence",
  "Fintech",
  "SaaS",
  "Mobility",
  "Gaming",
  "Impact",
  "Diversity",
  "Ecosystem",
  "Investors",
] as const;
export type SideEventTopic = (typeof SIDE_EVENT_TOPICS)[number];

export const SIDE_EVENT_AUDIENCES = ["Founders", "Investors", "Corporates", "Students", "Everyone"] as const;
export type SideEventAudience = (typeof SIDE_EVENT_AUDIENCES)[number];

export type SideEventAccess = "open" | "invite-only" | "application" | "paid";

export type SideEvent = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  start: string | null; // HH:MM, Helsinki time
  end: string | null;
  venue: string | null;
  city: string;
  hosts: string[];
  speakers: { name: string; org: string | null }[];
  topics: SideEventTopic[];
  audience: SideEventAudience[];
  access: SideEventAccess | null;
  price: string | null;
  description: string;
  url: string;
  sourceName: string;
  checkedOn: string;
};

/** Every side event, by day and start time. Events without a start time go last within their day. */
export const SIDE_EVENTS: SideEvent[] = [...(data as SideEvent[])].sort(
  (a, b) => a.date.localeCompare(b.date) || (a.start ?? "99").localeCompare(b.start ?? "99") || a.title.localeCompare(b.title),
);

export const SIDE_EVENT_DAYS = [...new Set(SIDE_EVENTS.map((e) => e.date))].sort();

export type SideEventFilters = { day?: string; topic?: string; q?: string; going?: boolean };

export function filterSideEvents(events: SideEvent[], f: SideEventFilters, mine: Set<string>) {
  const needle = f.q ? normaliseName(f.q) : "";
  return events.filter(
    (e) =>
      (!f.day || e.date === f.day) &&
      (!f.topic || (e.topics as string[]).includes(f.topic)) &&
      (!f.going || mine.has(e.id)) &&
      (!needle ||
        [e.title, e.venue ?? "", e.description, ...e.hosts, ...e.speakers.flatMap((s) => [s.name, s.org ?? ""])].some((t) =>
          normaliseName(t).includes(needle),
        )),
  );
}

/** Organisations named on an event: hosts first, then speakers' organisations. */
export function eventOrgs(e: SideEvent): { name: string; role: "host" | "speaker" }[] {
  const seen = new Set<string>();
  const out: { name: string; role: "host" | "speaker" }[] = [];
  for (const [name, role] of [...e.hosts.map((h) => [h, "host"] as const), ...e.speakers.flatMap((s) => (s.org ? [[s.org, "speaker"] as const] : []))]) {
    const key = normaliseName(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ name, role });
  }
  return out;
}

export type OrgMatch = { name: string; calaId: string | null };

/**
 * The Cala company for an organisation name, on an exact (normalised) name match only, so a host never
 * links to a look-alike. Cached for 7 days.
 */
export function matchOrg(name: string): Promise<OrgMatch> {
  const target = normaliseName(name);
  return memoCala(
    `side-event-org:${target}`,
    async () => {
      const hits = await searchEntities(name.slice(0, 100), ["Company", "Organization"], 5);
      const hit = hits.entities.find((h) => normaliseName(h.name) === target);
      return { name, calaId: hit?.id ?? null };
    },
    TTL.entity,
  );
}
