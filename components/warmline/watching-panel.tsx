import { Bookmark } from "lucide-react";
import Link from "next/link";
import { getWatchSummary } from "@/lib/backend/watchlist";
import { WATCH_TAGS } from "@/lib/watchlist";
import { Panel } from "./blocks";

/** "Watching N companies and investors": counts per tag, with a link to manage the watch list. */
export async function WatchingPanel({ className }: { className?: string }) {
  const summary = await getWatchSummary().catch(() => null);
  const manage = (
    <Link href="/watchlist" className="text-[13px] font-medium text-primary hover:underline">
      Manage
    </Link>
  );

  if (!summary) {
    return (
      <Panel className={className} title="Watch list" action={manage}>
        <p className="text-[13px] text-muted-foreground">The watch list is unavailable right now. Is the backend running?</p>
      </Panel>
    );
  }

  const tagged = Object.values(summary.byTag).reduce((a, b) => a + (b ?? 0), 0);
  const rows = [
    ...WATCH_TAGS.filter((t) => summary.byTag[t.value]).map((t) => ({ label: t.label, count: summary.byTag[t.value]! })),
    ...(summary.total - tagged ? [{ label: "Saved, no tag", count: summary.total - tagged }] : []),
  ];

  return (
    <Panel
      className={className}
      title={summary.total ? `Watching ${summary.total} ${summary.total === 1 ? "company or investor" : "companies and investors"}` : "Watch list"}
      action={manage}
    >
      {summary.total ? (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-[13px]">
              <span>{r.label}</span>
              <span className="tabular font-semibold text-primary">{r.count}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-start gap-2 text-[13px] text-muted-foreground">
          <Bookmark className="mt-0.5 size-3.5 shrink-0" />
          Press Watch on a company or investor page to follow it.
        </p>
      )}
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        What you watch decides which changes show up in your alerts. Only you can see your watch list.
      </p>
    </Panel>
  );
}
