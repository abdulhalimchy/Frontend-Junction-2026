import { ArrowRight, Building2, ChevronDown, CircleAlert, FileText, Loader2, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Pill } from "@/components/warmline/badges";
import { EmptyState, Panel } from "@/components/warmline/blocks";
import { Markdown } from "@/components/warmline/markdown";
import { BarList, FundingByYearChart } from "@/components/warmline/market-charts";
import { CompaniesTable } from "@/components/warmline/market-view";
import { SourceChip } from "@/components/warmline/source-chip";
import { findCompany, getMarketAnalysis, openCompanyAnalysis, type CompanyVerdict, type MarketAnalysis } from "@/lib/backend/markets";
import { formatFuzzyDate, formatMoney } from "@/lib/format";
import { money, numbersFor } from "@/lib/market-report";
import { groupInvestors } from "@/lib/names";
import type { CompanyProfile } from "@/lib/types";
import { Header, InvestorList, RoundsTable } from "../company-analysis";
import { MarketSearch, PickCompanyList } from "../history-controls";
import { DataNote, DealsTable, Empty, InsightCards, ReportControls, ReportHeader, SectionProblem, SummaryPanel, Tiles, dedupe } from "../report-parts";

export const metadata: Metadata = { title: "Company analysis" };

// Company analysis runs in the backend like a market report, and is kept in the same history.
// /market/company?q=…   the backend's LLM reads the text (which company, what it does, any place for
//                       competitors) and lists the matching company records to pick from;
// ?entity=…&name=…&q=…  opens (or starts) the analysis of the picked record and redirects to
// ?id=…                 the stored report, polled while it runs, with Stop / Refresh / Delete.

export default function CompanyPage(props: PageProps<"/market/company">) {
  return (
    <Suspense fallback={<Waiting label="Loading" />}>
      <Company {...props} />
    </Suspense>
  );
}

async function Company({ searchParams }: PageProps<"/market/company">) {
  const sp = await searchParams;
  const str = (k: string, max = 300) => (typeof sp[k] === "string" ? (sp[k] as string).trim().slice(0, max) : "");
  const uuid = (k: string) => (/^[0-9a-f-]{36}$/i.test(str(k)) ? str(k) : null);
  const id = uuid("id");
  const entity = uuid("entity");
  const text = str("q");

  if (entity) {
    let opened: MarketAnalysis;
    try {
      opened = await openCompanyAnalysis({ entity_id: entity, name: str("name", 200), description: str("description", 500), text });
    } catch (e) {
      return <Failed title="Could not start the analysis" error={e} />;
    }
    redirect(`/market/company?id=${opened.id}`);
  }

  if (!id) {
    if (!text) redirect("/market");
    let found: Awaited<ReturnType<typeof findCompany>>;
    try {
      found = await findCompany({ text, force: sp.force === "1" });
    } catch (e) {
      return <Failed title="Could not search for the company" error={e} text={text} />;
    }
    return (
      <>
        <ReportHeader title="Company analysis" />
        <div className="mb-6">
          <MarketSearch kind="company" defaultValue={text} />
        </div>
        {found.verdict.kind !== "company" && !found.candidates.length ? (
          <NotACompany text={text} verdict={found.verdict} />
        ) : found.candidates.length ? (
          <div className="rounded-xl border bg-card">
            <div className="border-b px-5 py-3">
              <h2 className="text-[15px] font-semibold">Which {found.verdict.name || text} do you mean?</h2>
              <p className="text-[13px] text-muted-foreground">
                Brands, legal entities and national subsidiaries are recorded separately. Pick one
                {found.verdict.place !== "Worldwide" ? `; competitors will be looked up in ${found.verdict.place}` : ""}.
              </p>
            </div>
            <PickCompanyList candidates={found.candidates} text={text} />
          </div>
        ) : (
          <EmptyState icon={Search} title={`No company named “${found.verdict.name || text}” found`} description="Try the brand or the legal name, or add what the company does, e.g. “Orange telecom”." />
        )}
      </>
    );
  }

  let a: MarketAnalysis;
  try {
    a = await getMarketAnalysis(id);
  } catch (e) {
    return <Failed title="This analysis is not in your history" error={e} />;
  }
  if (a.kind !== "company") redirect(`/market/report?id=${a.id}`);
  return <CompanyReport a={a} />;
}

