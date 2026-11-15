import { Suspense } from "react";
import { BookmarkCheck, CalendarDays, Clock, ExternalLink, MapPin, Mic, Search as SearchIcon, Star } from "lucide-react";
import Link from "next/link";
import { SuggestInput } from "@/components/warmline/suggest-input";
import { Pill, SlushTag } from "@/components/warmline/badges";
import { EmptyState, Panel } from "@/components/warmline/blocks";
import { getRsvps, type RsvpSummary } from "@/lib/backend/rsvps";
import { listWatchItems } from "@/lib/backend/watchlist";
import { fetchSlush } from "@/lib/cala/slush";
import { formatDay } from "@/lib/format";
import { normaliseName } from "@/lib/names";
import {
  SEARCH_SUGGESTIONS,
  SIDE_EVENTS,
  SIDE_EVENT_DAYS,
  SIDE_EVENT_TOPICS,
  eventOrgs,
  filterSideEvents,
  matchOrg,
  type SideEvent,
  type SideEventFilters,
} from "@/lib/slush/side-events";
import type { WatchItem } from "@/lib/watchlist";
import { cn } from "@/lib/utils";
import { GoingButton } from "./going-button";

// The "Side events" tab: a guide to Slush Week side events, who is publicly named on each (hosts, sponsors,
// speakers), which of them the user watches or are on Slush's attendee list, and the user's own "I'm going".

const BASE = "/events/slush-2026/side-events";
const ACCESS_LABEL = { open: "Open", "invite-only": "Invite only", application: "Apply to join", paid: "Paid" } as const;

type Ctx = {
  rsvps: RsvpSummary;
  rsvpError: string | null;
  watched: Map<string, WatchItem>; // by normalised name
  watchedIds: Set<string>;
  atSlush: Set<string>; // normalised names on Cala's Slush 2026 attendee list
  live: boolean;
};

