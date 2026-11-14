import { ArrowLeft, Building2, CircleAlert, FileText, Handshake, History, Loader2, Scale, Search, Sparkles, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader, Panel } from "@/components/warmline/blocks";
import { Markdown } from "@/components/warmline/markdown";
import { CompaniesTable, MarketError } from "@/components/warmline/market-view";
import { SourceChip } from "@/components/warmline/source-chip";
import { MarketGuardNotice } from "@/components/warmline/market-guard";
import { Pill } from "@/components/warmline/badges";
import {
  getMarketAnalysis,
  openMarketAnalysis,
  type EvidenceSection,
  type MarketAnalysis,
  type PlayersSection,
  type ReportSummary,
  type SectionError,
} from "@/lib/backend/markets";
import { formatMoney } from "@/lib/format";
import { REGIONS, regionOf } from "@/lib/cala/market";
import type { Source } from "@/lib/types";
import { DeleteAnalysisButton, PollWhileLoading, RefreshAnalysisButton } from "../history-controls";

export const metadata: Metadata = { title: "Market analysis" };

export default function ReportPage(props: PageProps<"/market/report">) {
  return (
    <Suspense fallback={<SectionLoading label="Preparing the report" />}>
      <Report {...props} />
    </Suspense>
  );
}

const SECTIONS = [
  { id: "summary", label: "Summary", icon: Sparkles },
  { id: "size", label: "Market size", icon: Scale },
  { id: "players", label: "Leading players", icon: Building2 },
  { id: "deals", label: "Funding and deals", icon: Handshake },
  { id: "trends", label: "Trends", icon: TrendingUp },
];

// The backend runs the analysis (Cala questions, then the checked summary) and keeps it in the user's history.
// /market/report?sector=…&region=… opens (or starts) the analysis of typed text and redirects to its saved
// report, /market/report?id=…, which reads the stored result: reopening it never spends Cala credit.