function CompanyReport({ a }: { a: MarketAnalysis }) {
  const loading = a.status === "loading";
  const p = a.profile;
  const competitors = a.competitors?.companies ?? [];
  const s = a.summary;
  const own = p ? numbersFor([p], a.year) : null;
  const compare = numbersFor(p ? [p, ...competitors] : competitors, a.year);
  const rivals = numbersFor(competitors, a.year);
  const ranked = compare.topFunded.map((d) => (p && d.href === `/company/${p.id}` ? { ...d, highlight: true, label: `${d.label} (this company)` } : d));

  return (
    <>
      <ReportHeader title={p?.name ?? a.title ?? a.sector} />
      <div className="mb-3">
        <MarketSearch kind="company" defaultValue={a.typed || a.sector} busy={loading} />
      </div>
      <ReportControls
        a={a}
        chips={
          <>
            <span>Company</span>
            <Pill tone="brand">{a.sector}</Pill>
            <span>· competitors in</span>
            <Pill tone="neutral">{a.place}</Pill>
          </>
        }
      />

      {!p && !loading ? (
        a.errors.profile ? <SectionProblem error={a.errors.profile} /> : <EmptyState icon={Building2} title="No company record" description="Refresh the report to try again." />
      ) : (
        <div className="space-y-6">
          {p ? <Header p={p} /> : <Empty loading text="" />}
          {p && <CompanyTiles p={p} year={a.year} />}
          <SummaryPanel s={s} loading={loading} error={a.errors.summary} />

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Funding raised per year" description={own?.currency ? `Its own rounds, in ${own.currency}${own.otherCurrencyRounds ? ` (${own.otherCurrencyRounds} in other currencies not shown)` : ""}` : "Its own rounds"}>
              {own?.currency && own.fundingByYear.length ? <FundingByYearChart data={own.fundingByYear} currency={own.currency} /> : <Empty loading={loading} text="No dated rounds with an amount on record." />}
            </Panel>
            <Panel title="Raised compared with competitors" description={`Equity raised${compare.currency ? `, ${compare.currency}` : ""}${compare.reportedTotals ? "; * reported total, all instruments" : ""}`}>
              <BarList data={ranked} emptyText={loading ? "Loading…" : "No funding amounts on record for it or its competitors."} />
            </Panel>
          </div>

          {p && (
            <div className="grid gap-6 lg:grid-cols-3">
              <Panel className="lg:col-span-2" title="Funding rounds" description="Every round with a source. Equity and grants are counted separately.">
                <RoundsTable rounds={p.rounds} />
              </Panel>
              <Panel title="Investors" description="Organisations and people with a sourced investment.">
                <InvestorList investors={groupInvestors(p.investors)} />
              </Panel>
            </div>
          )}

          <Panel title="Recent funding and deals" description="Rounds, acquisitions and partnerships named in the sources, newest first. Hover a row for its quote." bodyClassName="pt-1">
            {s?.deals?.length ? <DealsTable deals={s.deals} /> : <Empty loading={loading} text={a.errors.news ? a.errors.news.message : "No recent deals were found for this company."} />}
          </Panel>

          <InsightCards s={s} />

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel className="lg:col-span-2" title="Competitors" description={a.competitors ? `${competitors.length} competitors with a verified company record${a.place !== "Worldwide" ? `, in ${a.place}` : ""}` : "Companies with a verified record"} bodyClassName="pt-3">
              {competitors.length ? (
                <CompaniesTable data={{ query: { sector: a.sector, region: a.region }, definition: a.competitors!.definition, companies: competitors, outsideRegion: [] }} currency={null} />
              ) : a.errors.competitors ? (
                <SectionProblem error={a.errors.competitors} />
              ) : (
                <Empty loading={loading} text="No competitors with a verified record were found." icon={Building2} />
              )}
            </Panel>
            <Panel title="Investors in its competitors" description="Who backs the companies it competes with">
              <BarList data={rivals.investors} emptyText={loading ? "Loading…" : "No investors on record."} />
            </Panel>
          </div>

          {a.news && (
            <details className="group rounded-xl border bg-card">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-sm font-medium">
                <FileText className="size-4 text-muted-foreground" /> Sources and full answer
                <span className="text-xs font-normal text-muted-foreground">({a.news.evidence.length} facts)</span>
                <ChevronDown className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-3 border-t px-5 py-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">Recent news and deals</h3>
                  <SourceChip sources={dedupe(a.news.evidence.flatMap((e) => e.sources))} />
                </div>
                <div className="max-h-80 overflow-auto text-[13px] text-muted-foreground">
                  <Markdown>{a.news.summary}</Markdown>
                </div>
                {s && (
                  <p className="text-xs text-subtle">
                    Summary written by {s.model} from {s.factCount} verified facts; {s.checked} claims checked
                    {s.dropped.length ? `, ${s.dropped.length} left out because they did not match their sources.` : ", all matched their sources."}
                  </p>
                )}
              </div>
            </details>
          )}

          <DataNote />
        </div>
      )}
    </>
  );
}