export async function SideEventsTab({ filters, live }: { filters: SideEventFilters; live: boolean }) {
  const [rsvpRes, watchRes, slushRes] = await Promise.allSettled([
    getRsvps("slush-2026"),
    listWatchItems(),
    live ? fetchSlush() : Promise.reject(new Error("mocks")),
  ]);
  const watchItems = watchRes.status === "fulfilled" ? watchRes.value : [];
  const ctx: Ctx = {
    rsvps: rsvpRes.status === "fulfilled" ? rsvpRes.value : { mine: [], counts: {} },
    rsvpError: rsvpRes.status === "rejected" ? (rsvpRes.reason instanceof Error ? rsvpRes.reason.message : "Backend unavailable") : null,
    watched: new Map(watchItems.map((w) => [normaliseName(w.name), w])),
    watchedIds: new Set(watchItems.map((w) => w.calaId)),
    atSlush: new Set(slushRes.status === "fulfilled" ? slushRes.value.attendees.map((a) => normaliseName(a.name)) : []),
    live,
  };
  const mine = new Set(ctx.rsvps.mine);
  const shown = filterSideEvents(SIDE_EVENTS, filters, mine);
  const fromWatchlist = SIDE_EVENTS.filter((e) => eventOrgs(e).some((o) => ctx.watched.has(normaliseName(o.name))));
  const unfiltered = !filters.day && !filters.topic && !filters.q && !filters.going;
  const checked = SIDE_EVENTS.map((e) => e.checkedOn).sort().at(-1);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slush/40 bg-slush-soft/40 px-5 py-4 text-[13px] leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">{SIDE_EVENTS.length} side events from public listings</span>
        {checked && <> · checked {formatDay(checked)}</>}. Slush Week has 600+ side events; the full calendar is in the Slush app for pass
        holders. Each event links to where it is listed. “Who’s there” is who those pages name: hosts, sponsors and speakers, not guest lists.
      </div>

      <Filters filters={filters} goingCount={mine.size} />

      {unfiltered && fromWatchlist.length > 0 && (
        <Panel title="Hosted by companies and investors you watch" description="Side events where someone on your watch list is a host, sponsor or speaker.">
          <ul className="divide-y">
            {fromWatchlist.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="w-24 shrink-0 text-xs text-muted-foreground tabular">
                  {formatDay(e.date)}
                  {e.start && ` · ${e.start}`}
                </span>
                <a href={`#${e.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-primary">
                  {e.title}
                </a>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {eventOrgs(e)
                    .filter((o) => ctx.watched.has(normaliseName(o.name)))
                    .map((o) => o.name)
                    .join(", ")}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {shown.length === 0 ? (
        <EmptyState
          icon={filters.going ? CalendarDays : SearchIcon}
          title={filters.going ? "Nothing in your week yet" : "No side events match"}
          description={filters.going ? "Press “I'm going” on a side event to add it here." : "Try another day or topic, or clear the search."}
        />
      ) : (
        SIDE_EVENT_DAYS.filter((d) => shown.some((e) => e.date === d)).map((day) => (
          <section key={day}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="size-4 text-slush" /> {weekday(day)}, {formatDay(day)}
              {day === "2026-11-17" && <SlushTag label="Day 0" />}
              <span className="font-normal text-muted-foreground">· {shown.filter((e) => e.date === day).length}</span>
            </h2>
            <div className="space-y-3">
              {shown
                .filter((e) => e.date === day)
                .map((e) => (
                  <EventCard key={e.id} e={e} ctx={ctx} />
                ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function EventCard({ e, ctx }: { e: SideEvent; ctx: Ctx }) {
  const orgs = eventOrgs(e);
  return (
    <article id={e.id} className="scroll-mt-20 rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgba(22,24,26,0.04)]">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {e.start && (
              <span className="flex items-center gap-1 tabular">
                <Clock className="size-3.5" /> {e.start}
                {e.end && `–${e.end}`}
              </span>
            )}
            {e.venue && (
              <span className="flex min-w-0 items-center gap-1">
                <MapPin className="size-3.5 shrink-0" /> <span className="truncate">{e.venue}</span>
              </span>
            )}
            {e.access && <Pill tone={e.access === "open" ? "success" : "neutral"}>{ACCESS_LABEL[e.access]}</Pill>}
            {e.price && <span>{e.price}</span>}
          </div>
          <h3 className="mt-1.5 text-[15px] font-semibold tracking-tight">
            <a href={e.url} target="_blank" rel="noreferrer" className="hover:text-primary">
              {e.title}
            </a>
          </h3>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{e.description}</p>
          {(e.topics.length > 0 || e.audience.length > 0) && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {e.topics.map((t) => (
                <Pill key={t} tone="teal">
                  {t}
                </Pill>
              ))}
              {e.audience.map((a) => (
                <Pill key={a}>For {a.toLowerCase()}</Pill>
              ))}
            </div>
          )}
        </div>
        <GoingButton id={e.id} title={e.title} going={ctx.rsvps.mine.includes(e.id)} count={ctx.rsvps.counts[e.id] ?? 0} unavailable={ctx.rsvpError ?? undefined} />
      </div>

      {(orgs.length > 0 || e.speakers.length > 0) && (
        <div className="mt-4 border-t pt-3">
          <div className="mb-2 text-[11px] font-medium tracking-wide text-subtle uppercase">Who’s there</div>
          <div className="flex flex-wrap gap-1.5">
            {orgs.map((o) => (
              <Suspense key={o.name} fallback={<OrgChip name={o.name} role={o.role} ctx={ctx} />}>
                <LinkedOrgChip name={o.name} role={o.role} ctx={ctx} />
              </Suspense>
            ))}
          </div>
          {e.speakers.length > 0 && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Mic className="mt-0.5 size-3.5 shrink-0" />
              <span>{e.speakers.map((s) => (s.org ? `${s.name} (${s.org})` : s.name)).join(" · ")}</span>
            </p>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-1 text-[11px] text-subtle">
        <a href={e.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary">
          <ExternalLink className="size-3" /> {e.sourceName}
        </a>
        <span>· checked {formatDay(e.checkedOn)}</span>
      </div>
    </article>
  );
}

/** Org chip linked to its Cala company page when Cala has an exact name match (live mode only). */
async function LinkedOrgChip({ name, role, ctx }: { name: string; role: "host" | "speaker"; ctx: Ctx }) {
  if (!ctx.live) return <OrgChip name={name} role={role} ctx={ctx} />;
  const m = await matchOrg(name).catch(() => null);
  return <OrgChip name={name} role={role} ctx={ctx} calaId={m?.calaId ?? null} />;
}

function OrgChip({ name, role, ctx, calaId }: { name: string; role: "host" | "speaker"; ctx: Ctx; calaId?: string | null }) {
  const key = normaliseName(name);
  const watched = ctx.watched.has(key) || (!!calaId && ctx.watchedIds.has(calaId));
  const atSlush = ctx.atSlush.has(key);
  const body = (
    <>
      {watched && <BookmarkCheck className="size-3 text-primary" />}
      <span>{name}</span>
      <span className="text-subtle">{role === "host" ? "host" : "speaker"}</span>
      {atSlush && <Star className="size-3 fill-slush text-slush" aria-label="On the Slush 2026 attendee list" />}
    </>
  );
  const cls = cn(
    "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium",
    watched ? "border-primary/40 bg-teal-soft text-accent-foreground" : "bg-card",
  );
  const title = [watched && "On your watch list", atSlush && "On the Slush 2026 attendee list"].filter(Boolean).join(" · ") || undefined;
  return calaId ? (
    <Link href={`/company/${calaId}`} className={cn(cls, "hover:border-primary/40 hover:text-primary")} title={title}>
      {body}
    </Link>
  ) : (
    <span className={cls} title={title}>
      {body}
    </span>
  );
}

function Filters({ filters, goingCount }: { filters: SideEventFilters; goingCount: number }) {
  const href = (patch: Partial<Record<keyof SideEventFilters, string | undefined>>) => {
    const next = { day: filters.day, topic: filters.topic, q: filters.q, going: filters.going ? "1" : undefined, ...patch };
    const qs = new URLSearchParams(Object.entries(next).filter((kv): kv is [string, string] => !!kv[1]));
    return qs.size ? `${BASE}?${qs}` : BASE;
  };
  const usedTopics = SIDE_EVENT_TOPICS.filter((t) => SIDE_EVENTS.some((e) => (e.topics as string[]).includes(t)));
  return (
    <div className="space-y-3">
      <form action={BASE} className="relative">
        {filters.day && <input type="hidden" name="day" value={filters.day} />}
        {filters.topic && <input type="hidden" name="topic" value={filters.topic} />}
        {filters.going && <input type="hidden" name="going" value="1" />}
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
        <SuggestInput name="q" defaultValue={filters.q} options={SEARCH_SUGGESTIONS} placeholder="Search side events, hosts, speakers or venues" className="h-11 rounded-xl bg-card pl-10 text-[15px]" />
      </form>
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip href={href({ going: filters.going ? undefined : "1" })} active={!!filters.going}>
          <CalendarDays className="size-3.5" /> My week{goingCount > 0 && ` · ${goingCount}`}
        </Chip>
        <span className="mx-1 h-4 w-px bg-border" />
        <Chip href={href({ day: undefined })} active={!filters.day}>
          All days
        </Chip>
        {SIDE_EVENT_DAYS.map((d) => (
          <Chip key={d} href={href({ day: d })} active={filters.day === d}>
            {weekday(d).slice(0, 3)} {Number(d.slice(8))}
          </Chip>
        ))}
      </div>
      {usedTopics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <Chip href={href({ topic: undefined })} active={!filters.topic}>
            All topics
          </Chip>
          {usedTopics.map((t) => (
            <Chip key={t} href={href({ topic: t })} active={filters.topic === t}>
              {t}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function weekday(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "Europe/Helsinki" });
}
