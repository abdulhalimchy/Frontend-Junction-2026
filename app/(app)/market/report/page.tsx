import { Building2, ChevronDown, CircleAlert, FileText, Loader2 } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, Panel } from "@/components/warmline/blocks";
import { Markdown } from "@/components/warmline/markdown";
import { BarList, FundingByYearChart, MarketSizeChart, SizeLegend } from "@/components/warmline/market-charts";
import { CompaniesTable } from "@/components/warmline/market-view";
import { SourceChip } from "@/components/warmline/source-chip";
import { MarketGuardNotice } from "@/components/warmline/market-guard";
import { Pill } from "@/components/warmline/badges";
import { getMarketAnalysis, openMarketAnalysis, type EvidenceSection, type MarketAnalysis } from "@/lib/backend/markets";
import { REGIONS } from "@/lib/cala/market";
import { formatMoney } from "@/lib/format";
import { money, reportNumbers, type ReportNumbers } from "@/lib/market-report";
import { MarketSearch } from "../history-controls";
import { DataNote, DealsTable, Empty, InsightCards, ReportControls, ReportHeader, SectionProblem, SummaryPanel, Tiles, dedupe } from "../report-parts";

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
  if (a.kind === "company") redirect(`/market/company?id=${a.id}`);
  const loading = a.status === "loading";
  const n = reportNumbers(a);
  const s = a.summary;

  return (
    <>
      <ReportHeader title={a.title || a.sector} />
      <div className="mb-3">
        <MarketSearch defaultValue={a.typed || a.title || a.sector} busy={loading} />
      </div>
      <ReportControls
        a={a}
        chips={
          <>
            <span>Market</span>
            <Pill tone="teal">{a.sector}</Pill>
            <span>in</span>
            <Pill tone="neutral">{a.place}</Pill>
          </>
        }
      />

      <div className="space-y-6">
        <Kpis n={n} />
        <SummaryPanel s={s} loading={loading} error={a.errors.summary} />

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

        <InsightCards s={s} />

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

        <DataNote />
      </div>
    </>
  );
}

function Kpis({ n }: { n: ReportNumbers }) {
  const size = n.size?.latest;
  return (
    <Tiles
      tiles={[
        { label: size ? `Market size ${size.year}` : "Market size", value: size ? formatMoney(size.value) : "—", sub: n.size?.forecast ? `${formatMoney(n.size.forecast.value)} by ${n.size.forecast.year}` : n.size?.publisher },
        { label: "Growth (CAGR)", value: n.size?.cagr ? `${n.size.cagr.percent}%` : "—", sub: n.size?.cagr?.period || (n.size?.cagr ? "" : "not published") },
        { label: "Leading companies", value: String(n.companies || "—"), sub: "with a verified record" },
        { label: "Raised by these companies", value: n.equityTotal ? money(n.equityTotal.amount, n.equityTotal.currency) : "—", sub: n.reportedTotals ? "equity, or reported totals" : "equity rounds" },
        { label: `Rounds since ${n.recentSince}`, value: String(n.recentRounds || "—"), sub: "equity and grants" },
      ]}
    />
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

function ReportFailed({ title, error }: { title: string; error: unknown }) {
  return (
    <>
      <ReportHeader title="Market analysis" />
      <EmptyState icon={CircleAlert} title={title} description={error instanceof Error ? error.message : "Unknown error"} />
    </>
  );
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

