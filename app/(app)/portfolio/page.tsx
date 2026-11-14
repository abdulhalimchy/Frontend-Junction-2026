import { Eye, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/warmline/badges";
import { PageHeader, Panel, StatCard } from "@/components/warmline/blocks";
import { SourceChip } from "@/components/warmline/source-chip";
import { CompanyTable } from "@/components/warmline/tables";
import { getCompanies, getInvestor, getSimilarCompanies } from "@/lib/cala";
import { formatFuzzyDate, formatMoney } from "@/lib/format";
import { getProfile } from "@/lib/session";

export const metadata: Metadata = { title: "Portfolio" };

export default async function PortfolioPage() {
  const profile = await getProfile();
  if (profile.role !== "investor") redirect("/home");
  const { investor, check } = (await getInvestor(profile.investorId!))!;
  const portfolio = await getCompanies(investor.portfolioIds);

  // Competitor monitoring: for each portfolio company, competitors outside the portfolio and their latest round.
  const monitored = await Promise.all(
    portfolio.map(async (p) => ({
      company: p,
      competitors: (await getSimilarCompanies(p.id)).filter((s) => !investor.portfolioIds.includes(s.id)),
    })),
  );
  const watchCount = monitored.reduce((n, m) => n + m.competitors.length, 0);

  return (
    <>
      <PageHeader
        title="Portfolio"
        description={`Prefilled from verified records: companies with a sourced investment from ${investor.name}. Remove anything that is not yours.`}
        actions={
          <Button variant="outline" className="bg-card">
            <Plus /> Add company
          </Button>
        }
      />
      <div className="mb-6 grid grid-cols-3 gap-4">
        <StatCard label="Portfolio companies" value={portfolio.length} sources={investor.description.sources} />
        <StatCard label="Competitors monitored" value={watchCount} icon={Eye} hint="Matched on description" />
        <StatCard
          label="Latest investment"
          value={check.stillActive.value.lastInvestment ? formatFuzzyDate(check.stillActive.value.lastInvestment) : "—"}
          sources={check.stillActive.sources}
        />
      </div>
      <Panel className="mb-6" title="Companies">
        <CompanyTable companies={portfolio} />
      </Panel>
      <Panel title="Competitor monitoring" description="Competitors of your portfolio companies that you have not backed. New rounds appear in Alerts.">
        <div className="space-y-4">
          {monitored
            .filter((m) => m.competitors.length)
            .map(({ company, competitors }) => (
              <div key={company.id} className="rounded-lg border">
                <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2.5">
                  <Link href={`/company/${company.id}`} className="text-sm font-medium hover:text-primary">
                    {company.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">{competitors.length} watched</span>
                </div>
                <ul className="divide-y">
                  {competitors.map(({ company: c, reason, overlap }) => {
                    const last = c.rounds.filter((r) => r.kind === "equity").sort((a, b) => (b.date?.date ?? "").localeCompare(a.date?.date ?? ""))[0];
                    return (
                      <li key={c.id} className="flex items-center gap-4 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <Link href={`/company/${c.id}`} className="text-sm font-medium hover:text-primary">
                            {c.name}
                          </Link>
                          <div className="text-xs text-muted-foreground">{reason}</div>
                        </div>
                        <Pill tone={overlap === "high" ? "warning" : "neutral"}>{overlap} overlap</Pill>
                        <div className="w-56 text-right text-[13px]">
                          {last ? (
                            <span className="inline-flex items-center gap-2">
                              <span className="tabular">
                                {last.stage} · {formatMoney(last.amount)}
                              </span>
                              <span className="text-xs text-muted-foreground">{formatFuzzyDate(last.date)}</span>
                              <SourceChip sources={last.sources} />
                            </span>
                          ) : (
                            <span className="text-muted-foreground">No funding on record</span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
        </div>
      </Panel>
    </>
  );
}

// Role-guarded: redirects when the role does not match, so skip instant-navigation validation.
export const instant = false;
