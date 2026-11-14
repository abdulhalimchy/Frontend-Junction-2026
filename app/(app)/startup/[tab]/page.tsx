import { Suspense } from "react";
import Loading from "@/app/(app)/loading";
import { CircleAlert, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SlushTag } from "@/components/warmline/badges";
import { EmptyState, PageHeader, Panel, TabNav } from "@/components/warmline/blocks";
import { EditStartupButton } from "@/components/warmline/edit-startup-button";
import { StartupProfile } from "@/components/warmline/startup-profile";
import { AnalysisTab } from "@/components/warmline/analysis-tab";
import { StartupGaps } from "@/components/warmline/startup-gaps";
import { getAnalysis, getStartup } from "@/lib/backend/startups";
import type { CompetitorsAnalysis, InvestorsAnalysis } from "@/lib/types";
import { DEMO_STARTUP_ID, startupHref } from "@/lib/startup-cookie";
import { CompanyOverview } from "@/components/warmline/company-overview";
import { DeckCheck } from "@/components/warmline/deck-check";
import { CompanyTable, InvestorTable } from "@/components/warmline/tables";
import { getCompany, getInvestorsForCompany, getSimilarCompanies } from "@/lib/cala";
import { getActiveStartupId, getDeckCheck, getProfile, getStartups } from "@/lib/session";

const TABS = ["overview", "competitors", "investors", "deck"] as const;
type Tab = (typeof TABS)[number];

export function generateStaticParams() {
  return TABS.map((tab) => ({ tab }));
}

export const metadata = { title: "My startup" };

async function StartupPageContent({ params, searchParams }: PageProps<"/startup/[tab]">) {
  const { tab } = (await params) as { tab: Tab };
  const requested = (await searchParams).s;
  if (!TABS.includes(tab)) notFound();
  const profile = await getProfile();
  if (profile.role !== "founder") redirect("/home");

  // The startup comes from the URL (?s=); without one, the last startup chosen (cookie), else the demo.
  const { items } = await getStartups();
  const wanted = typeof requested === "string" && items.some((s) => s.id === requested) ? requested : null;
  if (!wanted) redirect(startupHref(await getActiveStartupId(items), tab));
  if (wanted !== DEMO_STARTUP_ID) return <AddedStartup id={wanted} tab={tab} />;
  const sid = DEMO_STARTUP_ID;

  const companyId = profile.companyId!;
  const [company, competitors, investors] = await Promise.all([
    getCompany(companyId),
    getSimilarCompanies(companyId),
    getInvestorsForCompany(companyId),
  ]);
  if (!company) notFound();

  return (
    <>
      <PageHeader
        title={company.name}
        description="How Cala sees your company. If something is wrong, fix it at the source; we show what the sources say."
        eyebrow={company.attendsSlush ? <SlushTag label="Attending Slush 2026" /> : undefined}
        actions={
          <Button variant="outline" className="bg-card" asChild>
            <Link href={`/company/${company.id}`}>
              <ExternalLink /> Public brief
            </Link>
          </Button>
        }
      />
      <TabNav
        active={tab}
        tabs={[
          { key: "overview", label: "Overview", href: startupHref(sid, "overview") },
          { key: "competitors", label: "Competitors", href: startupHref(sid, "competitors"), count: competitors.length },
          { key: "investors", label: "Find investors", href: startupHref(sid, "investors"), count: investors.length },
          { key: "deck", label: "Deck check", href: startupHref(sid, "deck") },
        ]}
      />
      {tab === "overview" && <CompanyOverview company={company} />}
      {tab === "competitors" && (
        <Panel title="Competitors" description="Matched on description. Industry codes are only a rough first filter, so each match shows why.">
          <CompanyTable
            companies={competitors.map((c) => c.company)}
            reasons={Object.fromEntries(competitors.map((c) => [c.id, c.reason]))}
            extra={{
              key: "overlap",
              label: "Overlap",
              cells: Object.fromEntries(
                competitors.map((c) => [c.id, <span key={c.id} className="text-[13px] capitalize">{c.overlap}</span>]),
              ),
            }}
          />
        </Panel>
      )}
      {tab === "investors" && (
        <Panel title="Investors for your next round" description="Each one checked: still active, leads or follows, and whether they back a competitor.">
          <InvestorTable
            rows={investors}
            competitorNames={Object.fromEntries(competitors.map((c) => [c.id, c.company.name]))}
          />
        </Panel>
      )}
      {tab === "deck" && <DeckTab companyName={company.name} startupId={null} />}
    </>
  );
}

