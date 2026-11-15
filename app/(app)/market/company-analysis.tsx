import { Banknote, Building2, Globe, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Pill } from "@/components/warmline/badges";
import { EmptyState, EntityAvatar, Panel } from "@/components/warmline/blocks";
import { DataTable, type Row } from "@/components/warmline/data-table";
import { MarketError, MarketView, ResultsLoading } from "@/components/warmline/market-view";
import { SourceChip } from "@/components/warmline/source-chip";
import { fetchCompanyProfile, fetchCompetitorMarket } from "@/lib/cala/company";
import { fetchCompanyExtras } from "@/lib/cala/company-extras";
import { CompanyKeyFacts, CompanyKeyFactsSkeleton } from "@/components/warmline/company-facts";
import { FILING_LABEL, regionOf } from "@/lib/cala/market";
import { formatFuzzyDate, formatMoney, shortPlace } from "@/lib/format";
import { groupInvestors, type InvestorGroup } from "@/lib/names";
import type { CompanyProfile, FundingRound, Source } from "@/lib/types";

/** One company from Cala: sourced profile, funding and investors, then the market of its competitors. */
export async function CompanyAnalysis({ id, region }: { id: string; region: string }) {
  let profile: CompanyProfile;
  try {
    profile = await fetchCompanyProfile(id);
  } catch (e) {
    return <MarketError error={e} />;
  }

  return (
    <>
      <Header p={profile} />
      <div className="mb-6">
        <Suspense fallback={<CompanyKeyFactsSkeleton />}>
          <KeyFacts p={profile} />
        </Suspense>
      </div>
      <div className="mb-6 grid grid-cols-3 gap-6">
        <Panel
          className="col-span-2"
          title="Funding rounds"
          description="Every round with a source. Only equity and grants are summed; filings that match a round by month and amount are merged into it."
        >
          <RoundsTable rounds={profile.rounds} />
        </Panel>
        <Panel title="Investors" description="Organisations and people with a sourced investment.">
          <InvestorList investors={groupInvestors(profile.investors)} />
        </Panel>
      </div>

      <div className="mb-3 mt-10 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Competitors&apos; market</h2>
          <p className="text-sm text-muted-foreground">
            Companies identified as competitors of {profile.name}, in {regionOf(region).label}. Change the region above.
          </p>
        </div>
      </div>
      <Suspense fallback={<ResultsLoading />}>
        <Competitors profile={profile} region={region} />
      </Suspense>
    </>
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

export function Header({ p }: { p: CompanyProfile }) {
  const facts: { icon: typeof MapPin; label: string; value: string; sources: Source[] }[] = [];
  if (p.hq) facts.push({ icon: MapPin, label: "Headquarters", value: shortPlace(p.hq.value) || p.hq.value, sources: p.hq.sources });
  if (p.founded) facts.push({ icon: Building2, label: "Founded", value: formatFuzzyDate(p.founded.value), sources: p.founded.sources });
  if (p.employees) facts.push({ icon: Users, label: "Employees", value: p.employees.value, sources: p.employees.sources });
  if (p.website) facts.push({ icon: Globe, label: "Website", value: p.website.value, sources: p.website.sources });

  return (
    <div className="mb-6 rounded-xl border bg-card p-6">
      <div className="flex items-start gap-4">
        <EntityAvatar name={p.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">{p.name}</h2>
            {p.status && (
              <span className="inline-flex items-center gap-1">
                <Pill tone={/active/i.test(p.status.value) ? "success" : "neutral"}>{p.status.value}</Pill>
                <SourceChip sources={p.status.sources} />
              </span>
            )}
            {p.fundingStage && (
              <span className="inline-flex items-center gap-1">
                <Pill tone="teal">{p.fundingStage.value}</Pill>
                <SourceChip sources={p.fundingStage.sources} />
              </span>
            )}
          </div>
          {p.legalName && p.legalName.value !== p.name && (
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              Legal name: {p.legalName.value} <SourceChip sources={p.legalName.sources} />
            </div>
          )}
          {p.description ? (
            <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed">
              <span>{p.description.value}</span>
              <SourceChip sources={p.description.sources} className="mt-0.5" />
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No description on record.</p>
          )}
          {p.industries.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Industry (coarse code):</span>
              {p.industries.map((i) => (
                <span key={i.name + i.label} className="inline-flex items-center gap-1">
                  <Pill>{i.label ? `${i.name} · ${i.label}` : i.name}</Pill>
                  <SourceChip sources={i.sources} />
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {facts.length > 0 && (
        <dl className="mt-5 grid grid-cols-4 gap-3 border-t pt-4">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <f.icon className="size-3.5" /> {f.label}
              </dt>
              <dd className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                <span className="truncate">{f.value}</span>
                <SourceChip sources={f.sources} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** Same key facts as the company page; the listing (for "Public") comes from the cached extras. */
async function KeyFacts({ p }: { p: CompanyProfile }) {
  const extras = await fetchCompanyExtras(p.id).catch(() => null);
  return <CompanyKeyFacts p={p} listing={extras?.listings[0]} />;
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
