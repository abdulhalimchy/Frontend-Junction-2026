"use client";

import { Bookmark, BriefcaseBusiness, CalendarDays, Database, FileSearch, LineChart, Rocket, Route, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Role, StartupSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { RoleSwitch } from "./role-switch";
import { SignOutButton } from "./sign-out-button";
import { StartupNav } from "./startup-nav";

type Item = { href: string; match: string; label: string; icon: typeof LineChart; slush?: boolean; startups?: boolean };

/** The menu for each side. Founders check their deck under My startup; investors check founders' decks. */
function navFor(role: Role): Item[] {
  const roleItems: Item[] =
    role === "founder"
      ? [{ href: "/startup/overview", match: "/startup", label: "My startup", icon: Rocket, startups: true }]
      : [
          { href: "/portfolio", match: "/portfolio", label: "Portfolio", icon: BriefcaseBusiness },
          { href: "/deck-check", match: "/deck-check", label: "Pitch deck", icon: FileSearch },
        ];
  return [
    ...roleItems,
    { href: "/market", match: "/market", label: "Market", icon: LineChart },
    { href: "/intros", match: "/intros", label: "Connect", icon: Route },
    { href: "/watchlist", match: "/watchlist", label: "Watch list", icon: Bookmark },
    { href: "/events/slush-2026/overview", match: "/events", label: "Slush 2026", icon: CalendarDays, slush: true },
    { href: "/cala", match: "/cala", label: "Data by Cala", icon: Database },
  ];
}

type StartupsProp = { items: StartupSummary[]; activeId: string; error: string | null };

export function Sidebar({
  role,
  user,
  startups,
  inMenu,
}: {
  role: Role;
  user: { name: string; email: string };
  /** Founder only: the startups listed under "My startup". */
  startups?: StartupsProp;
  inMenu?: boolean;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  // The startup on screen: the URL's on My startup pages, else the last one chosen.
  const [chosen, setChosen] = useState(startups?.activeId ?? "");
  const fromUrl = pathname.startsWith("/startup") ? params.get("s") : null;
  const current = startups?.items.some((s) => s.id === fromUrl) ? fromUrl! : chosen;
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col px-3 py-4",
        inMenu ? "h-full w-full overflow-y-auto" : "sticky top-0 hidden h-screen w-60 border-r bg-background/60 backdrop-blur-xl md:flex",
      )}
    >
      <Logo className="px-2" />
      <div className="mt-5 px-1">
        <div className="mb-1.5 text-[11px] font-medium text-subtle">View as</div>
        <RoleSwitch role={role} />
      </div>
      <nav className="mt-4 flex flex-col gap-0.5">
        {navFor(role).map((it) => {
          if (it.startups && startups)
            return <StartupNav key={it.href} startups={startups.items} activeId={current} onChoose={setChosen} loadError={startups.error} />;
          const active = pathname.startsWith(it.match);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors md:h-8",
                active
                  ? "bg-brand-soft text-accent-foreground before:absolute before:inset-y-2 before:-left-3 before:w-0.5 before:rounded-full before:bg-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <it.icon className="size-4 transition-transform group-hover:scale-110" />
              <span className="flex-1">{it.label}</span>
              {it.slush && <span className="size-1.5 rounded-full bg-slush" title="Slush 2026" />}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto">
        <div className="flex items-center gap-1 px-1 py-1">
          {/* Name and email open the account settings (profile, export, delete account). */}
          <Link
            href="/me"
            title="Account settings"
            aria-label="Account settings"
            className={cn(
              "group -m-1 flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 transition-colors hover:bg-muted",
              pathname.startsWith("/me") && "bg-brand-soft",
            )}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-accent-foreground">
              {initials || "?"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{user.name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{user.email}</span>
            </span>
            <Settings className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:rotate-45 group-hover:text-foreground" />
          </Link>
          <SignOutButton compact />
        </div>
      </div>
    </aside>
  );
}