async function Report({ searchParams }: PageProps<"/market/report">) {
  const sp = await searchParams;
  const id = typeof sp.id === "string" && /^[0-9a-f-]{36}$/i.test(sp.id) ? sp.id : null;
  const sector = (typeof sp.sector === "string" && sp.sector.trim().slice(0, 80)) || "";
  const regionParam = typeof sp.region === "string" && REGIONS[sp.region] ? sp.region : "europe";

  if (!id) {
    const text = sector || "mobile applications";
    let opened: Awaited<ReturnType<typeof openMarketAnalysis>>;
    try {
      opened = await openMarketAnalysis({ text, region: regionParam, force: sp.force === "1" });
    } catch (e) {
      return <ReportFailed title="Could not start the analysis" error={e} />;
    }
    if (!opened.analysis) {
      return (
        <>
          <ReportHeader title="Market analysis" description={regionOf(regionParam).label} />
          <SearchForm sector={text} region={regionParam} />
          <MarketGuardNotice
            text={text}
            verdict={opened.verdict}
            searchHref={(s) => `/market/report?${new URLSearchParams({ sector: s, region: regionParam })}`}
            runAnywayHref={`/market/report?${new URLSearchParams({ sector: text, region: regionParam, force: "1" })}`}
          />
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
  const typed = a.typed && a.typed !== a.sector ? a.typed : "";

  return (
    <>
      <PollWhileLoading active={loading} />
      <ReportHeader
        title={
          <span>
            Market analysis: <span className="capitalize">{a.sector}</span>
          </span>
        }
        description={`${regionOf(a.region).label}. Every section is built from Cala: written answers come with the facts behind them, and every number links to its source. Reports are saved in your history; reopening one is free.`}
      />
      <SearchForm sector={typed || a.sector} region={a.region} />
      {typed && (
        <p className="-mt-1 mb-2 text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">“{a.sector}”</span> (you typed “{typed}”), so analyses of the same market are shared.{" "}
          <Link href={`/market/report?${new URLSearchParams({ sector: typed, region: a.region, force: "1" })}`} className="text-primary hover:underline">
            Search “{typed}” exactly
          </Link>{" "}
          <span className="text-xs">(may use Cala credit)</span>
        </p>
      )}
      <div className="-mt-1 mb-4 flex items-center justify-end gap-3 text-xs text-muted-foreground">
        {loading ? (
          <span className="flex items-center gap-1.5">
            <Loader2 className="size-3.5 animate-spin text-primary" />
            {a.runs > 1 ? "Updating from Cala; the saved answers stay until new ones arrive…" : "Asking Cala; sections appear as they arrive…"}
          </span>
        ) : (
          <span>Saved {a.finishedAt ? ago(Date.parse(a.finishedAt)) : ""} · run {a.runs} {a.runs === 1 ? "time" : "times"}</span>
        )}
        <RefreshAnalysisButton id={a.id} running={loading} />
        <DeleteAnalysisButton id={a.id} name={a.sector} afterDelete="/market/history" />
      </div>

      {!loading && a.runs > 1 && a.changes.length > 0 && (
        <div className="mb-6 rounded-xl border border-primary/25 bg-teal-soft/40 p-4 text-sm">
          <div className="font-medium">What changed in the last refresh</div>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-muted-foreground">
            {a.changes.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      <nav className="sticky top-14 z-10 -mx-1 mb-6 flex gap-1 bg-background/90 px-1 py-2 backdrop-blur">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground hover:text-foreground">
            <s.icon className="size-3.5" />
            {s.label}
          </a>
        ))}
      </nav>

      <div className="space-y-10">
        <Section id="summary" title="Executive summary" description="Written from the Cala facts in the sections below. Every claim was checked against the facts it cites; anything that did not match was left out.">
          <Part value={a.summary} error={a.errors.summary} loading={loading} label="Waiting for Cala's answers, then writing the summary">
            {(s) => <ExecutiveSummary s={s} />}
          </Part>
        </Section>
        <Section id="size" title="Market size and growth" description="Figures as published. Publishers define the market differently, so their numbers differ; we show them side by side and never average or convert them.">
          <Part value={a.size} error={a.errors.size} loading={loading} label="Asking Cala about market size">
            {(s) => <EvidenceView s={s} />}
          </Part>
        </Section>
        <Section id="players" title="Leading players" description="Established companies and challengers, public or private, resolved to Cala company records.">
          <Part value={a.players} error={a.errors.players} loading={loading} label="Finding the leading companies">
            {(p) => <Players res={p} sector={a.sector} region={a.region} />}
          </Part>
        </Section>
        <Section id="deals" title="Funding and deals" description={`Notable rounds, acquisitions, IPOs and exits in ${a.year - 1} and ${a.year}, as reported.`}>
          <Part value={a.deals} error={a.errors.deals} loading={loading} label="Asking Cala about funding and deals">
            {(s) => <EvidenceView s={s} />}
          </Part>
        </Section>
        <Section id="trends" title="Trends, drivers and challenges">
          <Part value={a.trends} error={a.errors.trends} loading={loading} label="Asking Cala about trends">
            {(s) => <EvidenceView s={s} />}
          </Part>
        </Section>
      </div>
    </>
  );
}

function ReportHeader({ title, description }: { title: React.ReactNode; description: string }) {
  return (
    <PageHeader
      eyebrow={
        <div className="flex items-center gap-4">
          <Link href="/market" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3" /> Choose analysis
          </Link>
          <Link href="/market/history" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <History className="size-3" /> History
          </Link>
        </div>
      }
      title={title}
      description={description}
    />
  );
}

function SearchForm({ sector, region }: { sector: string; region: string }) {
  return (
    <form action="/market/report" className="mb-4 flex items-center gap-2 rounded-xl border bg-card p-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input name="sector" defaultValue={sector} placeholder="Market, e.g. mobile applications" className="h-9 pl-9" />
      </div>
      <select
        name="region"
        defaultValue={region}
        aria-label="Region"
        className="h-9 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {Object.entries(REGIONS).map(([key, r]) => (
          <option key={key} value={key}>
            {r.label}
          </option>
        ))}
      </select>
      <Button type="submit" className="h-9">
        Analyse market
      </Button>
    </form>
  );
}

function ReportFailed({ title, error }: { title: string; error: unknown }) {
  return (
    <>
      <ReportHeader title="Market analysis" description="" />
      <EmptyState icon={CircleAlert} title={title} description={error instanceof Error ? error.message : "Unknown error"} />
    </>
  );
}

