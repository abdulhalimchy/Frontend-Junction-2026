import { ArrowLeft, Building2, FileText, Handshake, Loader2, Scale, Search, Sparkles, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader, Panel } from "@/components/warmline/blocks";
import { Markdown } from "@/components/warmline/markdown";
import { CompaniesTable, MarketError } from "@/components/warmline/market-view";
import { SourceChip } from "@/components/warmline/source-chip";
import { mocksEnabled } from "@/lib/cala/client";
import { checkMarketText, type GuardVerdict } from "@/lib/backend/markets";
import { knownMarkets, rememberMarket } from "@/lib/cala/known-markets";
import { MarketGuardNotice } from "@/components/warmline/market-guard";
import { RefreshButton } from "@/components/warmline/refresh-button";
import { reportSummary, type ReportSummary } from "@/lib/cala/report-summary";
import { formatMoney } from "@/lib/format";
import { Pill } from "@/components/warmline/badges";
import { REGIONS, normaliseSector, regionOf } from "@/lib/cala/market";
import {
  marketDeals,
  marketPlayers,
  marketSize,
  marketTrends,
  REFRESH_WINDOW_MS,
  type EvidenceSection,
  type ReportQuery,
} from "@/lib/cala/report";
import type { Source } from "@/lib/types";

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

async function Report({ searchParams }: PageProps<"/market/report">) {
  const sp = await searchParams;
  const sector = (typeof sp.sector === "string" && sp.sector.trim().slice(0, 80)) || "mobile applications";
  const region = typeof sp.region === "string" && REGIONS[sp.region] ? sp.region : "europe";
  await connection();
  const now = currentTime();
  // A refresh token is the click time; only a recent one counts, so reloads never re-spend credit.
  const token = Number(typeof sp.refresh === "string" ? sp.refresh : NaN);
  const refresh = Number.isFinite(token) && token <= now + 5_000 && now - token < REFRESH_WINDOW_MS;
  const place = regionOf(region).label;
  const typed = normaliseSector(sector);
  // Before spending Cala credit: is this a market, and what is its standard name? Matching known markets lets
  // different wordings ("mobile apps", "mobile applications") share one cached analysis. "Run anyway" and the
  // exact-wording link (force=1) skip the check and use the text as typed.
  const verdict: GuardVerdict =
    sp.force === "1" || mocksEnabled() ? { kind: "market", reason: "", suggestions: [] } : await checkMarketText(sector, await knownMarkets());
  const name = verdict.kind === "market" && verdict.canonical ? verdict.canonical : typed;
  const q: ReportQuery = { sector: name, region, year: new Date(now).getFullYear(), refresh };
  if (verdict.kind === "market" && !mocksEnabled()) await rememberMarket(name);

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/market" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3" /> Choose analysis
          </Link>
        }
        title={
          <span>
            Market analysis: <span className="capitalize">{name}</span>
          </span>
        }
        description={`${place}. Every section is built from Cala: written answers come with the facts behind them, and every number links to its source. Sections appear as Cala answers; a new market takes about a minute and four Cala questions.`}
      />

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
      {name !== typed && verdict.kind === "market" && (
        <p className="-mt-1 mb-2 text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">“{name}”</span> (you typed “{sector}”), so analyses of the same market are shared.{" "}
          <Link href={`/market/report?${new URLSearchParams({ sector, region, force: "1" })}`} className="text-primary hover:underline">
            Search “{sector}” exactly
          </Link>{" "}
          <span className="text-xs">(may use Cala credit)</span>
        </p>
      )}
      {verdict.kind === "market" && !mocksEnabled() && (
        <div className="-mt-1 mb-4 flex items-center justify-end gap-3 text-xs text-muted-foreground">
          {refresh ? "Fetching fresh answers from Cala…" : "Answers are cached for 24 hours."}
          <RefreshButton href={`/market/report?${new URLSearchParams({ sector: name, region, force: "1" })}`} />
        </div>
      )}

