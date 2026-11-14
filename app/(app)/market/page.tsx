import { ArrowLeft, ArrowRight, Building2, History, LineChart, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, EntityAvatar, PageHeader } from "@/components/warmline/blocks";
import { MarketError, ResultsLoading } from "@/components/warmline/market-view";
import { mocksEnabled } from "@/lib/cala/client";
import { findCompanies } from "@/lib/cala/company";
import { REGIONS } from "@/lib/cala/market";
import { cn } from "@/lib/utils";
import { CompanyAnalysis } from "./company-analysis";
import { MarketSearch } from "./history-controls";

export const metadata: Metadata = { title: "Market analysis" };

// Two kinds of analysis, chosen up front:
// - Market analysis lives at /market/report (size, players, funding and deals, trends, checked summary).
// - Company analysis lives here: /market?mode=company to find a company, /market?company=<id> to analyse it.

const MARKET_PRESETS = ["climate tech in the Nordics", "seed-stage fintech in Finland", "underwater drones in Europe", "AI chips worldwide"];
const COMPANY_PRESETS = ["GE HealthCare", "Wheel.me", "Hyperion Robotics", "Aiven"];

export default function AnalysisPage(props: PageProps<"/market">) {
  return (
    <Suspense fallback={<ResultsLoading />}>
      <Analysis {...props} />
    </Suspense>
  );
}

async function Analysis({ searchParams }: PageProps<"/market">) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim().slice(0, 100) : "");
  const text = str("sector");
  const regionParam = REGIONS[str("region")] ? str("region") : "";

  // A typed name while a company is selected starts a new company search.
  const companyId = /^[0-9a-f-]{36}$/i.test(str("company")) && !text ? str("company") : null;
  const companyMode = Boolean(companyId) || str("mode") === "company" || Boolean(str("company"));

  // Old market-view links (/market?sector=…) now open the market analysis.
  if (!companyMode && text) redirect(`/market/report?${new URLSearchParams({ sector: text, ...(regionParam ? { region: regionParam } : {}) })}`);
  if (!companyMode) return <Chooser />;

  // Competitors of a company default to anywhere.
  const region = regionParam || "anywhere";
  return (
    <>
      <PageHeader
        eyebrow={<BackToChooser />}
        title="Company analysis"
        description="One company's verified profile, funding history and investors, then the market of its competitors."
      />
      <CompanySearch text={companyId ? "" : text} region={region} companyId={companyId} />
      {mocksEnabled() ? (
        <EmptyState icon={Building2} title="Company analysis needs live data" description="Set USE_MOCKS=false in .env.local. The data lookups run in the backend (CALA_API_KEY in its .env)." />
      ) : companyId ? (
        <Suspense key={`${companyId}|${region}`} fallback={<ResultsLoading />}>
          <CompanyAnalysis id={companyId} region={region} />
        </Suspense>
      ) : text ? (
        <Suspense key={`pick|${text}`} fallback={<ResultsLoading />}>
          <CompanyPicker text={text} region={region} />
        </Suspense>
      ) : (
        <EmptyState icon={Building2} title="Type a company name" description="We look it up by name, then show its profile, funding and competitors." />
      )}
    </>
  );
}

function BackToChooser() {
  return (
    <Link href="/market" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-3" /> Back
    </Link>
  );
}

