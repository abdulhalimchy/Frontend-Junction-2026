import { Banknote, Bell, CalendarDays, Eye, Landmark, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { SlushTag } from "@/components/warmline/badges";
import { EmptyState, PageHeader, Panel } from "@/components/warmline/blocks";
import { SourceChip } from "@/components/warmline/source-chip";
import { WatchingPanel } from "@/components/warmline/watching-panel";
import { formatDay } from "@/lib/format";
import { getAlerts } from "@/lib/session";
import type { AlertKind } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Alerts" };

const KIND: Record<AlertKind, { label: string; icon: typeof Bell }> = {
  competitor_round: { label: "Competitor round", icon: Banknote },
  portfolio_competitor: { label: "Portfolio competitor", icon: Eye },
  investor_activity: { label: "Investor activity", icon: Landmark },
  slush_attendee: { label: "Slush attendee", icon: CalendarDays },
  profile: { label: "Your profile", icon: UserRound },
};

export default async function AlertsPage() {
  const alerts = await getAlerts();
  const unread = alerts.filter((a) => !a.read).length;

  return (
    <>
      <PageHeader
        title="Alerts"
        description="Changes Cala picks up on companies and investors you follow. Every alert links to its source."
        actions={
          <Button variant="outline" className="bg-card" disabled={!unread}>
            Mark all as read
          </Button>
        }
      />
      <div className="grid grid-cols-3 items-start gap-6">
        <Panel className="col-span-2" bodyClassName="p-0">
          {alerts.length ? (
            <ul className="divide-y">
              {alerts.map((a) => {
                const k = KIND[a.kind];
                return (
                  <li key={a.id} className={cn("flex gap-4 px-5 py-4", !a.read && "bg-teal-soft/25")}>
                    <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", a.slush ? "bg-slush-soft text-slush-foreground" : "bg-muted text-muted-foreground")}>
                      <k.icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {!a.read && <span className="size-1.5 rounded-full bg-primary" />}
                        <Link href={a.href} className="text-sm font-medium hover:text-primary">
                          {a.title}
                        </Link>
                        {a.slush && <SlushTag label="Slush" />}
                      </div>
                      <p className="mt-0.5 text-[13px] text-muted-foreground">{a.body}</p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-subtle">
                        <span>{k.label}</span>
                        <span>{formatDay(a.date)}</span>
                        <SourceChip sources={a.sources} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={Bell} title="No alerts yet" description="Follow companies and investors to get alerts when Cala sees a change." />
          )}
        </Panel>
        <Suspense fallback={<Skeleton className="h-48 rounded-xl" />}>
          <WatchingPanel />
        </Suspense>
      </div>
    </>
  );
}
