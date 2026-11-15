import { ArrowLeft, Building2, Check, History, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Pill } from "@/components/warmline/badges";
import { EmptyState, PageHeader, Panel } from "@/components/warmline/blocks";
import { MarketError } from "@/components/warmline/market-view";
import { SourceChip } from "@/components/warmline/source-chip";
import type { Deal, MarketAnalysis, ReportSummary, SectionError, SectionName } from "@/lib/backend/markets";
import { formatMoney } from "@/lib/format";
import type { Source } from "@/lib/types";
import { DeleteAnalysisButton, PollWhileLoading, RefreshAnalysisButton, StopAnalysisButton } from "./history-controls";

// Pieces shared by the market report (/market/report) and the company report (/market/company).

/** Polling while it runs, what it covers, Stop / Refresh / Delete, and what the last refresh changed. */
export function ReportControls({ a, chips }: { a: MarketAnalysis; chips: React.ReactNode }) {
  const loading = a.status === "loading";
  return (
    <>
      <PollWhileLoading active={loading} />
      <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {chips}
        <span className="ml-auto flex items-center gap-2">
          {loading ? (
            <>
              <span className="flex items-center gap-1.5">
                <Loader2 className="size-3.5 animate-spin text-primary" /> {a.runs > 1 ? "Updating; the saved report stays until new data arrives" : "Building the report"}
              </span>
              <StopAnalysisButton id={a.id} />
            </>
          ) : (
            <>
              <span>Updated {a.finishedAt ? ago(Date.parse(a.finishedAt)) : ""}</span>
              <RefreshAnalysisButton id={a.id} running={false} />
            </>
          )}
          <DeleteAnalysisButton id={a.id} name={a.title || a.sector} afterDelete="/market/history" />
        </span>
      </div>
      {loading && <Progress a={a} />}
      {!loading && a.runs > 1 && a.changes.length > 0 && (
        <div className="mb-6 rounded-xl border border-primary/25 bg-teal-soft/40 px-4 py-3 text-sm">
          <span className="font-medium">Since the last update: </span>
          <span className="text-muted-foreground">{a.changes.join(" ")}</span>
        </div>
      )}
    </>
  );
}

/** Headline and up to four takeaways, each with its sources. */
export function SummaryPanel({ s, loading, error }: { s?: ReportSummary; loading: boolean; error?: SectionError }) {
  if (s?.headline || s?.bullets.length)
    return (
      <Panel className="border-primary/25">
        {s.headline && (
          <p className="flex items-start gap-2 text-base font-medium leading-relaxed">
            <span>{s.headline.text}</span>
            <SourceChip sources={s.headline.sources} className="mt-1" />
          </p>
        )}
        {s.bullets.length > 0 && (
          <ul className="mt-3 grid gap-x-6 gap-y-2 md:grid-cols-2">
            {s.bullets.slice(0, 4).map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-muted-foreground">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                <span className="flex-1">{b.text}</span>
                <SourceChip sources={b.sources} className="mt-0.5" />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    );
  return !loading && error ? <SectionProblem error={error} /> : null;
}

export function InsightCards({ s }: { s?: ReportSummary }) {
  if (!s?.insights.length) return null;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {s.insights.slice(0, 6).map((i, k) => (
        <div key={k} className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <Pill tone={INSIGHT[i.kind].tone}>{INSIGHT[i.kind].label}</Pill>
            <SourceChip sources={i.sources} />
          </div>
          <div className="mt-2 text-sm font-semibold">{i.title}</div>
          <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-muted-foreground">{i.text}</p>
        </div>
      ))}
    </div>
  );
}

export function Tiles({ tiles }: { tiles: { label: string; value: string; sub?: string; sources?: Source[] }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl border bg-card px-4 py-3">
          <div className="flex items-center justify-between gap-1 text-xs text-muted-foreground">
            {t.label}
            {t.sources && t.sources.length > 0 && <SourceChip sources={t.sources} />}
          </div>
          <div className="tabular mt-1 truncate text-2xl font-semibold tracking-tight">{t.value}</div>
          {t.sub && <div className="mt-0.5 truncate text-xs text-subtle">{t.sub}</div>}
        </div>
      ))}
    </div>
  );
}

export function DataNote() {
  return (
    <p className="text-xs text-subtle">
      We use the Cala encyclopedia to get verified data with cited sources: every figure and company links to where it was published. Money is never converted between currencies, and grants are kept separate from equity.
    </p>
  );
}

export const INSIGHT = {
  trend: { label: "Trend", tone: "teal" },
  opportunity: { label: "Opportunity", tone: "success" },
  risk: { label: "Risk", tone: "warning" },
} as const;

