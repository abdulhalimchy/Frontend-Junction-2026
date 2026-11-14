import { ArrowRight, Building2, FileText, LineChart, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, EntityAvatar, PageHeader } from "@/components/warmline/blocks";
import { MarketError, MarketView, ResultsLoading } from "@/components/warmline/market-view";
import { getMarket } from "@/lib/cala";
import { mocksEnabled } from "@/lib/cala/client";
import { findCompanies } from "@/lib/cala/company";
import { REGIONS, regionOf } from "@/lib/cala/market";
import type { MarketData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CompanyAnalysis } from "./company-analysis";

export const metadata: Metadata = { title: "Market" };

const PRESETS = ["maritime robotics", "industrial robotics", "climate tech", "health tech", "fintech", "quantum computing"];
const COMPANY_PRESETS = ["GE HealthCare", "Wheel.me", "Hyperion Robotics", "Aiven"];

type Mode = "market" | "company";
type Period = "recent" | "any";
type Params = { mode: Mode; text: string; region: string; companyId: string | null; period: Period; since: number | null };

export default function MarketPage(props: PageProps<"/market">) {
  return (
    <>
      <PageHeader
        title="Market analysis"
        description="Analyse a market by describing what companies do, or analyse one company and the market of its competitors. Every number comes with its sources; equity and grants are kept apart and currencies are never converted."
      />
      <Suspense fallback={<ResultsLoading />}>
        <MarketContent {...props} />
      </Suspense>
    </>
  );
}

async function MarketContent({ searchParams }: PageProps<"/market">) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim().slice(0, 100) : "");
  // A typed name while a company is selected starts a new company search.
  const companyId = /^[0-9a-f-]{36}$/i.test(str("company")) && !str("sector") ? str("company") : null;
  const mode: Mode = companyId || str("mode") === "company" || str("company") ? "company" : "market";
  const text = str("sector") || (mode === "market" ? PRESETS[0] : "");
  // Markets default to the Nordics; competitors of a company default to anywhere.
  const region = REGIONS[str("region")] ? str("region") : mode === "company" ? "anywhere" : "nordics";
  // Default to companies that raised recently; "any time" mostly surfaces well-known, older companies.
  const period: Period = str("period") === "any" ? "any" : "recent";
  await connection();
  const since = period === "recent" ? new Date().getFullYear() - 1 : null;
  const p: Params = { mode, text, region, companyId, period, since };

  return (
    <>
      <Filters p={p} />
      {mode === "company" && mocksEnabled() ? (
        <EmptyState icon={Building2} title="Company analysis needs live Cala data" description="Set USE_MOCKS=false and add CALA_API_KEY to .env.local." />
      ) : companyId ? (
        <Suspense key={`${companyId}|${region}`} fallback={<ResultsLoading />}>
          <CompanyAnalysis id={companyId} region={region} />
        </Suspense>
      ) : mode === "company" ? (
        text ? (
          <Suspense key={`pick|${text}`} fallback={<ResultsLoading />}>
            <CompanyPicker text={text} region={region} />
          </Suspense>
        ) : (
          <EmptyState icon={Building2} title="Type a company name" description="We look it up in Cala by name, then show its profile, funding and competitors." />
        )
      ) : (
        <>
          {!mocksEnabled() && (
            <Suspense key={`hint|${text}`} fallback={null}>
              <CompanyHint text={text} region={region} />
            </Suspense>
          )}
          <Suspense key={`${text}|${region}|${since}`} fallback={<ResultsLoading />}>
            <MarketResults sector={text} region={region} since={since} />
          </Suspense>
        </>
      )}
    </>
  );
}

function href(params: Record<string, string>) {
  return `/market?${new URLSearchParams(params)}`;
}

