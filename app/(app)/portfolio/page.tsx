import { Bell, Briefcase, Coins, Landmark } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/warmline/blocks";
import { AddCompanyButton, PortfolioTable, SuggestionsPanel } from "@/components/warmline/portfolio";
import { getPortfolioSuggestions, listPortfolio } from "@/lib/backend/portfolio";
import { formatMoney } from "@/lib/format";
import { getProfile } from "@/lib/session";
import type { PortfolioCompany, PortfolioSuggestions } from "@/lib/types";

export const metadata: Metadata = { title: "Portfolio" };

const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** "€4.2M", or "€4.2M + $500k" when the investor has written checks in more than one currency. */
function totalInvested(companies: PortfolioCompany[]) {
  const by = new Map<string, number>();
  for (const c of companies) if (c.investedAmount !== null) by.set(c.currency, (by.get(c.currency) ?? 0) + c.investedAmount);
  if (!by.size) return "—";
  return [...by.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([currency, amount]) => formatMoney({ amount, currency }))
    .join(" + ");
}

export default async function PortfolioPage() {
  const profile = await getProfile();
  if (profile.role !== "investor") redirect("/home");

  const [list, suggestions] = await Promise.all([
    listPortfolio().then(
      (companies) => ({ companies, error: null as string | null }),
      (e) => ({ companies: [] as PortfolioCompany[], error: message(e, "Could not load your portfolio.") }),
    ),
    getPortfolioSuggestions().then(
      (data) => ({ data: data as PortfolioSuggestions | null, error: null as string | null }),
      (e) => ({ data: null, error: message(e, "Could not load suggestions from Cala.") }),
    ),
  ]);

  const { companies } = list;
  const active = companies.filter((c) => c.status === "active");
  const watched = companies.filter((c) => c.calaCompanyId).length;

  return (
    <>
      <PageHeader
        title="Portfolio"
        description="Your portfolio companies and what you invested. Profiles are filled in from Cala and each company's website, with sources; your investment details stay private."
        actions={<AddCompanyButton />}
      />

      {list.error ? (
        <EmptyState icon={Briefcase} title="Could not load your portfolio" description={list.error} />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Portfolio companies" value={companies.length} icon={Briefcase} hint={`${active.length} active`} />
            <StatCard label="Total invested" value={totalInvested(companies)} icon={Coins} hint="From the amounts you entered" />
            <StatCard label="Board seats" value={companies.filter((c) => c.boardSeat).length} icon={Landmark} />
            <StatCard
              label="Watched for alerts"
              value={watched}
              icon={Bell}
              hint={
                <>
                  New rounds show up in{" "}
                  <Link href="/alerts" className="underline-offset-2 hover:underline">
                    Alerts
                  </Link>
                </>
              }
            />
          </div>

          <SuggestionsPanel initial={suggestions.data} error={suggestions.error} />

          <Panel title="Companies" description="Edit a company to update your investment or fix its profile.">
            <PortfolioTable companies={companies} />
          </Panel>
        </>
      )}
    </>
  );
}

// Role-guarded: redirects when the role does not match, so skip instant-navigation validation.
export const instant = false;
