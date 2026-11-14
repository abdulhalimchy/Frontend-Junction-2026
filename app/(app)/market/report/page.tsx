import { ArrowLeft, Building2, Coins, FileText, Handshake, Loader2, Scale, Search, Sparkles, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader, Panel } from "@/components/warmline/blocks";
import { Markdown } from "@/components/warmline/markdown";
import { CompaniesTable, MarketError, MarketView } from "@/components/warmline/market-view";
import { SourceChip } from "@/components/warmline/source-chip";
import { mocksEnabled } from "@/lib/cala/client";
import { REGIONS, regionOf } from "@/lib/cala/market";
import {
  marketCapital,
  marketDeals,
  marketFunding,
  marketPlayers,
  marketSize,
  marketTrends,
  type EvidenceSection,
  type ReportQuery,
} from "@/lib/cala/report";
import type { Source } from "@/lib/types";

export const metadata: Metadata = { title: "Market report" };

export default function ReportPage(props: PageProps<"/market/report">) {
  return (
    <Suspense fallback={<SectionLoading label="Preparing the report" />}>
      <Report {...props} />
    </Suspense>
  );
}

const SECTIONS = [
  { id: "size", label: "Market size", icon: Scale },
  { id: "players", label: "Leading players", icon: Building2 },
  { id: "capital", label: "Capital flows", icon: Coins },
  { id: "trends", label: "Trends", icon: TrendingUp },
  { id: "deals", label: "M&A and exits", icon: Handshake },
];

async function Report({ searchParams }: PageProps<"/market/report">) {
  const sp = await searchParams;
  const sector = (typeof sp.sector === "string" && sp.sector.trim().slice(0, 80)) || "mobile applications";
  const region = typeof sp.region === "string" && REGIONS[sp.region] ? sp.region : "europe";
  await connection();
  const q: ReportQuery = { sector, region, year: new Date().getFullYear() };
  const place = regionOf(region).label;

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href={`/market?${new URLSearchParams({ sector, region })}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3" /> Market analysis
          </Link>
        }
        title={
          <span>
            Market report: <span className="capitalize">{sector}</span>
          </span>
        }
        description={`${place}. Every section is built from Cala: written answers come with the facts behind them, and every number links to its source. Sections appear as Cala answers; a new market takes about a minute.`}
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
          Build report
        </Button>
      </form>

      <nav className="sticky top-14 z-10 -mx-1 mb-6 flex gap-1 bg-background/90 px-1 py-2 backdrop-blur">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground hover:text-foreground">
            <s.icon className="size-3.5" />
            {s.label}
          </a>
        ))}
      </nav>

      {mocksEnabled() ? (
        <EmptyState icon={FileText} title="Market reports need live Cala data" description="Set USE_MOCKS=false and add CALA_API_KEY to .env.local." />
      ) : (
        <div className="space-y-10">
          <SummaryPlaceholder />
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
          <Section id="capital" title="Capital flows" description={`Notable rounds since ${q.year - 1} as reported, then the rounds on record in Cala's company data.`}>
            <Suspense fallback={<SectionLoading label="Asking Cala about recent funding" />}>
              <EvidenceView load={marketFunding(q)} />
            </Suspense>
            <div className="mt-6">
              <Suspense fallback={<SectionLoading label="Collecting rounds from company records" />}>
                <Capital q={q} />
              </Suspense>
            </div>
          </Section>
          <Section id="trends" title="Trends, drivers and challenges">
            <Suspense fallback={<SectionLoading label="Asking Cala about trends" />}>
              <EvidenceView load={marketTrends(q)} />
            </Suspense>
          </Section>
          <Section id="deals" title="M&A, IPOs and exits" description={`Since ${q.year - 2}.`}>
            <Suspense fallback={<SectionLoading label="Asking Cala about deals" />}>
              <EvidenceView load={marketDeals(q)} />
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

function SummaryPlaceholder() {
  const hasLlm = Boolean(process.env.LLM_API_KEY);
  return (
    <div className="flex items-start gap-3 rounded-xl border border-dashed bg-card/60 p-4 text-sm text-muted-foreground">
      <Sparkles className="mt-0.5 size-4 text-primary" />
      <div>
        <div className="font-medium text-foreground">Executive summary</div>
        {hasLlm
          ? "Coming next: a written summary and extracted size figures, each checked against the Cala facts below."
          : "Add LLM_API_KEY to .env.local to get a written summary and extracted size figures, each checked against the Cala facts below."}
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
        description={`Written by Cala from the ${s.evidence.length} facts listed alongside. Check figures against their sources.`}
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
      description={res.unresolved ? `${res.unresolved} more were named by Cala without a company record, so they are not shown.` : undefined}
      bodyClassName="pt-3"
    >
      <CompaniesTable data={{ query: { sector: q.sector, region: q.region }, definition: res.definition, companies: res.companies, outsideRegion: [] }} currency={null} />
    </Panel>
  );
}

async function Capital({ q }: { q: ReportQuery }) {
  let data;
  try {
    data = await marketCapital(q);
  } catch (e) {
    return <MarketError error={e} />;
  }
  const withRounds = data.companies.filter((c) => c.rounds.length);
  if (!withRounds.length) {
    return (
      <EmptyState
        compact
        icon={Coins}
        title="No structured round data yet"
        description={
          data.companies.length
            ? `Cala named ${data.companies.length} recently funded startups (${data.companies.map((c) => c.name).join(", ")}), but their company records have no rounds yet. The reported rounds above are the evidence.`
            : `No startups on record that raised since ${q.year - 1}.`
        }
      />
    );
  }
  return <MarketView data={data} title={`Startups that raised since ${q.year - 1}`} />;
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
