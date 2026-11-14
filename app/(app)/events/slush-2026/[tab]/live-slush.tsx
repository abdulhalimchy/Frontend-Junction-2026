import { Suspense } from "react";
import { Building2, CalendarDays, Landmark, MapPin, Search as SearchIcon, Sparkles } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SlushTag } from "@/components/warmline/badges";
import { EmptyState, EntityAvatar, FactGrid, PageHeader, Panel, StatCard, TabNav } from "@/components/warmline/blocks";
import { Markdown } from "@/components/warmline/markdown";
import { SourceChip } from "@/components/warmline/source-chip";
import type { CitedSource } from "@/lib/cala/citations";
import { calaErrorKind } from "@/lib/cala/client";
import { normaliseName } from "@/lib/names";
import { fetchSlush, fetchSlushInvestors, resolveAttendee, type SlushAttendee } from "@/lib/cala/slush";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";

// Live Slush 2026 event space (USE_MOCKS is not "true"). Everything shown comes from Cala with its sources.

export const LIVE_TABS = ["overview", "attendees", "investors"] as const;
export type LiveTab = (typeof LIVE_TABS)[number];

const PER_PAGE = 25;

export async function LiveSlush({ tab, q, page }: { tab: LiveTab; q: string; page: number }) {
  let e: Awaited<ReturnType<typeof fetchSlush>>;
  try {
    e = await fetchSlush();
  } catch (err) {
    return <CalaProblem error={err} />;
  }
  const attendees = e.attendees.filter((a) => a.role !== "ORGANIZER");
  const newest = [...attendees].sort((a, b) => (b.firstSeen ?? "").localeCompare(a.firstSeen ?? "") || a.name.localeCompare(b.name));

  return (
    <>
      <div className="mb-6 overflow-hidden rounded-2xl border border-slush/40 bg-card">
        <div className="h-1.5 bg-slush" />
        <div className="p-6">
          <PageHeader
            eyebrow={<SlushTag label="Event space" />}
            title={e.name}
            description="Attendees come from Cala's event graph and refresh daily. Use this to plan who to meet."
          >
            <div className="mt-4 flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
              {e.date.value && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-4" /> {formatDay(e.date.value)}
                  <SourceChip sources={e.date.sources} />
                </span>
              )}
              {e.location.value && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4" /> {e.location.value}
                  <SourceChip sources={e.location.sources} />
                </span>
              )}
            </div>
          </PageHeader>
        </div>
      </div>
      <TabNav
        active={tab}
        tabs={[
          { key: "overview", label: "Overview", href: "/events/slush-2026/overview" },
          { key: "attendees", label: "Attendees", href: "/events/slush-2026/attendees", count: attendees.length },
          { key: "investors", label: "Investors", href: "/events/slush-2026/investors" },
        ]}
      />

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Companies on the attendee list" value={attendees.length.toLocaleString("en")} icon={Building2} sources={e.listSources} tone="slush" />
            <StatCard
              label="Added in the last 7 days"
              value={e.addedLast7Days.toLocaleString("en")}
              hint="By the date Cala first saw them on the list"
              icon={Sparkles}
              sources={e.listSources}
              tone="slush"
            />
            <StatCard
              label="Investors"
              value={<Link href="/events/slush-2026/investors" className="text-base font-medium text-primary hover:underline">See who is coming →</Link>}
              hint="Cala does not mark investors on the attendee list"
              icon={Landmark}
              tone="slush"
            />
          </div>
          <AttendeeSearch q="" />
          <Panel title="Recently added" description="Newest first, by the date Cala first saw them on the attendee list.">
            <AttendeeList attendees={newest.slice(0, 10)} />
            <div className="mt-3 text-right">
              <Link href="/events/slush-2026/attendees" className="text-[13px] font-medium text-primary hover:underline">
                All {attendees.length.toLocaleString("en")} attendees →
              </Link>
            </div>
          </Panel>
          <Panel title="About the event">
            <FactGrid
              facts={[
                ...(e.location.value ? [{ label: "Venue", value: e.location.value, sources: e.location.sources }] : []),
                ...(e.date.value ? [{ label: "Starts", value: formatDay(e.date.value), sources: e.date.sources }] : []),
                ...(e.description ? [{ label: "Description", value: e.description }] : []),
                { label: "Cala event ID", value: <code className="text-xs">{e.id}</code> },
              ]}
            />
          </Panel>
        </div>
      )}

      {tab === "attendees" && <AttendeesTab attendees={newest} q={q} page={page} />}

      {tab === "investors" && (
        <Panel
          title="Investors at Slush 2026"
          description="Cala's attendee list types every attendee as a company and does not mark investors, so this is Cala's written answer. Each sentence links to the documents it rests on."
        >
          <Suspense fallback={<AnswerSkeleton />}>
            <InvestorsAnswer />
          </Suspense>
        </Panel>
      )}
    </>
  );
}

