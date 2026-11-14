import { ArrowLeft, Building2, Check, ChevronDown, CircleAlert, FileText, History, Loader2, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader, Panel } from "@/components/warmline/blocks";
import { Markdown } from "@/components/warmline/markdown";
import { BarList, FundingByYearChart, MarketSizeChart, SizeLegend } from "@/components/warmline/market-charts";
import { CompaniesTable, MarketError } from "@/components/warmline/market-view";
import { SourceChip } from "@/components/warmline/source-chip";
import { MarketGuardNotice } from "@/components/warmline/market-guard";
import { Pill } from "@/components/warmline/badges";
import { getMarketAnalysis, openMarketAnalysis, type Deal, type EvidenceSection, type MarketAnalysis, type SectionError, type SectionName } from "@/lib/backend/markets";
import { REGIONS } from "@/lib/cala/market";
import { formatMoney } from "@/lib/format";
import { money, reportNumbers, type ReportNumbers } from "@/lib/market-report";
import type { Source } from "@/lib/types";
import { DeleteAnalysisButton, MarketSearch, PollWhileLoading, RefreshAnalysisButton, StopAnalysisButton } from "../history-controls";

export const metadata: Metadata = { title: "Market analysis" };

export default function ReportPage(props: PageProps<"/market/report">) {
  return (
    <Suspense fallback={<Building label="Reading your search" />}>
      <Report {...props} />
    </Suspense>
  );
}

// The backend reads the free text with its LLM (market, place, the four data lookups), runs them, writes a
// checked summary, and keeps the report in the user's history. /market/report?q=… opens (or starts) the
// analysis and redirects to /market/report?id=…, which reads the stored result: reopening it is free.