function CompanyTiles({ p, year }: { p: CompanyProfile; year: number }) {
  const n = numbersFor([p], year);
  const equity = p.rounds.filter((r) => r.kind === "equity").sort((x, y) => (y.date?.date ?? "").localeCompare(x.date?.date ?? ""));
  const last = equity[0];
  return (
    <Tiles
      tiles={[
        p.totalFunding
          ? { label: "Total raised", value: formatMoney(p.totalFunding.value), sub: "reported, all instruments", sources: p.totalFunding.sources }
          : { label: "Total raised", value: n.equityTotal ? money(n.equityTotal.amount, n.equityTotal.currency) : "—", sub: n.equityTotal ? "equity rounds summed" : "not on record" },
        { label: "Last equity round", value: last ? last.stage : "—", sub: last ? `${formatMoney(last.amount)} · ${formatFuzzyDate(last.date)}` : "none on record", sources: last?.sources },
        { label: "Investors", value: String(groupInvestors(p.investors).length || "—"), sub: "with a sourced investment" },
        { label: "Employees", value: p.employees?.value ?? "—", sub: p.employees ? "on record" : "not on record", sources: p.employees?.sources },
        { label: "Founded", value: p.founded ? p.founded.value.date.slice(0, 4) : "—", sub: p.fundingStage?.value ?? (p.status?.value || ""), sources: p.founded?.sources },
      ]}
    />
  );
}

function NotACompany({ text, verdict }: { text: string; verdict: CompanyVerdict }) {
  return (
    <div className="rounded-xl border border-warning/30 bg-warning-soft/40 p-5">
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 size-5 text-warning" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold">{verdict.kind === "market" ? `“${text}” looks like a market, not a company` : `“${text}” doesn't look like a company`}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{verdict.reason} No data lookup was run.</p>
          {verdict.kind === "market" && (
            <Button size="sm" className="mt-4" asChild>
              <Link href={`/market/report?${new URLSearchParams({ q: text })}`}>
                Analyse “{text}” as a market <ArrowRight />
              </Link>
            </Button>
          )}
          {verdict.suggestions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground">Did you mean</span>
              {verdict.suggestions.map((s) => (
                <Link key={s} href={`/market/company?${new URLSearchParams({ q: s })}`} className="rounded-full border bg-card px-3 py-1 text-sm hover:border-primary/40 hover:text-primary">
                  {s}
                </Link>
              ))}
            </div>
          )}
          <div className="mt-5 border-t pt-3 text-xs text-muted-foreground">
            Sure it&apos;s a company?{" "}
            <Link href={`/market/company?${new URLSearchParams({ q: text, force: "1" })}`} className="font-medium text-primary hover:underline">
              Search anyway
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Failed({ title, error, text }: { title: string; error: unknown; text?: string }) {
  return (
    <>
      <ReportHeader title="Company analysis" />
      {text !== undefined && (
        <div className="mb-6">
          <MarketSearch kind="company" defaultValue={text} />
        </div>
      )}
      <EmptyState icon={CircleAlert} title={title} description={error instanceof Error ? error.message : "Unknown error"} />
    </>
  );
}

function Waiting({ label }: { label: string }) {
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
