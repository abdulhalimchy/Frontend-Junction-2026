import { Building2 } from "lucide-react";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/warmline/blocks";
import { MarketError, MarketView, ResultsLoading } from "@/components/warmline/market-view";
import { fetchCompetitorMarket } from "@/lib/cala/company";
import { REGIONS, regionOf } from "@/lib/cala/market";
import type { CompanyProfile } from "@/lib/types";

// The market of the company's competitors, shown on the company page. The rounds table and the investor list
// are shared with the company report: app/(app)/market/company-analysis.tsx.

/** The market of a company's competitors, with a region selector that reloads the page at this section. */
export function CompetitorsSection({ profile, region }: { profile: CompanyProfile; region: string }) {
  return (
    <section id="competitors" className="mt-10 scroll-mt-6">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">Competitors&apos; market</h2>
          <p className="text-sm text-muted-foreground">
            Companies identified as competitors of {profile.name}, in {regionOf(region).label}.
          </p>
        </div>
        <form action={`/company/${profile.id}#competitors`} className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Competitors in</span>
          <select
            name="region"
            defaultValue={region}
            aria-label="Region for competitors"
            className="h-9 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {Object.entries(REGIONS).map(([key, r]) => (
              <option key={key} value={key}>
                {r.label}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline" className="h-9 bg-card">
            Update
          </Button>
        </form>
      </div>
      <Suspense key={region} fallback={<ResultsLoading />}>
        <Competitors profile={profile} region={region} />
      </Suspense>
    </section>
  );
}

async function Competitors({ profile, region }: { profile: CompanyProfile; region: string }) {
  let data;
  try {
    data = await fetchCompetitorMarket(profile, region);
  } catch (e) {
    return <MarketError error={e} />;
  }
  if (!data.companies.length) {
    return (
      <EmptyState
        icon={Building2}
        title={`No competitors with a verified profile in ${regionOf(region).label}`}
        description={data.unresolved ? `${data.unresolved} competitor(s) were named without a company profile, so they are not shown.` : "Try a wider region."}
      />
    );
  }
  return (
    <MarketView
      data={data}
      title={`Competitors of ${profile.name}`}
      note={
        data.unresolved > 0 ? (
          <> {data.unresolved} more competitor(s) were named without a verified company profile, so they have no sourced data to show.</>
        ) : null
      }
    />
  );
}
