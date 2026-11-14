import { Suspense } from "react";
import Loading from "@/app/(app)/loading";
import { CircleAlert, ExternalLink, Rocket } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, TabNav } from "@/components/warmline/blocks";
import { EditStartupButton } from "@/components/warmline/edit-startup-button";
import { AddedStartupOverview } from "@/components/warmline/added-startup-overview";
import { AddStartupButton } from "@/components/warmline/add-startup-button";
import { AnalysisTab } from "@/components/warmline/analysis-tab";
import { StartupGaps } from "@/components/warmline/startup-gaps";
import { getAnalysis, getStartup } from "@/lib/backend/startups";
import type { CompetitorsAnalysis, InvestorsAnalysis } from "@/lib/types";
import { startupHref } from "@/lib/startup-cookie";
import { Skeleton } from "@/components/ui/skeleton";
import { CompanyRecord } from "@/app/(app)/company/[id]/live-company";
import { DeckCheck } from "@/components/warmline/deck-check";
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

  // The startup comes from the URL (?s=); without one, the last startup chosen (cookie), else the first one.
  const { items, error } = await getStartups();
  const wanted = typeof requested === "string" && items.some((s) => s.id === requested) ? requested : null;
  if (wanted) return <AddedStartup id={wanted} tab={tab} />;
  const fallback = await getActiveStartupId(items);
  if (fallback) redirect(startupHref(fallback, tab));

  return (
    <>
      <PageHeader title="My startup" description="See your startup as investors see it: its public record, competitors, investors to talk to, and a check of your deck." />
      {error ? (
        <EmptyState icon={CircleAlert} title="Could not load your startups" description={error} />
      ) : (
        <EmptyState
          icon={Rocket}
          title="Add your startup"
          description="Enter its website. We look it up in verified records and fill in what is on record, with sources; you check and complete the rest."
          action={<AddStartupButton />}
        />
      )}
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
      {tab === "overview" && (
        <AddedStartupOverview startup={startup} competitors={comp} investors={inv} deck={(await getDeckCheck(id)).result}>
          {startup.calaCompanyId && (
            <section className="pt-4">
              <h2 className="text-base font-semibold">Verified record</h2>
              <p className="mt-1 mb-4 max-w-2xl text-sm text-muted-foreground">
                What the verified records hold on the company this startup is matched to: funding, people, investors and deals, each with its sources.
              </p>
              <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
                <CompanyRecord id={startup.calaCompanyId} />
              </Suspense>
            </section>
          )}
        </AddedStartupOverview>
      )}
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

/** Deck check for one startup: only decks uploaded for it. */
async function DeckTab({ companyName, startupId }: { companyName: string; startupId: string }) {
  const { result, error } = await getDeckCheck(startupId);
  return (
    <>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        Check your own deck before investors do. Each claim is matched against verified sources; anything without a source is marked “Can&apos;t verify”.
      </p>
      <DeckCheck initial={result} companyName={companyName} loadError={error} startupId={startupId} founder />
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
