import { Banknote, Building2 } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/warmline/badges";
import { EmptyState, EntityAvatar } from "@/components/warmline/blocks";
import { DataTable, type Row } from "@/components/warmline/data-table";
import { MarketError, MarketView, ResultsLoading } from "@/components/warmline/market-view";
import { SourceChip } from "@/components/warmline/source-chip";
import { fetchCompetitorMarket } from "@/lib/cala/company";
import { FILING_LABEL, REGIONS, regionOf } from "@/lib/cala/market";
import { formatFuzzyDate, formatMoney } from "@/lib/format";
import type { InvestorGroup } from "@/lib/names";
import type { CompanyProfile, FundingRound } from "@/lib/types";

// Parts of the company page that came from the old company analysis (/market?company=<id>): the market of
// the company's competitors, the full rounds table and the investor list.

/** The market of a company's competitors, with a region selector that reloads the page at this section. */
export function CompetitorsSection({ profile, region }: { profile: CompanyProfile; region: string }) {
  return (
    <section id="competitors" className="mt-10 scroll-mt-6">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Competitors&apos; market</h2>
          <p className="text-sm text-muted-foreground">
            Companies identified as competitors of {profile.name}, in {regionOf(region).label}.
          </p>
        </div>
        <form action={`/company/${profile.id}#competitors`} className="flex items-center gap-2">
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

const KIND_LABEL = { equity: "Equity", grant: "Grant", other: "Debt or other" } as const;

export function RoundsTable({ rounds }: { rounds: FundingRound[] }) {
  if (!rounds.length) {
    return <EmptyState compact icon={Banknote} title="No funding on record" description="Normal for bootstrapped and young companies." />;
  }
  const rows: Row[] = rounds.map((r) => ({
    id: r.id,
    cells: {
      date: { display: <span className="whitespace-nowrap text-[13px] tabular">{formatFuzzyDate(r.date)}</span>, sort: r.date?.date ?? null },
      round: { display: <span className="text-[13px] font-medium">{r.stage}</span>, sort: r.stage },
      kind: {
        display: (
          <Pill tone={r.kind === "equity" ? "teal" : r.kind === "grant" ? "success" : "neutral"}>
            {r.stage === FILING_LABEL ? "Filing, unclassified" : KIND_LABEL[r.kind]}
          </Pill>
        ),
        sort: r.kind,
      },
      amount: { display: <span className="whitespace-nowrap text-[13px] tabular">{formatMoney(r.amount)}</span>, sort: r.amount?.amount ?? null },
      sources: { display: <SourceChip sources={r.sources} /> },
    },
  }));
  return (
    <DataTable
      columns={[
        { key: "date", label: "Date" },
        { key: "round", label: "Round" },
        { key: "kind", label: "Type" },
        { key: "amount", label: "Amount", align: "right" },
        { key: "sources", label: "Sources", sortable: false },
      ]}
      rows={rows}
      initialSort={{ key: "date", dir: "desc" }}
    />
  );
}

export function InvestorList({ investors }: { investors: InvestorGroup[] }) {
  if (!investors.length) return <p className="text-sm text-muted-foreground">No investors on record.</p>;
  return (
    <ul className="max-h-80 space-y-2.5 overflow-auto">
      {investors.map((i) => (
        <li key={i.id} className="flex items-center gap-2.5">
          <EntityAvatar name={i.name} kind="investor" size="sm" />
          <span className="min-w-0 flex-1">
            <Link href={`/investor/${i.id}`} className="block truncate text-sm hover:text-primary hover:underline">
              {i.name}
            </Link>
            {i.alsoKnownAs.length > 0 && (
              <span className="block truncate text-xs text-muted-foreground" title={i.alsoKnownAs.join(", ")}>
                Also recorded as {i.alsoKnownAs.join(", ")}
              </span>
            )}
          </span>
          <SourceChip sources={i.sources} />
        </li>
      ))}
    </ul>
  );
}
