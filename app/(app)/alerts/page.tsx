import { Banknote, Bell, CalendarDays, CloudOff, Eye, Landmark, Lightbulb, UserRound, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import Loading from "@/app/(app)/loading";
import { Skeleton } from "@/components/ui/skeleton";
import { SlushTag } from "@/components/warmline/badges";
import { EmptyState, PageHeader, Panel } from "@/components/warmline/blocks";
import { SourceChip } from "@/components/warmline/source-chip";
import { WatchingPanel } from "@/components/warmline/watching-panel";
import { formatDay, isoDaysAgo } from "@/lib/format";
import { getAlerts } from "@/lib/session";
import type { Alert, AlertKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AlertLink, MarkAllReadButton, ScanButton } from "./alert-controls";

export const metadata: Metadata = { title: "Alerts" };

const KIND: Record<AlertKind, { label: string; icon: typeof Bell }> = {
  competitor_round: { label: "Competitor round", icon: Banknote },
  funding_round: { label: "New round", icon: Banknote },
  portfolio_competitor: { label: "Portfolio competitor", icon: Eye },
  investor_activity: { label: "Investor move", icon: Landmark },
  slush_attendee: { label: "Slush attendee", icon: CalendarDays },
  team_change: { label: "Team size", icon: Users },
  profile: { label: "Your company", icon: UserRound },
};

const FILTERS: { key: string; label: string; kinds?: AlertKind[] }[] = [
  { key: "all", label: "All" },
  { key: "rounds", label: "New rounds", kinds: ["competitor_round", "funding_round"] },
  { key: "investors", label: "Investor moves", kinds: ["investor_activity", "portfolio_competitor"] },
  { key: "slush", label: "Slush", kinds: ["slush_attendee"] },
  { key: "team", label: "Team and company", kinds: ["team_change", "profile"] },
];

async function AlertsContent({ searchParams }: PageProps<"/alerts">) {
  const { show } = await searchParams;
  const { alerts, error } = await getAlerts();
  const unread = alerts.filter((a) => !a.read).length;
  const active = FILTERS.find((f) => f.key === show) ?? FILTERS[0];
  const shown = active.kinds ? alerts.filter((a) => active.kinds!.includes(a.kind)) : alerts;

  // Group by the date of the underlying fact: the last 7 days, then everything before.
  const weekAgo = isoDaysAgo(7);
  const groups = [
    { title: "This week", items: shown.filter((a) => a.date >= weekAgo) },
    { title: "Earlier", items: shown.filter((a) => a.date < weekAgo) },
  ].filter((g) => g.items.length);

  return (
    <>
      <PageHeader
        title="Alerts"
        description="Changes Cala has on record for the companies and investors you watch. Every alert links to its sources."
        actions={
          <>
            <MarkAllReadButton disabled={!unread} />
            <ScanButton />
          </>
        }
      />

      {error ? (
        <Panel>
          <EmptyState icon={CloudOff} title="Alerts unavailable" description={error} />
        </Panel>
      ) : (
        <>
          <nav className="mb-6 flex flex-wrap gap-2" aria-label="Filter alerts">
            {FILTERS.map((f) => {
              const on = f.key === active.key;
              const count = f.kinds ? alerts.filter((a) => f.kinds!.includes(a.kind)).length : alerts.length;
              return (
                <Link
                  key={f.key}
                  href={f.key === "all" ? "/alerts" : `/alerts?show=${f.key}`}
                  scroll={false}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
                    on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-muted",
                  )}
                >
                  {f.label}
                  <span className={cn("tabular text-[11px]", on ? "text-primary-foreground/80" : "text-subtle")}>{count}</span>
                </Link>
              );
            })}
          </nav>

          <div className="grid grid-cols-3 items-start gap-6">
            <div className="col-span-2 space-y-8">
              {groups.length ? (
                groups.map((g) => (
                  <section key={g.title}>
                    <div className="mb-3 flex items-baseline justify-between">
                      <h2 className="text-base font-semibold">{g.title}</h2>
                      <span className="text-[11px] font-medium tracking-wider text-subtle uppercase">
                        {g.items.length} {g.items.length === 1 ? "signal" : "signals"}
                      </span>
                    </div>
                    <ul className="space-y-3">
                      {g.items.map((a) => (
                        <AlertCard key={a.id} alert={a} />
                      ))}
                    </ul>
                  </section>
                ))
              ) : (
                <Panel>
                  <EmptyState
                    icon={Bell}
                    title={alerts.length ? `No “${active.label}” alerts` : "No alerts yet"}
                    description={
                      alerts.length
                        ? undefined
                        : "Watch companies and investors, then check for changes. New rounds from the last 60 days, investor moves, Slush attendance and team changes show up here."
                    }
                    action={alerts.length ? undefined : <ScanButton variant="outline" />}
                  />
                </Panel>
              )}
            </div>
            <Suspense fallback={<Skeleton className="h-48 rounded-xl" />}>
              <WatchingPanel />
            </Suspense>
          </div>
        </>
      )}
    </>
  );
}

function AlertCard({ alert: a }: { alert: Alert }) {
  const k = KIND[a.kind] ?? { label: "Alert", icon: Bell };
  return (
    <li className={cn("flex gap-4 rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgba(22,24,26,0.04)]", !a.read && "border-primary/30")}>
      <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", a.slush ? "bg-slush-soft text-slush-foreground" : "bg-teal-soft/60 text-accent-foreground")}>
        <k.icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-subtle">
          {!a.read && <span className="size-1.5 rounded-full bg-primary" aria-label="Unread" />}
          <span>{k.label}</span>
          <span>·</span>
          <span>{formatDay(a.date)}</span>
          <SourceChip sources={a.sources} />
          {a.slush && <SlushTag label="Slush" />}
        </div>
        <AlertLink id={a.id} read={a.read} href={a.href} className="mt-1.5 block text-[15px] font-semibold leading-snug hover:text-primary">
          {a.title}
        </AlertLink>
        {a.reason && (
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <Lightbulb className="size-3.5 shrink-0 text-primary" />
            Why it matters: {a.reason}
          </p>
        )}
        {a.body && <p className="mt-1.5 text-[13px] text-muted-foreground">{a.body}</p>}
      </div>
    </li>
  );
}

// URL data is read inside Suspense so navigation can show the shell instantly.
export default function AlertsPage(props: PageProps<"/alerts">) {
  return (
    <Suspense fallback={<Loading />}>
      <AlertsContent {...props} />
    </Suspense>
  );
}
