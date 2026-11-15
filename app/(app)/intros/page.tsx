import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Loading from "@/app/(app)/loading";
import { PageHeader, Panel } from "@/components/warmline/blocks";
import { FROM_COOKIE, IntroForm, type MyCompany, type Picked } from "@/components/warmline/intro-form";
import { getPortfolioSuggestions, listPortfolio } from "@/lib/backend/portfolio";
import { listStartups } from "@/lib/backend/startups";
import { mocksEnabled } from "@/lib/cala/client";
import { getRole } from "@/lib/session";
import { IntroResults, IntroResultsSkeleton } from "./intro-results";

export const metadata: Metadata = { title: "Connect" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function picked(id: unknown, name: unknown): Picked {
  return typeof id === "string" && UUID.test(id) ? { id, name: typeof name === "string" && name ? name.slice(0, 200) : "Selected" } : null;
}

/**
 * The user's own companies for the "You" dropdown: a founder's startups, or an investor's fund and portfolio.
 * Intro paths are read from Cala records, so a company not matched to one yet has id "": picking it searches by name.
 * Empty when the backend is unavailable: the picker still works by search.
 */
async function myCompanies(): Promise<MyCompany[]> {
  const list: MyCompany[] = [];
  try {
    if ((await getRole()) === "founder") {
      for (const s of await listStartups())
        if (!s.isDraft) list.push({ id: s.calaCompanyId, name: s.name, hint: s.domain || s.industry || "Startup", group: "My startups" });
    } else {
      const [fund, portfolio] = await Promise.all([getPortfolioSuggestions().then((s) => s.fund, () => null), listPortfolio().catch(() => [])]);
      if (fund) list.push({ id: fund.id, name: fund.name, hint: "Your fund", group: "My fund" });
      for (const c of portfolio)
        if (!c.isDraft) list.push({ id: c.calaCompanyId, name: c.name, hint: c.domain || c.industry || "Portfolio company", group: "My portfolio" });
    }
  } catch {
    // backend unavailable
  }
  const seen = new Set<string>();
  return list
    .map((m) => (UUID.test(m.id) ? m : { ...m, id: "" }))
    .filter((m) => {
      const key = m.id || `name:${m.name.toLowerCase()}`;
      return m.name && !seen.has(key) && !!seen.add(key);
    });
}

async function IntrosContent({ searchParams }: PageProps<"/intros">) {
  const [sp, mine] = await Promise.all([searchParams, myCompanies()]);
  let from = picked(sp.from, sp.fromName);
  if (!from) {
    try {
      const saved = JSON.parse(decodeURIComponent((await cookies()).get(FROM_COOKIE)?.value ?? "null"));
      from = picked(saved?.id, saved?.name);
    } catch {
      from = null;
    }
  }
  const to = picked(sp.to, sp.toName);

  return (
    <>
      <PageHeader
        title="Connect"
        description="Who can introduce you, from verified investment records: your investors, your portfolio and your co-investors, and how each is tied to the person you want to meet. Every link shows its sources."
      />
      <Panel className="mb-6 overflow-visible">
        {/* Remount when the URL changes so the pickers show the new selection. */}
        <IntroForm key={`${from?.id}-${to?.id}`} from={from} to={to} mine={mine} />
      </Panel>
      {mocksEnabled() ? (
        <p className="text-sm text-muted-foreground">Connect needs live data (USE_MOCKS is on).</p>
      ) : from && to ? (
        from.id === to.id ? (
          <p className="text-sm text-muted-foreground">Pick two different companies.</p>
        ) : (
          <Suspense key={`${from.id}-${to.id}`} fallback={<IntroResultsSkeleton />}>
            <IntroResults fromId={from.id} toId={to.id} />
          </Suspense>
        )
      ) : (
        <p className="text-sm text-muted-foreground">Pick your company or fund, then who you want to meet.</p>
      )}
    </>
  );
}

export default function IntrosPage(props: PageProps<"/intros">) {
  return (
    <Suspense fallback={<Loading />}>
      <IntrosContent {...props} />
    </Suspense>
  );
}