/** A startup the founder added: its profile, competitors and investors from Cala, and the deck check. */
async function AddedStartup({ id, tab }: { id: string; tab: Tab }) {
  // Reads the stored analyses (never starts one): they run only when the founder asks on the tab.
  const [competitorsRun, investorsRun] = await Promise.all([
    getAnalysis(id, "competitors").catch(() => null),
    getAnalysis(id, "investors").catch(() => null),
  ]);
  const compData = competitorsRun?.data as Partial<CompetitorsAnalysis> | undefined;
  const invData = investorsRun?.data as Partial<InvestorsAnalysis> | undefined;
  const comp = compData?.companies ? (compData as CompetitorsAnalysis) : null;
  const inv = invData?.investors ? (invData as InvestorsAnalysis) : null;
  const startup = await getStartup(id).catch((e: unknown) => (e instanceof Error ? e : new Error("Could not load the startup.")));
  if (startup instanceof Error)
    return <EmptyState icon={CircleAlert} title="Could not load this startup" description={startup.message} />;

  return (
    <>
      <PageHeader
        title={startup.name}
        description="Your startup as you entered it. Values found by the lookup keep their sources; anything you typed is your own entry."
        actions={
          <>
            <EditStartupButton key={id} startup={startup} />
            {startup.calaCompanyId && (
              <Button variant="outline" className="bg-card" asChild>
                <Link href={`/company/${startup.calaCompanyId}`}>
                  <ExternalLink /> Public brief
                </Link>
              </Button>
            )}
          </>
        }
      />
      <TabNav
        active={tab}
        tabs={[
          { key: "overview", label: "Overview", href: startupHref(id, "overview") },
          { key: "competitors", label: "Competitors", href: startupHref(id, "competitors"), count: comp?.companies.length },
          { key: "investors", label: "Find investors", href: startupHref(id, "investors"), count: inv?.investors.length },
          { key: "deck", label: "Deck check", href: startupHref(id, "deck") },
        ]}
      />
      {tab === "overview" && <StartupProfile key={id} startup={startup} />}
      {tab === "competitors" && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 min-w-0">
            <AnalysisTab key={`${id}-competitors`} startupId={startup.id} startupName={startup.name} kind="competitors" initial={competitorsRun} />
          </div>
          <div>
            <StartupGaps
              key={id}
              startup={startup}
              raisedOnRecord={comp ? !!comp.you.raised : null}
              calaStage={comp && !comp.you.self_reported ? (comp.you.stage?.value ?? null) : null}
            />
          </div>
        </div>
      )}
      {tab === "investors" && <AnalysisTab key={`${id}-investors`} startupId={startup.id} startupName={startup.name} kind="investors" initial={investorsRun} />}
      {tab === "deck" && <DeckTab key={id} companyName={startup.name} startupId={id} />}
    </>
  );
}

/** Deck check for one startup: only decks uploaded for it (startupId null = the demo company). */
async function DeckTab({ companyName, startupId }: { companyName: string; startupId: string | null }) {
  const { result, error } = await getDeckCheck(startupId);
  return (
    <>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        Check your own deck before investors do. Each claim is matched against Cala; anything without a source is marked “Can&apos;t verify”.
      </p>
      <DeckCheck initial={result} companyName={companyName} loadError={error} startupId={startupId} />
    </>
  );
}

// URL data is read inside Suspense so navigation can show the shell instantly.
export default function StartupPage(props: PageProps<"/startup/[tab]">) {
  return (
    <Suspense fallback={<Loading />}>
      <StartupPageContent {...props} />
    </Suspense>
  );
}

// Role-guarded: redirects when the role does not match, so skip instant-navigation validation.
export const instant = false;
