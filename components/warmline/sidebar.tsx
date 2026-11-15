"use client";

import {
  Bookmark,
  BriefcaseBusiness,
  CalendarDays,
  FileSearch,
  House,
  LineChart,
  Route,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Role, StartupSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { RoleSwitch } from "./role-switch";
import { SignOutButton } from "./sign-out-button";
import { StartupNav } from "./startup-nav";

type Item = { href: string; match: string; label: string; icon: typeof House; slush?: boolean; startups?: boolean };

function navFor(role: Role): Item[] {
  const top: Item[] = [
    { href: "/home", match: "/home", label: "Home", icon: House },
    { href: "/market", match: "/market", label: "Market", icon: LineChart },
    { href: "/intros", match: "/intros", label: "Warm intros", icon: Route },
  ];
  const roleItems: Item[] =
    role === "founder"
      ? [{ href: "/startup/overview", match: "/startup", label: "My startup", icon: House, startups: true }]
      : [
          { href: "/portfolio", match: "/portfolio", label: "Portfolio", icon: BriefcaseBusiness },
          { href: "/deck-check", match: "/deck-check", label: "Deck check", icon: FileSearch },
        ];
  const rest: Item[] = [
    { href: "/watchlist", match: "/watchlist", label: "Watch list", icon: Bookmark },
    { href: "/events/slush-2026/overview", match: "/events", label: "Events", icon: CalendarDays, slush: true },
  ];
  return [...top, ...roleItems, ...rest];
}

const LIVE_ITEMS: Item[] = [
  { href: "/market", match: "/market", label: "Market", icon: LineChart },
  { href: "/intros", match: "/intros", label: "Warm intros", icon: Route },
  { href: "/deck-check", match: "/deck-check", label: "Deck check", icon: FileSearch },
  { href: "/watchlist", match: "/watchlist", label: "Watch list", icon: Bookmark },
  { href: "/events/slush-2026/overview", match: "/events", label: "Slush 2026", icon: CalendarDays, slush: true },
];

type StartupsProp = { items: StartupSummary[]; activeId: string; error: string | null };

export function Sidebar(
  props: { inMenu?: boolean } & (
    | { live: true }
    | {
        live?: false;
        role: Role;
        user: { name: string; org: string };
        /** Founder only: the startups listed under "My startup". */
        startups?: StartupsProp;
      }
  ),
) {
  const pathname = usePathname();
  const params = useSearchParams();
  const startups = props.live ? undefined : props.startups;
  // Live mode (DEMO_DATA=off): only the pages backed by real data (Cala, the backend).
  const items: Item[] = props.live ? LIVE_ITEMS : navFor(props.role);
  // The startup on screen: the URL's on My startup pages, else the last one chosen.
  const [chosen, setChosen] = useState(startups?.activeId ?? "");
  const fromUrl = pathname.startsWith("/startup") ? params.get("s") : null;
  const current = startups?.items.some((s) => s.id === fromUrl) ? fromUrl! : chosen;
  const org = props.live
    ? ""
    : startups
      ? (startups.items.find((s) => s.id === current)?.name ?? props.user.org)
      : props.user.org;

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col px-3 py-4",
        props.inMenu ? "h-full w-full overflow-y-auto" : "sticky top-0 hidden h-screen w-60 border-r bg-background/60 backdrop-blur-xl md:flex",
      )}
    >
      <Logo className="px-2" />
      <nav className="mt-6 flex flex-col gap-0.5">
        {items.map((it) => {
          if (it.startups && startups)
            return (
              <StartupNav key={it.href} startups={startups.items} activeId={current} onChoose={setChosen} loadError={startups.error} />
            );
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

      {props.live ? (
        <div className="mt-auto rounded-lg border bg-card p-3 text-[11px] text-muted-foreground">
          <div className="font-semibold text-foreground">Live data</div>
          Verified, cited data from the Cala encyclopedia. Demo data is off.
        </div>
      ) : (
        <div className="mt-auto space-y-3">
          <div className="rounded-lg border border-slush/40 bg-slush-soft/50 p-3">
            <div className="text-xs font-semibold text-slush-foreground">Slush 2026</div>
            <div className="mt-0.5 text-[11px] text-slush-foreground/80">Helsinki · 18–19 Nov</div>
          </div>
          <div className="px-1">
            <div className="mb-1.5 text-[11px] font-medium text-subtle">View as (demo)</div>
            <RoleSwitch role={props.role} />
          </div>
          <div className="flex items-center gap-2 px-1 py-1">
            <span className="flex size-7 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-accent-foreground">
              {props.user.name
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{props.user.name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{org}</span>
            </span>
            <SignOutButton compact />
          </div>
        </div>
      )}
    </aside>
  );
}
