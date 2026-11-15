import { Building2, History, LineChart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/warmline/blocks";
import { ResultsLoading } from "@/components/warmline/market-view";
import { REGIONS } from "@/lib/cala/market";
import { MarketSearch } from "./history-controls";

export const metadata: Metadata = { title: "Market analysis" };

// Two kinds of analysis, chosen up front, both run in the backend and kept in one history:
// - Market analysis lives at /market/report (size, players, funding and deals, trends, checked summary).
// - Company analysis lives at /market/company (profile, funding, deals, competitors, checked summary).

const MARKET_PRESETS = ["climate tech in the Nordics", "seed-stage fintech in Finland", "underwater drones in Europe", "AI chips worldwide"];
const COMPANY_PRESETS = ["Orange telecom", "Wolt competitors in Europe", "Aiven", "GE HealthCare"];

export default function AnalysisPage(props: PageProps<"/market">) {
  return (
    <Suspense fallback={<ResultsLoading />}>
      <Analysis {...props} />
    </Suspense>
  );
}

async function Analysis({ searchParams }: PageProps<"/market">) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim().slice(0, 300) : "");
  const text = str("sector") || str("q");
  const regionParam = REGIONS[str("region")] ? str("region") : "";

  // Company analysis moved to /market/company (backend-run, kept in history). Old links still work.
  if (/^[0-9a-f-]{36}$/i.test(str("company"))) redirect(`/market/company?${new URLSearchParams({ entity: str("company") })}`);
  if (str("mode") === "company") redirect(text ? `/market/company?${new URLSearchParams({ q: text })}` : "/market");
  // Old market-view links (/market?sector=…) open the market analysis.
  if (text) redirect(`/market/report?${new URLSearchParams({ sector: text, ...(regionParam ? { region: regionParam } : {}) })}`);
  return <Chooser />;
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
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="hover-lift flex flex-col rounded-2xl border bg-card p-5 shadow-panel sm:p-6">
          <div className="flex size-10 items-center justify-center rounded-xl bg-brand-soft">
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
        <section className="hover-lift flex flex-col rounded-2xl border bg-card p-5 shadow-panel sm:p-6">
          <div className="flex size-10 items-center justify-center rounded-xl bg-brand-soft">
            <Building2 className="size-5 text-primary" />
          </div>
          <h2 className="mt-4 text-lg font-semibold tracking-tight">Analyse a company</h2>
          <p className="mt-1 text-sm text-muted-foreground">Its verified profile, funding history and investors, recent deals, and how it compares with its competitors.</p>
          <div className="mt-5">
            <MarketSearch kind="company" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Write it your way: the name, what it does, or where to look for competitors.</p>
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-muted-foreground">Try:</span>
            {COMPANY_PRESETS.map((t) => (
              <Link key={t} href={`/market/company?${new URLSearchParams({ q: t })}`} className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                {t}
              </Link>
            ))}
          </div>
          <p className="mt-auto pt-5 text-xs text-subtle">You pick the exact company first: brands, legal entities and subsidiaries are recorded separately. Reports are saved to your history.</p>
        </section>
      </div>
    </>
  );
}