async function Report({ searchParams }: PageProps<"/market/report">) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim().slice(0, 300) : "");
  const id = /^[0-9a-f-]{36}$/i.test(str("id")) ? str("id") : null;

  if (!id) {
    // Old links carry ?sector=…&region=<key>; free text replaces both.
    const legacyRegion = REGIONS[str("region")]?.label;
    const text = str("q") || (str("sector") ? `${str("sector")}${legacyRegion && legacyRegion !== "Anywhere" ? ` in ${legacyRegion}` : ""}` : "");
    if (!text) redirect("/market");
    let opened: Awaited<ReturnType<typeof openMarketAnalysis>>;
    try {
      opened = await openMarketAnalysis({ text, force: sp.force === "1" });
    } catch (e) {
      return <ReportFailed title="Could not start the analysis" error={e} />;
    }
    if (!opened.analysis) {
      return (
        <>
          <ReportHeader title="Market analysis" />
          <div className="mb-4">
            <MarketSearch defaultValue={text} />
          </div>
          <MarketGuardNotice text={text} verdict={opened.verdict} searchHref={(s) => `/market/report?${new URLSearchParams({ q: s })}`} runAnywayHref={`/market/report?${new URLSearchParams({ q: text, force: "1" })}`} />
        </>
      );
    }
    redirect(`/market/report?id=${opened.analysis.id}`);
  }

  let a: MarketAnalysis;
  try {
    a = await getMarketAnalysis(id);
  } catch (e) {
    return <ReportFailed title="This analysis is not in your history" error={e} />;
  }
  const loading = a.status === "loading";
  const n = reportNumbers(a);
  const s = a.summary;

  return (
    <>
      <PollWhileLoading active={loading} />
      <ReportHeader title={a.title || a.sector} />
      <div className="mb-3">
        <MarketSearch defaultValue={a.typed || a.title || a.sector} busy={loading} />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Market</span>
        <Pill tone="teal">{a.sector}</Pill>
        <span>in</span>
        <Pill tone="neutral">{a.place}</Pill>
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

      <div className="space-y-6">
        <Kpis n={n} />

        {s?.headline || s?.bullets.length ? (
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
        ) : (
          !loading && a.errors.summary && <SectionProblem error={a.errors.summary} />
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Market size" description={n.size ? `${n.size.publisher} · ${n.size.scope}` : "Published market research figures"} action={n.size && <SizeLegend />}>
            {n.size && n.size.series.length > 0 ? (
              <>
                <MarketSizeChart data={n.size.series.map((f) => ({ year: f.year, value: f.value.amount, forecast: f.kind === "forecast" }))} currency={n.size.series[0].value.currency} />
                <p className="mt-2 flex items-center gap-2 text-xs text-subtle">
                  Publishers define markets differently; other figures are listed under Sources.
                  <SourceChip sources={n.size.series[0].sources} />
                </p>
              </>
            ) : (
              <Empty loading={loading} text="No published size figures were found for this market." />
            )}
          </Panel>
          <Panel title="Funding raised per year" description={n.currency ? `Rounds of the leading companies, in ${n.currency}${n.otherCurrencyRounds ? ` (${n.otherCurrencyRounds} in other currencies not shown)` : ""}` : "Rounds of the leading companies"}>
            {n.currency && n.fundingByYear.length ? <FundingByYearChart data={n.fundingByYear} currency={n.currency} /> : <Empty loading={loading} text="No dated rounds with an amount on record." />}
          </Panel>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Panel className="lg:col-span-1" title="Most funded companies" description={`Equity raised${n.currency ? `, ${n.currency}` : ""}${n.reportedTotals ? "; * reported total, all instruments" : ""}`}>
            <BarList data={n.topFunded} emptyText={loading ? "Loading…" : "No equity amounts on record."} />
          </Panel>
          <Panel title="Rounds by stage" description="Equity rounds of the leading companies">
            <BarList data={n.stages} emptyText={loading ? "Loading…" : "No equity rounds on record."} />
          </Panel>
          <Panel title="Most active investors" description="Investors in these companies, by how many they back">
            <BarList data={n.investors} emptyText={loading ? "Loading…" : "No investors on record."} />
          </Panel>
        </div>

        <Panel title="Funding and deals" description="Rounds, acquisitions and exits named in the sources, newest first. Each row is quoted from its source; hover a row for the quote." bodyClassName="pt-1">
          {s?.deals?.length ? <DealsTable deals={s.deals} /> : <Empty loading={loading} text={a.errors.deals ? a.errors.deals.message : "No recent deals were found for this market."} />}
        </Panel>

        {s && s.insights.length > 0 && (
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
        )}

        <Panel title="Leading companies" description={a.players ? `${a.players.companies.length} companies with a verified company record` : "Companies with a verified company record"} bodyClassName="pt-3">
          {a.players?.companies.length ? (
            <CompaniesTable data={{ query: { sector: a.sector, region: a.region }, definition: a.players.definition, companies: a.players.companies, outsideRegion: [] }} currency={null} />
          ) : a.errors.players ? (
            <SectionProblem error={a.errors.players} />
          ) : (
            <Empty loading={loading} text="No leading companies were found. Try a broader description or place." icon={Building2} />
          )}
        </Panel>

        <SourcesDetails a={a} />

        <p className="text-xs text-subtle">
          We use the Cala encyclopedia to get verified data with cited sources: every figure and company links to where it was published. Money is never converted between currencies, and grants are kept separate from equity.
        </p>
      </div>
    </>
  );
}

const INSIGHT = {
  trend: { label: "Trend", tone: "teal" },
  opportunity: { label: "Opportunity", tone: "success" },
  risk: { label: "Risk", tone: "warning" },
} as const;

function Kpis({ n }: { n: ReportNumbers }) {
  const size = n.size?.latest;
  const tiles = [
    { label: size ? `Market size ${size.year}` : "Market size", value: size ? formatMoney(size.value) : "—", sub: n.size?.forecast ? `${formatMoney(n.size.forecast.value)} by ${n.size.forecast.year}` : n.size?.publisher },
    { label: "Growth (CAGR)", value: n.size?.cagr ? `${n.size.cagr.percent}%` : "—", sub: n.size?.cagr?.period || (n.size?.cagr ? "" : "not published") },
    { label: "Leading companies", value: String(n.companies || "—"), sub: "with a verified record" },
    { label: "Raised by these companies", value: n.equityTotal ? money(n.equityTotal.amount, n.equityTotal.currency) : "—", sub: n.reportedTotals ? "equity, or reported totals" : "equity rounds" },
    { label: `Rounds since ${n.recentSince}`, value: String(n.recentRounds || "—"), sub: "equity and grants" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">{t.label}</div>
          <div className="tabular mt-1 text-2xl font-semibold tracking-tight">{t.value}</div>
          {t.sub && <div className="mt-0.5 truncate text-xs text-subtle">{t.sub}</div>}
        </div>
      ))}
    </div>
  );
}

const DEAL_LABEL: Record<Deal["type"], string> = { funding: "Funding", grant: "Grant", acquisition: "Acquisition", merger: "Merger", ipo: "IPO", other: "Deal" };

