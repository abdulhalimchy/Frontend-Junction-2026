import { Building2, CircleOff, Coins, Landmark, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader, Panel, StatCard } from "@/components/warmline/blocks";
import { FundingChart } from "@/components/warmline/funding-chart";
import { SourceChip } from "@/components/warmline/source-chip";
import { CompanyTable, InvestorTable } from "@/components/warmline/tables";
import { Button } from "@/components/ui/button";
import { getCompanies, getInvestor, getMarket } from "@/lib/cala";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Market" };

export default async function MarketPage() {
  const m = await getMarket("Maritime robotics");
  const [companies, investorRows] = await Promise.all([
    getCompanies(m.topCompanyIds),
    Promise.all(m.topInvestorIds.map((id) => getInvestor(id))),
  ]);

  return (
    <>
      <PageHeader
        title="Market analysis"
        description="Funding activity for companies whose descriptions match this market. Industry codes are only used as a rough first filter."
        actions={
          <>
            <Button variant="outline" size="sm" className="bg-card">
              {m.sector}
            </Button>
            <Button variant="outline" size="sm" className="bg-card">
              {m.region}
            </Button>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-4 gap-4">
        <StatCard label="Companies on record" value={m.companyCount.value} icon={Building2} sources={m.companyCount.sources} hint={`${m.companiesWithoutFunding} with no funding on record`} />
        <StatCard label="Equity raised" value={formatMoney(m.equityTotal.value)} icon={Coins} sources={m.equityTotal.sources} hint="2021–2026, EUR rounds only" />
        <StatCard label="Grants" value={formatMoney(m.grantTotal.value)} icon={Landmark} sources={m.grantTotal.sources} hint="Kept separate from equity" />
        <StatCard label="Median seed round" value={formatMoney(m.medianSeed.value)} icon={TrendingUp} sources={m.medianSeed.sources} />
      </div>
      <div className="mb-6 grid grid-cols-3 gap-6">
        <Panel
          className="col-span-2"
          title="Funding by year"
          description="Equity and grants as separate series, in millions."
          action={<SourceChip sources={m.equityTotal.sources} />}
        >
          <FundingChart data={m.byYear} currency={m.equityTotal.value.currency} />
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CircleOff className="size-3.5" />
            {m.otherCurrencyRounds.count} rounds in {m.otherCurrencyRounds.currencies.join(", ")} are not included. We do not convert currencies.
          </p>
        </Panel>
        <Panel title="Rounds per year">
          <ul className="space-y-2.5">
            {m.byYear.map((y) => (
              <li key={y.year} className="flex items-center gap-3 text-sm">
                <span className="w-10 text-muted-foreground tabular">{y.year}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${(y.rounds / 13) * 100}%` }} />
                </div>
                <span className="w-6 text-right tabular">{y.rounds}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">2026 is year to date.</p>
        </Panel>
      </div>
      <Panel className="mb-6" title="Most funded companies" description="Click a row for the full company brief.">
        <CompanyTable companies={companies} />
      </Panel>
      <Panel title="Most active investors">
        <InvestorTable rows={investorRows.filter((r) => r !== null)} />
      </Panel>
    </>
  );
}
