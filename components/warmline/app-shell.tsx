import { startupHref } from "@/lib/startup-cookie";
import { getAccount, getActiveStartupId, getRole, getStartups } from "@/lib/session";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";
import { TopBar, type PaletteItem } from "./top-bar";

// ⌘K palette: the app's pages, for the current side.
const SHARED: PaletteItem[] = [
  { type: "page", label: "Analyse a market", hint: "Market analysis", href: "/market" },
  { type: "page", label: "Analyse a company", hint: "Company analysis", href: "/market?mode=company" },
  { type: "page", label: "Connect", hint: "Who can introduce you", href: "/intros" },
  { type: "page", label: "Watch list", hint: "What you follow, and what changed", href: "/watchlist" },
  { type: "page", label: "Slush 2026", hint: "Event space", href: "/events/slush-2026/overview" },
  { type: "page", label: "Data by Cala", hint: "Where the data comes from", href: "/cala" },
  { type: "page", label: "Account settings", hint: "Profile, export your data, delete account", href: "/me" },
];

export async function AppShell({ children }: { children: React.ReactNode }) {
  const [account, role] = await Promise.all([getAccount(), getRole()]);
  const user = { name: account?.name || account?.email || "Signed in", email: account?.email ?? "" };
  const startups = role === "founder" ? await getStartups() : null;
  const activeId = startups ? await getActiveStartupId(startups.items) : null;

  const palette: PaletteItem[] = [
    ...(role === "founder"
      ? [{ type: "page" as const, label: "My startup", hint: "Your startup as investors see it", href: startupHref(activeId) }]
      : [
          { type: "page" as const, label: "Portfolio", hint: "Your fund's companies", href: "/portfolio" },
          { type: "page" as const, label: "Deck check", hint: "Check a founder's deck", href: "/deck-check" },
        ]),
    ...SHARED,
  ];
  const sidebar = { role, user, startups: startups ? { ...startups, activeId: activeId ?? "" } : undefined };

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