function DealsTable({ deals }: { deals: Deal[] }) {
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

const STEPS: { key: SectionName; label: string }[] = [
  { key: "size", label: "Market size" },
  { key: "players", label: "Leading companies" },
  { key: "deals", label: "Funding and deals" },
  { key: "trends", label: "Trends" },
  { key: "summary", label: "Checked summary" },
];

function Progress({ a }: { a: MarketAnalysis }) {
  const started = a.startedAt ? Date.parse(a.startedAt) : 0;
  const done = (k: SectionName) => Boolean(a.errors[k]) || (k === "summary" ? Boolean(a.summary && (a.summary.fetchedAt ?? 0) >= started) : Boolean(a[k] && (a[k]!.fetchedAt ?? 0) >= started));
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

/** The written answers and every fact behind them, folded away: the charts above are built from these. */
function SourcesDetails({ a }: { a: MarketAnalysis }) {
  const parts: [string, EvidenceSection | undefined][] = [
    ["Market size", a.size],
    ["Funding and deals", a.deals],
    ["Trends, drivers and challenges", a.trends],
  ];
  const sizes = a.summary?.sizes ?? [];
  if (!parts.some(([, p]) => p) && !sizes.length) return null;
  return (
    <details className="group rounded-xl border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-sm font-medium">
        <FileText className="size-4 text-muted-foreground" /> Sources and full answers
        <span className="text-xs font-normal text-muted-foreground">({parts.reduce((t, [, p]) => t + (p?.evidence.length ?? 0), 0)} facts)</span>
        <ChevronDown className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-6 border-t px-5 py-4">
        {sizes.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold">All market size figures</h3>
            <ul className="space-y-1 text-[13px]">
              {sizes.map((f, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="tabular w-12 text-muted-foreground">{f.year}</span>
                  <span className="tabular w-20 font-medium">{formatMoney(f.value)}</span>
                  <span className="truncate text-muted-foreground">
                    {f.publisher} · {f.scope}
                    {f.kind === "forecast" ? " (forecast)" : ""}
                    {f.cagr ? ` · ${f.cagr.percent}% CAGR` : ""}
                  </span>
                  <SourceChip sources={f.sources} />
                </li>
              ))}
            </ul>
          </div>
        )}
        {parts.map(([title, p]) =>
          p ? (
            <div key={title}>
              <div className="mb-1 flex items-center gap-2">
                <h3 className="text-sm font-semibold">{title}</h3>
                <SourceChip sources={dedupe(p.evidence.flatMap((e) => e.sources))} />
              </div>
              <div className="max-h-80 overflow-auto text-[13px] text-muted-foreground">
                <Markdown>{p.summary}</Markdown>
              </div>
            </div>
          ) : null,
        )}
        {a.summary && (
          <p className="text-xs text-subtle">
            Summary written by {a.summary.model} from {a.summary.factCount} verified facts; {a.summary.checked} claims checked
            {a.summary.dropped.length ? `, ${a.summary.dropped.length} left out because they did not match their sources.` : ", all matched their sources."}
          </p>
        )}
      </div>
    </details>
  );
}

function ReportHeader({ title }: { title: React.ReactNode }) {
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

function ReportFailed({ title, error }: { title: string; error: unknown }) {
  return (
    <>
      <ReportHeader title="Market analysis" />
      <EmptyState icon={CircleAlert} title={title} description={error instanceof Error ? error.message : "Unknown error"} />
    </>
  );
}

function SectionProblem({ error }: { error: SectionError }) {
  return error.kind === "llm" ? <EmptyState compact icon={Sparkles} title="Could not write the summary" description={error.message} /> : <MarketError error={new Error(error.message)} />;
}

function Empty({ loading, text, icon }: { loading: boolean; text: string; icon?: typeof Building2 }) {
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

function Building({ label }: { label: string }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" />
        {label}…
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

/** "just now", "12 min ago", "3 h ago", "2 days ago". */
function ago(at: number) {
  const mins = Math.max(0, Math.round((Date.now() - at) / 60_000));
  return mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : mins < 48 * 60 ? `${Math.round(mins / 60)} h ago` : `${Math.round(mins / 1440)} days ago`;
}

function dedupe(sources: Source[]) {
  return sources.filter((s, i, arr) => arr.findIndex((x) => x.document === s.document) === i);
}
