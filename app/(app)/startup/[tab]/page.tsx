import { Suspense } from "react";
import Loading from "@/app/(app)/loading";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SlushTag } from "@/components/warmline/badges";
import { PageHeader, Panel, TabNav } from "@/components/warmline/blocks";
import { CompanyOverview } from "@/components/warmline/company-overview";
import { DeckCheck } from "@/components/warmline/deck-check";
import { CompanyTable, InvestorTable } from "@/components/warmline/tables";
import { getCompany, getInvestorsForCompany, getSimilarCompanies } from "@/lib/cala";
import { getDeckCheck, getProfile } from "@/lib/session";

const TABS = ["overview", "competitors", "investors", "deck"] as const;
type Tab = (typeof TABS)[number];

export function generateStaticParams() {
  return TABS.map((tab) => ({ tab }));
}

export const metadata = { title: "My startup" };

async function StartupPageContent({ params }: PageProps<"/startup/[tab]">) {
  const { tab } = (await params) as { tab: Tab };
  if (!TABS.includes(tab)) notFound();
  const profile = await getProfile();
  if (profile.role !== "founder") redirect("/home");

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
          { key: "overview", label: "Overview", href: "/startup/overview" },
          { key: "competitors", label: "Competitors", href: "/startup/competitors", count: competitors.length },
          { key: "investors", label: "Investors", href: "/startup/investors", count: investors.length },
          { key: "deck", label: "Deck check", href: "/startup/deck" },
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
      {tab === "deck" && <DeckTab companyId={companyId} />}
    </>
  );
}

async function DeckTab({ companyId }: { companyId: string }) {
  const result = await getDeckCheck(companyId);
  if (!result) return null;
  return (
    <>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        Check your own deck before investors do. Each claim is matched against Cala; anything without a source is marked “Can&apos;t verify”.
      </p>
      <DeckCheck result={result} initiallyDone />
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