export const DEAL_LABEL: Record<Deal["type"], string> = { funding: "Funding", grant: "Grant", acquisition: "Acquisition", merger: "Merger", ipo: "IPO", other: "Deal" };

export function DealsTable({ deals }: { deals: Deal[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr className="border-b">
            <th className="py-2 pr-3 font-medium">Company</th>
            <th className="py-2 pr-3 font-medium">Type</th>
            <th className="py-2 pr-3 text-right font-medium">Amount</th>
            <th className="py-2 pr-3 font-medium">Date</th>
            <th className="py-2 pr-3 font-medium">Investors / buyer</th>
            <th className="py-2 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {deals.map((d, i) => (
            <tr key={i} className="align-top" title={d.quote}>
              <td className="py-2.5 pr-3 font-medium">{d.company || "—"}</td>
              <td className="py-2.5 pr-3 text-[13px] text-muted-foreground whitespace-nowrap">
                {DEAL_LABEL[d.type]}
                {d.stage ? ` · ${d.stage}` : ""}
              </td>
              <td className="tabular py-2.5 pr-3 text-right whitespace-nowrap">{d.value ? formatMoney(d.value) : <span className="text-subtle">Undisclosed</span>}</td>
              <td className="tabular py-2.5 pr-3 text-[13px] text-muted-foreground whitespace-nowrap">{d.date || "—"}</td>
              <td className="py-2.5 pr-3 text-[13px] text-muted-foreground">{d.counterparty || "—"}</td>
              <td className="py-2.5">
                <SourceChip sources={d.sources} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const MARKET_STEPS: { key: SectionName; label: string }[] = [
  { key: "size", label: "Market size" },
  { key: "players", label: "Leading companies" },
  { key: "deals", label: "Funding and deals" },
  { key: "trends", label: "Trends" },
  { key: "summary", label: "Checked summary" },
];

const COMPANY_STEPS: { key: SectionName; label: string }[] = [
  { key: "profile", label: "Company record" },
  { key: "competitors", label: "Competitors" },
  { key: "news", label: "Recent news and deals" },
  { key: "summary", label: "Checked summary" },
];

export function Progress({ a }: { a: MarketAnalysis }) {
  const STEPS = a.kind === "company" ? COMPANY_STEPS : MARKET_STEPS;
  const started = a.startedAt ? Date.parse(a.startedAt) : 0;
  const done = (k: SectionName) => Boolean(a.errors[k]) || (k === "summary" ? Boolean(a.summary && (a.summary.fetchedAt ?? 0) >= started) : Boolean(a[k as Exclude<SectionName, "summary">] && (a[k as Exclude<SectionName, "summary">]!.fetchedAt ?? 0) >= started));
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border bg-card px-4 py-3 text-[13px]">
      {STEPS.map((s) => (
        <span key={s.key} className={done(s.key) ? "flex items-center gap-1.5" : "flex items-center gap-1.5 text-muted-foreground"}>
          {done(s.key) ? <Check className="size-3.5 text-primary" /> : <Loader2 className="size-3.5 animate-spin" />}
          {s.label}
        </span>
      ))}
      <span className="ml-auto text-xs text-subtle">Usually about a minute</span>
    </div>
  );
}

export function ReportHeader({ title }: { title: React.ReactNode }) {
  return (
    <PageHeader
      eyebrow={
        <div className="flex items-center gap-4">
          <Link href="/market" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3" /> Back
          </Link>
          <Link href="/market/history" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <History className="size-3" /> History
          </Link>
        </div>
      }
      title={<span className="first-letter:uppercase">{title}</span>}
    />
  );
}

export function SectionProblem({ error }: { error: SectionError }) {
  return error.kind === "llm" ? <EmptyState compact icon={Sparkles} title="Could not write the summary" description={error.message} /> : <MarketError error={new Error(error.message)} />;
}

export function Empty({ loading, text, icon }: { loading: boolean; text: string; icon?: typeof Building2 }) {
  if (loading)
    return (
      <div className="space-y-2 py-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  return icon ? <EmptyState compact icon={icon} title="Nothing on record" description={text} /> : <p className="py-6 text-center text-sm text-muted-foreground">{text}</p>;
}

/** "just now", "12 min ago", "3 h ago", "2 days ago". */
export function ago(at: number) {
  const mins = Math.max(0, Math.round((Date.now() - at) / 60_000));
  return mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : mins < 48 * 60 ? `${Math.round(mins / 60)} h ago` : `${Math.round(mins / 1440)} days ago`;
}

export function dedupe(sources: Source[]) {
  return sources.filter((s, i, arr) => arr.findIndex((x) => x.document === s.document) === i);
}
