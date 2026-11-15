import { ArrowUpRight, Briefcase, Coins, Landmark, Swords, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { cn } from "@/lib/utils";
import { redirect } from "next/navigation";
import { ROLE_HOME } from "@/lib/account";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/warmline/blocks";
import { AddCompanyButton, PortfolioTable, SuggestionsPanel } from "@/components/warmline/portfolio";
import { CompetitorPanel, InsightsPoller, LeadInvestorsPanel, RefreshFundingButton } from "@/components/warmline/portfolio-insights";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listAlerts } from "@/lib/backend/alerts";
import { getPortfolioAnalysesStatus, getPortfolioSuggestions, listPortfolio, listPortfolioAnalyses } from "@/lib/backend/portfolio";
import { normaliseName } from "@/lib/cala/market";
import { indexAnalyses, plainError } from "@/lib/portfolio-insights";
import { slushAttendeeIndex } from "@/lib/cala/slush";
import { formatMoney } from "@/lib/format";
import { getRole } from "@/lib/session";
import type { Alert, InvestorsAnalysis, PortfolioAnalysis, PortfolioCompany, PortfolioRounds, PortfolioSuggestions } from "@/lib/types";

export const metadata: Metadata = { title: "Portfolio" };

const message = plainError;

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

/** Companies with an equity round on record after the investor's entry date. */
function raisedSinceEntry(companies: PortfolioCompany[], analyses: PortfolioAnalysis[]) {
  const rounds = new Map(analyses.filter((a) => a.kind === "rounds").map((a) => [a.company, a.data as unknown as PortfolioRounds]));
  return companies.filter((c) => {
    const entry = c.investedOn;
    const r = rounds.get(c.id)?.rounds ?? [];
    return entry && r.some((x) => x.kind === "equity" && x.date && x.date.slice(0, entry.length) > entry);
  }).length;
}

export default async function PortfolioPage() {
  if ((await getRole()) !== "investor") redirect(ROLE_HOME.founder);

  const [list, suggestions, analyses, status, alerts, slush] = await Promise.all([
    listPortfolio().then(
      (companies) => ({ companies, error: null as string | null }),
      (e) => ({ companies: [] as PortfolioCompany[], error: message(e, "Could not load your portfolio.") }),
    ),
    getPortfolioSuggestions().then(
      (data) => ({ data: data as PortfolioSuggestions | null, error: null as string | null }),
      (e) => ({ data: null, error: message(e, "Could not load suggestions.") }),
    ),
    listPortfolioAnalyses().catch(() => [] as PortfolioAnalysis[]),
    getPortfolioAnalysesStatus().catch(() => null),
    listAlerts().catch(() => [] as Alert[]),
    slushAttendeeIndex().then(
      (index) => ({ index, error: null as string | null }),
      (e) => ({ index: null, error: message(e, "Could not load Slush attendees.") }),
    ),
  ]);

  const { companies } = list;
  const active = companies.filter((c) => c.status === "active");
  const index = indexAnalyses(analyses);

  // Slush: which companies attend, and which investors found for them do.
  const attends = (id: string, name: string) => !!slush.index && (slush.index.ids.has(id) || slush.index.names.has(normaliseName(name)));
  const attending = companies.filter((c) => c.calaCompanyId && attends(c.calaCompanyId, c.name)).map((c) => c.id);
  const attendingInvestors = analyses
    .filter((a) => a.kind === "investors" && a.data.investors)
    .flatMap((a) => (a.data as unknown as InvestorsAnalysis).investors)
    .filter((i) => attends(i.id, i.name))
    .map((i) => i.id);

  // From the status endpoint, which also expires runs that died, so a dead run never keeps the page polling.
  const busy = status
    ? status.loading + status.enriching > 0
    : analyses.some((a) => a.status === "loading") || companies.some((c) => c.enrichment.status === "pending" || c.enrichment.status === "processing");
  const inCala = companies.filter((c) => c.calaCompanyId).length;
  // Tab badges: companies with a lead investor at Slush, and recent competitor rounds.
  const going = new Set(attendingInvestors);
  const withLeads = analyses.filter(
    (a) => a.kind === "investors" && (a.data as unknown as Partial<InvestorsAnalysis>).investors?.some((i) => going.has(i.id)),
  ).length;
  const competitorAlerts = alerts.filter((a) => a.kind === "portfolio_competitor").length;

  return (
    <>
      <InsightsPoller active={busy} version={status?.version ?? null} />
      <PageHeader
        title="Portfolio"
        description="Your portfolio companies and what you invested. Profiles are filled in from verified records and each company's website, with sources; your investment details stay private."
        actions={
          <>
            <RefreshFundingButton count={inCala} />
            <AddCompanyButton />
          </>
        }
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
              label="Raised since you invested"
              value={raisedSinceEntry(companies, analyses)}
              icon={TrendingUp}
              hint="Companies with a new equity round on record"
            />
          </div>

          <Tabs defaultValue="companies" className="gap-5">
            <TabsList variant="line" className="h-auto w-full justify-start gap-1 border-b p-0">
              <PortfolioTab value="companies" icon={Briefcase} label="Companies" count={companies.length} />
              <PortfolioTab value="leads" icon={ArrowUpRight} label="Lead investors" count={withLeads || undefined} />
              <PortfolioTab value="competitors" icon={Swords} label="Competitors" count={competitorAlerts || undefined} tone="warning" />
            </TabsList>

            <TabsContent value="companies" className="space-y-6">
              <SuggestionsPanel initial={suggestions.data} error={suggestions.error} />
              <Panel title="Companies" description="Edit a company to update your investment or fix its profile. Funding comes from verified records, with sources.">
                <PortfolioTable companies={companies} analyses={index} />
              </Panel>
            </TabsContent>

            <TabsContent value="leads">
              {companies.length ? (
                <LeadInvestorsPanel companies={companies} analyses={index} attending={attending} attendingInvestors={attendingInvestors} slushError={slush.error} />
              ) : (
                <EmptyState icon={ArrowUpRight} title="No companies yet" description="Add portfolio companies to find who could lead their next round." />
              )}
            </TabsContent>

            <TabsContent value="competitors">
              {companies.length ? (
                <CompetitorPanel companies={companies} analyses={index} alerts={alerts} />
              ) : (
                <EmptyState icon={Swords} title="No companies yet" description="Add portfolio companies to monitor their competitors." />
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </>
  );
}

// Role-guarded: redirects when the role does not match, so skip instant-navigation validation.
export const instant = false;

function PortfolioTab({
  value,
  icon: Icon,
  label,
  count,
  tone = "neutral",
}: {
  value: string;
  icon: LucideIcon;
  label: string;
  count?: number;
  tone?: "neutral" | "warning";
}) {
  return (
    <TabsTrigger
      value={value}
      className="h-10 flex-none rounded-none px-3 text-[13px] after:bottom-[-1px] after:bg-primary data-active:text-primary"
    >
      <Icon />
      {label}
      {count !== undefined && (
        <span className={cn("rounded-full px-1.5 text-[11px] tabular", tone === "warning" ? "bg-warning-soft text-warning" : "bg-muted text-muted-foreground")}>
          {count}
        </span>
      )}
    </TabsTrigger>
  );
}