{verdict.kind === "market" && (
      <nav className="sticky top-14 z-10 -mx-1 mb-6 flex gap-1 bg-background/90 px-1 py-2 backdrop-blur">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground hover:text-foreground">
            <s.icon className="size-3.5" />
            {s.label}
          </a>
        ))}
      </nav>
      )}

      {mocksEnabled() ? (
        <EmptyState icon={FileText} title="Market reports need live Cala data" description="Set USE_MOCKS=false and add CALA_API_KEY to .env.local." />
      ) : verdict.kind !== "market" ? (
        <MarketGuardNotice
          text={sector}
          verdict={verdict}
          searchHref={(s) => `/market/report?${new URLSearchParams({ sector: s, region })}`}
          runAnywayHref={`/market/report?${new URLSearchParams({ sector, region, force: "1" })}`}
        />
      ) : (
        <div className="space-y-10">
          <Section id="summary" title="Executive summary" description="Written from the Cala facts in the sections below. Every claim was checked against the facts it cites; anything that did not match was left out.">
            <Suspense fallback={<SectionLoading label="Waiting for Cala's answers, then writing the summary" />}>
              <ExecutiveSummary q={q} />
            </Suspense>
          </Section>
          <Section id="size" title="Market size and growth" description="Figures as published. Publishers define the market differently, so their numbers differ; we show them side by side and never average or convert them.">
            <Suspense fallback={<SectionLoading label="Asking Cala about market size" />}>
              <EvidenceView load={marketSize(q)} />
            </Suspense>
          </Section>
          <Section id="players" title="Leading players" description="Established companies and challengers, public or private, resolved to Cala company records.">
            <Suspense fallback={<SectionLoading label="Finding the leading companies" />}>
              <Players q={q} />
            </Suspense>
          </Section>
          <Section id="deals" title="Funding and deals" description={`Notable rounds, acquisitions, IPOs and exits in ${q.year - 1} and ${q.year}, as reported.`}>
            <Suspense fallback={<SectionLoading label="Asking Cala about funding and deals" />}>
              <EvidenceView load={marketDeals(q)} />
            </Suspense>
          </Section>
          <Section id="trends" title="Trends, drivers and challenges">
            <Suspense fallback={<SectionLoading label="Asking Cala about trends" />}>
              <EvidenceView load={marketTrends(q)} />
            </Suspense>
          </Section>
        </div>
      )}
    </>
  );
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

async function ExecutiveSummary({ q }: { q: ReportQuery }) {
  let s: Awaited<ReturnType<typeof reportSummary>>;
  try {
    s = await reportSummary(q);
  } catch (e) {
    return (
      <EmptyState
        compact
        icon={Sparkles}
        title="Could not write the summary"
        description={e instanceof Error ? e.message : "Unknown error"}
      />
    );
  }
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
async function EvidenceView({ load }: { load: Promise<EvidenceSection> }) {
  let s: EvidenceSection;
  try {
    s = await load;
  } catch (e) {
    return <MarketError error={e} />;
  }
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

async function Players({ q }: { q: ReportQuery }) {
  let res;
  try {
    res = await marketPlayers(q);
  } catch (e) {
    return <MarketError error={e} />;
  }
  if (!res.companies.length) {
    return <EmptyState compact icon={Building2} title="No leading companies with a Cala profile" description="Try a broader market description or region." />;
  }
  return (
    <Panel
      title={`${res.companies.length} companies`}
      description={`${res.unresolved ? `${res.unresolved} more were named by Cala without a company record, so they are not shown.` : "Resolved to Cala company records."}${fetched(res.fetchedAt)}`}
      bodyClassName="pt-3"
    >
      <CompaniesTable data={{ query: { sector: q.sector, region: q.region }, definition: res.definition, companies: res.companies, outsideRegion: [] }} currency={null} />
    </Panel>
  );
}

function SectionLoading({ label }: { label: string }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" />
        {label}… a new question takes Cala about a minute; repeats are instant.
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

/** Request time; this page renders per request (after connection()), so reading the clock is intended. */
function currentTime() {
  return Date.now();
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
