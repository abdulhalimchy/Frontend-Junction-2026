import { ArrowLeft, ArrowRight, CircleAlert, History, Loader2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader } from "@/components/warmline/blocks";
import { Pill } from "@/components/warmline/badges";
import { listMarketAnalyses, type MarketAnalysisRow } from "@/lib/backend/markets";
import { ClearHistoryButton, DeleteAnalysisButton, PollWhileLoading } from "../history-controls";

export const metadata: Metadata = { title: "Analysis history" };

// Every market report this account ran, as stored in the backend database. Opening one shows the saved
// result (no Cala credit); Clear history deletes them all from the database.

export default function HistoryPage() {
  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/market" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3" /> Back
          </Link>
        }
        title="Analysis history"
        description="Your past market and company reports, most recently opened first. Opening one shows the saved result instantly; refresh it from the report to fetch fresh data."
      />
      <Suspense fallback={<HistoryLoading />}>
        <HistoryList />
      </Suspense>
    </>
  );
}

async function HistoryList() {
  let rows: MarketAnalysisRow[];
  try {
    rows = await listMarketAnalyses();
  } catch (e) {
    return <EmptyState icon={CircleAlert} title="Could not load your history" description={e instanceof Error ? e.message : "Unknown error"} />;
  }
  if (!rows.length) {
    return (
      <EmptyState
        icon={History}
        title="No analyses yet"
        description="Analyse a market or a company and it will be saved here."
        action={
          <Link href="/market" className="text-sm text-primary hover:underline">
            Analyse a market
          </Link>
        }
      />
    );
  }
  return (
    <>
      <PollWhileLoading active={rows.some((r) => r.status === "loading")} everyMs={5000} />
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {rows.length} {rows.length === 1 ? "report" : "reports"}
        </p>
        <ClearHistoryButton count={rows.length} />
      </div>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
            <Link href={`/market/${r.kind === "company" ? "company" : "report"}?id=${r.id}`} className="group flex min-w-0 flex-1 items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold first-letter:uppercase">{r.title || r.sector}</span>
                  <Pill tone={r.kind === "company" ? "teal" : "neutral"}>{r.kind === "company" ? "Company" : "Market"}</Pill>
                  {r.kind !== "company" || r.place !== "Worldwide" ? <Pill tone="neutral">{r.kind === "company" ? `Competitors in ${r.place}` : r.place}</Pill> : null}
                  <StatusPill status={r.status} />
                </div>
                <p className="mt-0.5 line-clamp-1 text-[13px] text-muted-foreground">
                  {r.status === "failed" ? r.error || "The last run failed." : r.headline || (r.status === "loading" ? "Building the report…" : "No summary on record.")}
                </p>
                <p className="mt-0.5 text-xs text-subtle">
                  {r.typed && r.typed.toLowerCase() !== (r.title || r.sector).toLowerCase() ? `You searched “${r.typed}” · ` : ""}
                  {r.kind !== "company" && r.playerCount ? `${r.playerCount} leading players · ` : ""}
                  {r.finishedAt ? `Updated ${when(r.finishedAt)}` : `Started ${when(r.createdAt)}`}
                  {r.runs > 1 ? ` · refreshed ${r.runs - 1}×` : ""}
                </p>
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
            <DeleteAnalysisButton id={r.id} name={r.title || r.sector} />
          </li>
        ))}
      </ul>
    </>
  );
}

function StatusPill({ status }: { status: MarketAnalysisRow["status"] }) {
  if (status === "ready") return null;
  if (status === "failed") return <Pill tone="warning">Failed</Pill>;
  return (
    <Pill tone="teal">
      <Loader2 className="size-3 animate-spin" /> Running
    </Pill>
  );
}

function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function HistoryLoading() {
  return (
    <div className="space-y-2 rounded-xl border bg-card p-4">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-5 w-1/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}