function Filters({ p }: { p: Params }) {
  const presets = p.mode === "market" ? PRESETS : COMPANY_PRESETS;
  return (
    <div className="mb-6 rounded-xl border bg-card p-4">
      <div className="mb-3 inline-flex rounded-lg bg-muted p-0.5 text-xs font-medium">
        {(
          [
            { key: "market", label: "Market", icon: LineChart },
            { key: "company", label: "Company", icon: Building2 },
            { key: "report", label: "Full report", icon: FileText },
          ] as const
        ).map((m) => (
          <Link
            key={m.key}
            href={
              m.key === "market"
                ? href({ region: p.mode === "market" ? p.region : "nordics" })
                : m.key === "company"
                  ? href({ mode: "company" })
                  : `/market/report?${new URLSearchParams({ sector: p.mode === "market" ? p.text : "", region: p.region }).toString().replace(/sector=&/, "")}`
            }
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5",
              p.mode === m.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <m.icon className="size-3.5" />
            {m.label}
          </Link>
        ))}
      </div>
      <form action="/market" className="flex items-center gap-2">
        {p.mode === "company" && <input type="hidden" name="mode" value="company" />}
        {p.companyId && <input type="hidden" name="company" value={p.companyId} />}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="sector"
            defaultValue={p.companyId ? "" : p.text}
            placeholder={
              p.mode === "market" ? "Describe the market, e.g. underwater drones" : p.companyId ? "Search another company" : "Company name, e.g. GE HealthCare"
            }
            className="h-9 pl-9"
          />
        </div>
        <select
          name="region"
          defaultValue={p.region}
          aria-label={p.mode === "market" ? "Region" : "Region for competitors"}
          className="h-9 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {Object.entries(REGIONS).map(([key, r]) => (
            <option key={key} value={key}>
              {r.label}
            </option>
          ))}
        </select>
        {p.mode === "market" && (
          <select
            name="period"
            defaultValue={p.period}
            aria-label="Funding period"
            className="h-9 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="recent">Raised in last 2 years</option>
            <option value="any">Any time</option>
          </select>
        )}
        <Button type="submit" className="h-9">
          {p.mode === "market" ? "Analyse market" : p.companyId ? "Search or update" : "Find company"}
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-muted-foreground">Try:</span>
        {presets.map((t) => (
          <Link
            key={t}
            href={
              p.mode === "market"
                ? href({ sector: t, region: p.region, ...(p.period === "any" ? { period: "any" } : {}) })
                : href({ mode: "company", sector: t })
            }
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs",
              t === p.text && !p.companyId ? "border-primary/30 bg-teal-soft text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t}
          </Link>
        ))}
      </div>
    </div>
  );
}

/** In market mode: if the text is exactly a company name in Cala, offer company analysis. */
async function CompanyHint({ text, region }: { text: string; region: string }) {
  let exact;
  try {
    exact = (await findCompanies(text)).exact;
  } catch {
    return null; // The market below shows any API error.
  }
  if (!exact.length) return null;
  const top = exact[0];
  return (
    <div className="mb-6 flex items-center gap-3 rounded-xl border border-primary/25 bg-teal-soft/50 px-4 py-3">
      <EntityAvatar name={top.name} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">“{text}” is also a company in Cala: {top.name}</div>
        <div className="truncate text-xs text-muted-foreground">
          {top.description ?? top.entityType}
          {exact.length > 1 && ` · ${exact.length - 1} more entit${exact.length === 2 ? "y" : "ies"} with this name`}
        </div>
      </div>
      <Button size="sm" asChild>
        <Link href={exact.length > 1 ? href({ mode: "company", sector: text }) : href({ company: top.id, region: "anywhere" })}>
          Analyse company <ArrowRight />
        </Link>
      </Button>
      <span className="sr-only">Market results for “{text}” in {regionOf(region).label} are below.</span>
    </div>
  );
}

/** In company mode with a name: list Cala's matches, exact names first. Several legal entities can share a name. */
async function CompanyPicker({ text, region }: { text: string; region: string }) {
  let res;
  try {
    res = await findCompanies(text);
  } catch (e) {
    return <MarketError error={e} />;
  }
  const exactIds = new Set(res.exact.map((m) => m.id));
  const list = [...res.exact, ...res.all.filter((m) => !exactIds.has(m.id))];
  if (!list.length) {
    return <EmptyState icon={Search} title={`No company named “${text}” in Cala`} description="Try the brand or the legal name, e.g. “Baron App” for Cameo." />;
  }
  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b px-5 py-3">
        <h2 className="text-[15px] font-semibold">Companies matching “{text}”</h2>
        <p className="text-[13px] text-muted-foreground">
          Cala records brands, legal entities and national subsidiaries separately. Pick the one you mean.
        </p>
      </div>
      <ul className="divide-y">
        {list.map((m) => (
          <li key={m.id}>
            <Link href={href({ company: m.id, region })} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40">
              <EntityAvatar name={m.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {m.name}
                  {exactIds.has(m.id) && (
                    <span className="rounded-full bg-teal-soft px-2 py-0.5 text-[11px] text-accent-foreground">Exact name</span>
                  )}
                </div>
                <div className="truncate text-xs text-muted-foreground">{m.description ?? m.entityType}</div>
              </div>
              <ArrowRight className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function MarketResults({ sector, region, since }: { sector: string; region: string; since: number | null }) {
  let data: MarketData;
  try {
    data = await getMarket({ sector, region, since });
  } catch (e) {
    return <MarketError error={e} />;
  }
  if (!data.companies.length) {
    return (
      <EmptyState
        icon={Search}
        title={`No companies on record for “${sector}” in ${regionOf(region).label}${since ? ` that raised since ${since}` : ""}`}
        description={`Describe what the companies do in other words, pick a wider region${since ? ", set Funding to Any time" : ""}, or switch to Company to look up a company by name.`}
      />
    );
  }
  return (
    <MarketView
      data={data}
      title={`Companies in ${sector}, ${regionOf(region).label}${since ? `, raised since ${since}` : ""}`}
    />
  );
}