function AttendeesTab({ attendees, q, page }: { attendees: SlushAttendee[]; q: string; page: number }) {
  const needle = normaliseName(q);
  const matching = needle ? attendees.filter((a) => normaliseName(a.name).includes(needle)) : attendees;
  const pages = Math.max(1, Math.ceil(matching.length / PER_PAGE));
  const current = Math.min(Math.max(1, page), pages);
  const shown = matching.slice((current - 1) * PER_PAGE, current * PER_PAGE);
  const href = (p: number) => `/events/slush-2026/attendees?${new URLSearchParams({ ...(q && { q }), ...(p > 1 && { page: String(p) }) })}`;

  return (
    <div className="space-y-4">
      <AttendeeSearch q={q} />
      <Panel
        title={q ? `${matching.length.toLocaleString("en")} attendees matching “${q}”` : "All attendees"}
        description="Newest first, by the date Cala first saw them on the list. Details load as you browse."
      >
        {shown.length ? (
          <AttendeeList attendees={shown} />
        ) : (
          <EmptyState icon={SearchIcon} title={`No attendee named “${q}”`} description="This searches attendee names only. Try part of the name." compact />
        )}
        {pages > 1 && (
          <nav className="mt-4 flex items-center justify-between text-[13px]">
            <span className="text-muted-foreground tabular">
              Page {current} of {pages}
            </span>
            <span className="flex gap-2">
              <PageLink href={href(current - 1)} disabled={current <= 1}>← Previous</PageLink>
              <PageLink href={href(current + 1)} disabled={current >= pages}>Next →</PageLink>
            </span>
          </nav>
        )}
      </Panel>
    </div>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  if (disabled) return <span className="rounded-lg border px-3 py-1.5 text-subtle">{children}</span>;
  return (
    <Link href={href} className="rounded-lg border bg-card px-3 py-1.5 font-medium hover:border-primary/30">
      {children}
    </Link>
  );
}

function AttendeeSearch({ q }: { q: string }) {
  return (
    <form action="/events/slush-2026/attendees" className="relative">
      <SearchIcon className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input name="q" defaultValue={q} placeholder="Find an attendee by name" className="h-11 rounded-xl bg-card pl-10 text-[15px]" />
    </form>
  );
}

function AttendeeList({ attendees }: { attendees: SlushAttendee[] }) {
  return (
    <ul className="divide-y">
      {attendees.map((a) => (
        <li key={a.id}>
          <Suspense fallback={<AttendeeRowShell a={a} />}>
            <AttendeeRow a={a} />
          </Suspense>
        </li>
      ))}
    </ul>
  );
}

/** One attendee with its Cala description; the name and attendance source show while details load. */
async function AttendeeRow({ a }: { a: SlushAttendee }) {
  const r = await resolveAttendee(a).catch(() => null);
  const detail = r?.description || (r ? "No description on record" : "Details unavailable right now");
  return (
    <AttendeeRowShell a={a} href={r?.id ? `/company/${r.id}` : undefined}>
      <span className="flex items-center gap-1.5">
        <span className="truncate">{detail}</span>
        {r?.hq && <span className="shrink-0 text-subtle">· {r.hq}</span>}
        {r && r.sources.length > 0 && <SourceChip sources={r.sources} />}
      </span>
    </AttendeeRowShell>
  );
}

function AttendeeRowShell({ a, href, children }: { a: SlushAttendee; href?: string; children?: React.ReactNode }) {
  const name = href ? (
    <Link href={href} className="font-medium hover:text-primary">
      {a.name}
    </Link>
  ) : (
    <span className="font-medium">{a.name}</span>
  );
  return (
    <div className="flex items-center gap-3 px-1 py-3">
      <EntityAvatar name={a.name} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="text-sm">{name}</div>
        <div className="mt-0.5 min-w-0 text-xs text-muted-foreground">{children ?? <Skeleton className="h-3 w-64" />}</div>
      </div>
      {a.firstSeen && <span className="shrink-0 text-xs text-subtle tabular">Added {formatDay(a.firstSeen)}</span>}
      <SourceChip sources={a.sources} />
    </div>
  );
}

async function InvestorsAnswer() {
  let res: { answer: string; sources: CitedSource[] };
  try {
    res = await fetchSlushInvestors();
  } catch (err) {
    return <CalaProblem error={err} compact />;
  }
  return (
    <>
      <div className="text-sm leading-relaxed">
        <Markdown link={(href) => citation(href, res.sources)}>{res.answer || "No answer on record."}</Markdown>
      </div>
      <div className="mt-4 border-t pt-3 font-mono text-xs">
        {res.sources.length ? (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span>Sources:</span>
            {res.sources.map((s, i) => (
              <span key={s.url} className="inline-flex items-baseline gap-2">
                {i > 0 && <span className="text-subtle">·</span>}
                <a href={s.url} target="_blank" rel="noreferrer" title={s.url} className="max-w-56 truncate underline underline-offset-2 hover:text-primary">
                  {i + 1}. {s.name}
                </a>
              </span>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">No sources returned. Treat this answer as unverified.</span>
        )}
      </div>
    </>
  );
}

/** "[n](#cite-n)" markers become a small numbered chip linking to source n. */
function citation(href: string | undefined, sources: CitedSource[]) {
  const n = Number(href?.match(/^#cite-(\d+)$/)?.[1]);
  const s = sources[n - 1];
  if (!s) return undefined;
  return (
    <a
      href={s.url}
      target="_blank"
      rel="noreferrer"
      title={`${n}. ${s.name}`}
      aria-label={`Source ${n}: ${s.name}`}
      className="relative -top-px ml-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded bg-muted px-1 align-middle font-mono text-[11px] leading-none font-medium text-muted-foreground no-underline transition-colors hover:bg-teal-soft hover:text-accent-foreground"
    >
      {n}
    </a>
  );
}

function AnswerSkeleton() {
  return (
    <div className="space-y-2.5">
      <p className="text-[13px] text-muted-foreground">Asking Cala. The first answer can take up to a minute, then it is cached for a day.</p>
      {[92, 80, 86, 60].map((w) => (
        <Skeleton key={w} className="h-3.5" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

function CalaProblem({ error, compact }: { error: unknown; compact?: boolean }) {
  const kind = calaErrorKind(error);
  const message =
    kind === "missing_key"
      ? "Cala is not configured on the backend (CALA_API_KEY in its .env)."
      : kind === "no_credit"
        ? "The Cala credit balance is empty. Cached results still work; new ones will load once credit is added."
        : kind === "rate_limited"
          ? "Cala is rate limiting requests. Reload in a minute."
          : "Could not reach Cala. Reload to try again.";
  return (
    <div className={cn(!compact && "mt-6")}>
      <EmptyState title="Slush data is unavailable" description={message} compact={compact} />
    </div>
  );
}
