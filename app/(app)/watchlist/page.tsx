import { Bookmark, CloudOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import Loading from "@/app/(app)/loading";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Panel } from "@/components/warmline/blocks";
import { getAlertSchedule, listAlerts } from "@/lib/backend/alerts";
import { listWatchItems } from "@/lib/backend/watchlist";
import { formatMoment, isoDaysAgo, zoneCity } from "@/lib/format";
import { getRole } from "@/lib/session";
import type { Alert } from "@/lib/types";
import { cn } from "@/lib/utils";
import { WATCH_TAGS, type WatchItem } from "@/lib/watchlist";
import { ScanButton } from "./scan-button";
import { WatchRow } from "./watch-row";

export const metadata: Metadata = { title: "Watch list" };

type Filter = { key: string; label: string; match: (i: WatchItem) => boolean };

const BASE_FILTERS: Filter[] = [
  { key: "all", label: "All", match: () => true },
  { key: "company", label: "Companies", match: (i) => i.entityType === "company" },
  { key: "investor", label: "Investors", match: (i) => i.entityType === "investor" },
];
const TAG_FILTERS: Filter[] = [
  ...WATCH_TAGS.map((t) => ({ key: t.value, label: t.label, match: (i: WatchItem) => i.tag === t.value })),
  { key: "untagged", label: "Saved", match: (i: WatchItem) => !i.tag },
];

async function WatchlistContent({ searchParams }: PageProps<"/watchlist">) {
  const { show } = await searchParams;
  const [result, role, schedule, changes] = await Promise.all([
    listWatchItems().then(
      (items) => ({ items, error: null }),
      (e: unknown) => ({ items: [] as WatchItem[], error: e instanceof Error ? e.message : "Could not load the watch list." }),
    ),
    getRole(),
    getAlertSchedule().catch(() => null),
    listAlerts().catch(() => [] as Alert[]), // the list still works when changes can't load
  ]);
  const tz = schedule?.timezone ?? "UTC";
  const { items, error } = result;

  // Changes per watched entity, newest first; "recent" is anything dated in the last 7 days.
  const byEntity = new Map<string, Alert[]>();
  for (const c of [...changes].sort((a, b) => b.date.localeCompare(a.date)))
    if (c.calaId) byEntity.set(c.calaId, [...(byEntity.get(c.calaId) ?? []), c]);
  const weekAgo = isoDaysAgo(7);
  const changesOf = (i: WatchItem) => byEntity.get(i.calaId) ?? [];
  const recent: Filter = { key: "changed", label: "Changed this week", match: (i) => changesOf(i).some((c) => c.date >= weekAgo) };

  // Chips: the type filters always; "Changed this week" and tag filters only when something matches.
  const filters = [...BASE_FILTERS, recent, ...TAG_FILTERS].filter((f) => BASE_FILTERS.includes(f) || items.some(f.match));
  const active = filters.find((f) => f.key === show) ?? filters[0];
  const shown = items.filter(active.match);
  const browse = { href: "/market", label: "Open Market" };

  return (
    <>
      <PageHeader
        title="Watch list"
        description={
          schedule
            ? `Companies and investors you follow. Cala checks every one of them each night at ${schedule.time} (${zoneCity(schedule.timezone)} time), and new rounds, Slush attendance and team changes show up on their row. Only you can see this list.`
            : "Companies and investors you follow. When Cala sees a change on one of them, it shows up on its row. Only you can see this list."
        }
        actions={items.length ? <ScanButton /> : undefined}
      />

      {error ? (
        <Panel>
          <EmptyState icon={CloudOff} title="Watch list unavailable" description={error} />
        </Panel>
      ) : !items.length ? (
        <Panel>
          <EmptyState
            icon={Bookmark}
            title="You're not watching anything yet"
            description="Press Watch on a company or investor page to follow it here."
            action={
              <Button asChild>
                <Link href={browse.href}>{browse.label}</Link>
              </Button>
            }
          />
        </Panel>
      ) : (
        <>
          <nav className="mb-4 flex flex-wrap gap-2" aria-label="Filter the watch list">
            {filters.map((f) => {
              const count = items.filter(f.match).length;
              const on = f.key === active.key;
              return (
                <Link
                  key={f.key}
                  href={f.key === "all" ? "/watchlist" : `/watchlist?show=${f.key}`}
                  scroll={false}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
                    on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-muted",
                  )}
                >
                  {f.label}
                  <span className={cn("tabular text-[11px]", on ? "text-primary-foreground/80" : "text-subtle")}>{count}</span>
                </Link>
              );
            })}
          </nav>
          <Panel bodyClassName="p-0">
            {shown.length ? (
              <ul className="divide-y">
                {shown.map((item) => (
                  <WatchRow
                    key={item.id}
                    item={item}
                    role={role}
                    checked={item.lastCheckedAt && formatMoment(item.lastCheckedAt, tz)}
                    changes={changesOf(item)}
                    recentSince={weekAgo}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={Bookmark} title={`Nothing under “${active.label}”`} />
            )}
          </Panel>
        </>
      )}
    </>
  );
}

// URL data is read inside Suspense so navigation can show the shell instantly.
export default function WatchlistPage(props: PageProps<"/watchlist">) {
  return (
    <Suspense fallback={<Loading />}>
      <WatchlistContent {...props} />
    </Suspense>
  );
}