/** Pick the kind of analysis first; each card starts it directly. */
function Chooser() {
  return (
    <>
      <PageHeader
        title="Market analysis"
        description="We use the Cala encyclopedia to get verified data with cited sources. Every number links to where it was published."
        actions={
          <Link href="/market/history" className="flex h-9 items-center gap-1.5 rounded-lg border bg-card px-3 text-sm hover:bg-muted">
            <History className="size-4" /> History
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-6">
        <section className="flex flex-col rounded-2xl border bg-card p-6 shadow-[0_1px_2px_rgba(22,24,26,0.04)]">
          <div className="flex size-10 items-center justify-center rounded-xl bg-teal-soft">
            <LineChart className="size-5 text-primary" />
          </div>
          <h2 className="mt-4 text-lg font-semibold tracking-tight">Analyse a market</h2>
          <p className="mt-1 text-sm text-muted-foreground">Market size and growth, funding by year, the most funded companies, active investors and recent deals.</p>
          <div className="mt-5">
            <MarketSearch />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Write it your way: the market, and a place or stage if you like.</p>
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-muted-foreground">Try:</span>
            {MARKET_PRESETS.map((t) => (
              <Link key={t} href={`/market/report?${new URLSearchParams({ q: t })}`} className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                {t}
              </Link>
            ))}
          </div>
          <p className="mt-auto pt-5 text-xs text-subtle">A new market takes about a minute and can be stopped. Reports are saved to your history, so reopening one is free.</p>
        </section>
        <ChoiceCard
          icon={Building2}
          title="Analyse a company"
          description="A company's sourced profile, funding history and investors, then the market of its competitors."
          action="/market"
          hidden={{ mode: "company" }}
          placeholder="Company name, e.g. GE HealthCare"
          button="Find company"
          presets={COMPANY_PRESETS.map((t) => ({ label: t, href: `/market?${new URLSearchParams({ mode: "company", sector: t })}` }))}
          note="You pick the exact company first: brands, legal entities and subsidiaries are recorded separately."
        />
      </div>
    </>
  );
}

function ChoiceCard({
  icon: Icon,
  title,
  description,
  action,
  hidden,
  placeholder,
  button,
  withRegion,
  presets,
  note,
}: {
  icon: typeof LineChart;
  title: string;
  description: string;
  action: string;
  hidden?: Record<string, string>;
  placeholder: string;
  button: string;
  withRegion?: string;
  presets: { label: string; href: string }[];
  note: string;
}) {
  return (
    <section className="flex flex-col rounded-2xl border bg-card p-6 shadow-[0_1px_2px_rgba(22,24,26,0.04)]">
      <div className="flex size-10 items-center justify-center rounded-xl bg-teal-soft">
        <Icon className="size-5 text-primary" />
      </div>
      <h2 className="mt-4 text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <form action={action} className="mt-5 space-y-2">
        {Object.entries(hidden ?? {}).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="sector" required placeholder={placeholder} className="h-10 pl-9" />
        </div>
        <div className="flex gap-2">
          {withRegion && <RegionSelect name="region" defaultValue={withRegion} label="Region" className="flex-1" />}
          <Button type="submit" className={cn("h-10", !withRegion && "w-full")}>
            {button} <ArrowRight />
          </Button>
        </div>
      </form>
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-muted-foreground">Try:</span>
        {presets.map((p) => (
          <Link key={p.label} href={p.href} className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
            {p.label}
          </Link>
        ))}
      </div>
      <p className="mt-auto pt-5 text-xs text-subtle">{note}</p>
    </section>
  );
}

function RegionSelect({ name, defaultValue, label, className }: { name: string; defaultValue: string; label: string; className?: string }) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      aria-label={label}
      className={cn("h-10 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50", className)}
    >
      {Object.entries(REGIONS).map(([key, r]) => (
        <option key={key} value={key}>
          {r.label}
        </option>
      ))}
    </select>
  );
}

/** Search bar for the company flow. With a company selected, an empty box just changes the competitors' region. */
function CompanySearch({ text, region, companyId }: { text: string; region: string; companyId: string | null }) {
  return (
    <form action="/market" className="mb-6 flex items-center gap-2 rounded-xl border bg-card p-3">
      <input type="hidden" name="mode" value="company" />
      {companyId && <input type="hidden" name="company" value={companyId} />}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input name="sector" defaultValue={text} placeholder={companyId ? "Search another company" : "Company name, e.g. GE HealthCare"} className="h-9 pl-9" />
      </div>
      <span className="text-xs text-muted-foreground">Competitors in</span>
      <RegionSelect name="region" defaultValue={region} label="Region for competitors" className="h-9" />
      <Button type="submit" className="h-9">
        {companyId ? "Update" : "Find company"}
      </Button>
    </form>
  );
}

/** Lists Cala's matches, exact names first. Several legal entities can share a name. */
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
    return <EmptyState icon={Search} title={`No company named “${text}” found`} description="Try the brand or the legal name, e.g. “Baron App” for Cameo." />;
  }
  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b px-5 py-3">
        <h2 className="text-[15px] font-semibold">Companies matching “{text}”</h2>
        <p className="text-[13px] text-muted-foreground">Brands, legal entities and national subsidiaries are recorded separately. Pick the one you mean.</p>
      </div>
      <ul className="divide-y">
        {list.map((m) => (
          <li key={m.id}>
            <Link href={`/market?${new URLSearchParams({ company: m.id, region })}`} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40">
              <EntityAvatar name={m.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {m.name}
                  {exactIds.has(m.id) && <span className="rounded-full bg-teal-soft px-2 py-0.5 text-[11px] text-accent-foreground">Exact name</span>}
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
