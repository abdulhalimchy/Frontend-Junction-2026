import { Suspense } from "react";
import Loading from "@/app/(app)/loading";
import { CircleAlert, ExternalLink, Network, Rocket } from "lucide-react";
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
import type { CompetitorsAnalysis, InvestorsAnalysis, Startup } from "@/lib/types";
import { findInvestorRoutes } from "@/lib/cala/connect";
import { ConnectView } from "@/components/warmline/connect-view";
import { startupHref } from "@/lib/startup-cookie";
import { Skeleton } from "@/components/ui/skeleton";
import { CompanyRecord } from "@/app/(app)/company/[id]/live-company";
import { DeckCheck } from "@/components/warmline/deck-check";
import { getActiveStartupId, getDeckCheck, getDeckChecks, getProfile, getStartups } from "@/lib/session";

const TABS = ["overview", "competitors", "investors", "connect", "deck"] as const;
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
  const check = (await searchParams).check;
  if (wanted) return <AddedStartup id={wanted} tab={tab} check={typeof check === "string" ? check : undefined} />;
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
async function AddedStartup({ id, tab, check }: { id: string; tab: Tab; check?: string }) {
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
          { key: "connect", label: "Connect", href: startupHref(id, "connect") },
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
      {tab === "connect" && (
        <Suspense key={id} fallback={<ConnectSkeleton />}>
          <ConnectTab startup={startup} investors={inv} />
        </Suspense>
      )}
      {tab === "deck" && <DeckTab key={id} companyName={startup.name} startupId={id} check={check} />}
    </>
  );
}

/** Connect: how to reach the best-matched investors, as a network map and step-by-step routes. */
async function ConnectTab({ startup, investors }: { startup: Startup; investors: InvestorsAnalysis | null }) {
  if (!investors?.investors.length)
    return (
      <EmptyState
        icon={Network}
        title="Find your investors first"
        description="Connect maps routes to the investors that fit you best. Run Find investors, then come back here."
        action={
          <Button asChild>
            <Link href={startupHref(startup.id, "investors")}>Find investors</Link>
          </Button>
        }
      />
    );
  if (!startup.calaCompanyId)
    return (
      <EmptyState
        icon={Network}
        title="No verified company record to start from"
        description="Warm routes come from your company's investors, deals and co-investors on record. Match your startup to its verified record with Edit details."
        action={<EditStartupButton startup={startup} />}
      />
    );
  const data = await findInvestorRoutes(startup.calaCompanyId, investors.investors);
  if (!data.routes.length)
    return <EmptyState icon={Network} title="No new investors to reach" description="Every matched investor already backs you." />;
  const you = data.routes.find((r) => r.result)?.result?.from ?? { id: startup.calaCompanyId, name: startup.name, atSlush: false, investor: false };
  return <ConnectView data={data} you={{ ...you, name: startup.name }} />;
}

function ConnectSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5">
        <p className="text-sm font-medium">Mapping your routes to investors</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Reading your investors, their portfolios and Slush events. The first time takes 20–40 seconds, then it is cached.</p>
        <Skeleton className="mt-4 h-72 rounded-lg" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** Deck check for one startup: only decks uploaded for it. */
async function DeckTab({ companyName, startupId, check }: { companyName: string; startupId: string; check?: string }) {
  const { history, result, error } = await getDeckChecks(startupId, check);
  return (
    <>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        Check your own deck before investors do. Each claim is matched against verified sources; anything without a source is marked “Can&apos;t verify”.
      </p>
      <DeckCheck initial={result} history={history} companyName={companyName} loadError={error} startupId={startupId} founder />
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