/** One stored section: its value, its error, a loader while the backend is still answering, or nothing on record. */
function Part<T>({ value, error, loading, label, children }: { value?: T; error?: SectionError; loading: boolean; label: string; children: (v: T) => React.ReactNode }) {
  if (value) return <>{children(value)}</>;
  if (loading) return <SectionLoading label={label} />;
  if (error) return error.kind === "llm" ? <EmptyState compact icon={Sparkles} title="Could not write the summary" description={error.message} /> : <MarketError error={new Error(error.message)} />;
  return <EmptyState compact icon={FileText} title="Not available" description="Refresh the report to ask Cala again." />;
}

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {description && <p className="mb-3 mt-0.5 max-w-3xl text-sm text-muted-foreground">{description}</p>}
      <div className={description ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

const INSIGHT = {
  trend: { label: "Trend", tone: "teal" },
  opportunity: { label: "Opportunity", tone: "success" },
  risk: { label: "Risk", tone: "warning" },
} as const;

/** One row per report (same fact and scope): its figures by year, quotes joined; regional scopes before global ones. */
function groupSizes(sizes: ReportSummary["sizes"]) {
  type Row = { publisher: string; scope: string; quotes: string[]; cagr: ReportSummary["sizes"][number]["cagr"]; sources: Source[]; figures: ReportSummary["sizes"] };
  const groups = new Map<string, Row>();
  for (const f of sizes) {
    const key = `${f.factId}|${f.scope.toLowerCase()}`;
    const g = groups.get(key) ?? { publisher: f.publisher, scope: f.scope, quotes: [], cagr: null, sources: f.sources, figures: [] };
    g.figures.push(f);
    if (!g.quotes.includes(f.quote)) g.quotes.push(f.quote);
    g.cagr ??= f.cagr;
    groups.set(key, g);
  }
  const global = (scope: string) => Number(/global|world/i.test(scope));
  return [...groups.values()]
    .map((g) => ({ ...g, quote: g.quotes.join(" … "), figures: [...g.figures].sort((a, b) => a.year - b.year) }))
    .sort((a, b) => global(a.scope) - global(b.scope) || a.figures[0].year - b.figures[0].year);
}

function ExecutiveSummary({ s }: { s: ReportSummary & { fetchedAt?: number } }) {
  return (
    <div className="space-y-6">
      <Panel className="border-primary/25">
        {s.headline && (
          <p className="flex items-start gap-2 text-base font-medium leading-relaxed">
            <span>{s.headline.text}</span>
            <SourceChip sources={s.headline.sources} className="mt-1" />
          </p>
        )}
        {s.bullets.length > 0 && (
          <ul className="mt-4 space-y-2.5">
            {s.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                <span className="flex-1">{b.text}</span>
                <SourceChip sources={b.sources} className="mt-0.5" />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {s.sizes.length > 0 && (
        <Panel title="Market size as published" description="Each figure is quoted from its source and matched to it. Publishers scope the market differently, so figures are not comparable with each other. Regional figures first.">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Publisher</th>
                  <th className="px-3 py-2 font-medium">Scope</th>
                  <th className="px-3 py-2 font-medium">Figures</th>
                  <th className="px-3 py-2 font-medium">Growth</th>
                  <th className="px-3 py-2 font-medium">Quote</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {groupSizes(s.sizes).map((g, i) => (
                  <tr key={i} className="bg-card align-top">
                    <td className="px-3 py-2.5 font-medium">{g.publisher}</td>
                    <td className="px-3 py-2.5 text-[13px] text-muted-foreground">{g.scope}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-0.5 whitespace-nowrap text-[13px] tabular">
                        {g.figures.map((f, j) => (
                          <span key={j}>
                            <span className="text-muted-foreground">{f.year}</span> <span className="font-semibold">{formatMoney(f.value)}</span>
                            {f.kind === "forecast" && <span className="text-xs text-subtle"> forecast</span>}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[13px] whitespace-nowrap">
                      {g.cagr ? `${g.cagr.percent}% CAGR${g.cagr.period ? ` (${g.cagr.period})` : ""}` : <span className="text-subtle">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-start gap-2">
                        <span className="line-clamp-3 text-xs italic text-muted-foreground">“{g.quote}”</span>
                        <SourceChip sources={g.sources} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {s.insights.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {s.insights.map((i, k) => (
            <div key={k} className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <Pill tone={INSIGHT[i.kind].tone}>{INSIGHT[i.kind].label}</Pill>
                <SourceChip sources={i.sources} />
              </div>
              <div className="mt-2 text-sm font-semibold">{i.title}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{i.text}</p>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        Written by {s.model} from {s.factCount} Cala facts{s.fetchedAt ? `, ${ago(s.fetchedAt)}` : ""}
        {s.tokens ? ` (${s.tokens.total.toLocaleString("en")} tokens: ${s.tokens.input.toLocaleString("en")} in, ${s.tokens.output.toLocaleString("en")} out, ${s.tokens.thinking.toLocaleString("en")} reasoning)` : ""}. {s.checked} claims checked
        {s.dropped.length ? `, ${s.dropped.length} left out because they did not match their sources.` : ", all matched their sources."}
        {s.dropped.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-primary">Show what was left out</summary>
            <ul className="mt-2 space-y-1">
              {s.dropped.map((d, i) => (
                <li key={i}>
                  <span className="text-foreground">{d.what}</span> — {d.reason}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}

/** Cala's written answer on the left, the facts it rests on (with their sources) on the right. */
function EvidenceView({ s }: { s: EvidenceSection }) {
  if (!s.evidence.length && !s.summary.trim()) {
    return <EmptyState compact title="Cala has nothing on record for this question" description="Try a broader market description or region." />;
  }
  const all = dedupe(s.evidence.flatMap((e) => e.sources));
  return (
    <div className="grid grid-cols-5 gap-6">
      <Panel
        className="col-span-3"
        title="Cala's answer"
        description={`Written by Cala from the ${s.evidence.length} facts listed alongside. Check figures against their sources.${fetched(s.fetchedAt)}`}
        action={<SourceChip sources={all} />}
      >
        <Markdown>{s.summary}</Markdown>
      </Panel>
      <Panel className="col-span-2 self-start" title="Facts behind it" description="Each fact as Cala extracted it, with its origin.">
        {s.evidence.length ? (
          <ul className="max-h-[560px] space-y-3 overflow-auto pr-1">
            {s.evidence.map((e) => (
              <li key={e.id} className="rounded-lg border bg-background/60 p-3">
                <p className="line-clamp-5 text-[13px] leading-relaxed text-muted-foreground">{clean(e.text)}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-medium">{e.sources[0]?.name ?? "Unknown source"}</span>
                  <SourceChip sources={e.sources} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Cala returned no supporting facts for this answer, so treat it as unverified.</p>
        )}
      </Panel>
    </div>
  );
}

function Players({ res, sector, region }: { res: PlayersSection; sector: string; region: string }) {
  if (!res.companies.length) {
    return <EmptyState compact icon={Building2} title="No leading companies with a Cala profile" description="Try a broader market description or region." />;
  }
  return (
    <Panel
      title={`${res.companies.length} companies`}
      description={`${res.unresolved ? `${res.unresolved} more were named by Cala without a company record, so they are not shown.` : "Resolved to Cala company records."}${fetched(res.fetchedAt)}`}
      bodyClassName="pt-3"
    >
      <CompaniesTable data={{ query: { sector, region }, definition: res.definition, companies: res.companies, outsideRegion: [] }} currency={null} />
    </Panel>
  );
}

function SectionLoading({ label }: { label: string }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" />
        {label}… a new question takes Cala about a minute.
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

/** "just now", "12 min ago", "3 h ago", "2 days ago". */
function ago(at: number) {
  const mins = Math.max(0, Math.round((Date.now() - at) / 60_000));
  return mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : mins < 48 * 60 ? `${Math.round(mins / 60)} h ago` : `${Math.round(mins / 1440)} days ago`;
}

/** " Fetched from Cala 3 h ago." for section descriptions; empty when unknown. */
function fetched(at?: number) {
  return at ? ` Fetched from Cala ${ago(at)}.` : "";
}

/** KnowBit text can carry markdown and page furniture; show it as plain text. */
function clean(text: string) {
  return text
    .replace(/[#*_`>|]+/g, " ")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupe(sources: Source[]) {
  return sources.filter((s, i, arr) => arr.findIndex((x) => x.document === s.document) === i);
}
