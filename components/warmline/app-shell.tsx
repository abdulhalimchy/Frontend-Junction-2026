import { companies } from "@/lib/mocks/companies";
import { investors, people } from "@/lib/mocks/investors";
import { getActiveStartupId, getProfile, getStartups } from "@/lib/session";
import { startupHref } from "@/lib/startup-cookie";
import { getCompany, getInvestor } from "@/lib/cala";
import { demoDataEnabled } from "@/lib/demo";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";
import { TopBar, type PaletteItem } from "./top-bar";

export async function AppShell({ children }: { children: React.ReactNode }) {
  // DEMO_DATA=off: live Cala features only, no personas or mock entities.
  if (!demoDataEnabled()) {
    const palette: PaletteItem[] = [
      { type: "page", label: "Analyse a market", hint: "Market analysis", href: "/market" },
      { type: "page", label: "Analyse a company", hint: "Company analysis", href: "/market?mode=company" },
      { type: "page", label: "Slush 2026", hint: "Event space", href: "/events/slush-2026/overview" },
      { type: "page", label: "Warm intros", hint: "Who can introduce you", href: "/intros" },
      { type: "page", label: "Watch list", hint: "What you follow, and what changed", href: "/watchlist" },
    ];
    return (
      <div className="flex min-h-screen">
        <Sidebar live />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            items={palette}
            menu={
              <MobileNav>
                <Sidebar live inMenu />
              </MobileNav>
            }
          />
          <main className="mx-auto w-full max-w-[1160px] flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    );
  }

  const profile = await getProfile();
  const startups = profile.role === "founder" ? await getStartups() : null;
  const activeId = startups ? await getActiveStartupId(startups.items) : null;
  const org = startups
    ? startups.items.find((s) => s.id === activeId)?.name
    : profile.companyId
      ? (await getCompany(profile.companyId))?.name
      : (await getInvestor(profile.investorId!))?.investor.name;

  // ⌘K palette: pages plus known entities. Phase 3 adds live Cala search as you type.
  const palette: PaletteItem[] = [
    { type: "page", label: "Slush 2026", hint: "Event space", href: "/events/slush-2026/overview" },
    { type: "page", label: "Market or company analysis", hint: "Page", href: "/market" },
    { type: "page", label: "Warm intros", hint: "Who can introduce you", href: "/intros" },
    { type: "page", label: "Watch list", hint: "What you follow, and what changed", href: "/watchlist" },
    ...(profile.role === "founder"
      ? [{ type: "page" as const, label: "My startup", hint: "Page", href: startupHref(activeId) }]
      : [
          { type: "page" as const, label: "Portfolio", hint: "Page", href: "/portfolio" },
          { type: "page" as const, label: "Deck check", hint: "Page", href: "/deck-check" },
        ]),
    ...companies.map((c) => ({ type: "company" as const, label: c.name, hint: c.sector, href: `/company/${c.id}` })),
    ...investors.map((i) => ({ type: "investor" as const, label: i.name, hint: i.kind, href: `/investor/${i.id}` })),
    ...people.map((p) => ({
      type: "person" as const,
      label: p.name,
      hint: p.title,
      href: p.companyId ? `/company/${p.companyId}` : `/investor/${p.investorId}`,
    })),
  ];

  const sidebar = {
    role: profile.role,
    user: { name: profile.name, org: org ?? "" },
    startups: startups ? { ...startups, activeId: activeId ?? "" } : undefined,
  };
  return (
    <div className="flex min-h-screen">
      <Sidebar {...sidebar} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          items={palette}
          menu={
            <MobileNav>
              <Sidebar {...sidebar} inMenu />
            </MobileNav>
          }
        />
        <main className="mx-auto w-full max-w-[1160px] flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}

export function AppShellSkeleton() {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden h-screen w-60 shrink-0 border-r bg-card/60 md:block" />
      <div className="flex-1">
        <div className="h-14 border-b" />
      </div>
    </div>
  );
}
