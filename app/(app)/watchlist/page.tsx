import { Bookmark, CloudOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import Loading from "@/app/(app)/loading";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Panel } from "@/components/warmline/blocks";
import { listWatchItems } from "@/lib/backend/watchlist";
import { demoDataEnabled } from "@/lib/demo";
import { getRole } from "@/lib/session";
import { cn } from "@/lib/utils";
import { WATCH_TAGS, type WatchItem } from "@/lib/watchlist";
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
  const [result, role] = await Promise.all([
    listWatchItems().then(
      (items) => ({ items, error: null }),
      (e: unknown) => ({ items: [] as WatchItem[], error: e instanceof Error ? e.message : "Could not load the watch list." }),
    ),
    getRole(),
  ]);
  const { items, error } = result;

  // Chips: the type filters always, tag filters only when something carries that tag.
  const filters = [...BASE_FILTERS, ...TAG_FILTERS.filter((f) => items.some(f.match))];
  const active = filters.find((f) => f.key === show) ?? filters[0];
  const shown = items.filter(active.match);
  const browse = demoDataEnabled() ? { href: "/search", label: "Search companies" } : { href: "/market", label: "Open Market" };

  return (
    <>
      <PageHeader
        title="Watch list"
        description="Companies and investors you follow. Alerts tell you when the records show a change on any of them. Only you can see this list."
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
                  <WatchRow key={item.id} item={item} role={role} />
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
