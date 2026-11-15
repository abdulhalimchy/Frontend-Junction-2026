import { Suspense } from "react";
import Loading from "@/app/(app)/loading";
import { Building2, CalendarDays, Landmark, MapPin, Sparkles } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { SlushTag } from "@/components/warmline/badges";
import { FactGrid, PageHeader, Panel, StatCard, TabNav } from "@/components/warmline/blocks";
import { SourceChip } from "@/components/warmline/source-chip";
import { CompanyTable, InvestorTable } from "@/components/warmline/tables";
import { getEventAttendees, getInvestor } from "@/lib/cala";
import { mocksEnabled } from "@/lib/cala/client";
import { formatDay } from "@/lib/format";
import { SLUSH_EVENT_ID } from "@/lib/mocks/misc";
import { getProfile } from "@/lib/session";
import { LIVE_TABS, LiveSlush, LiveSlushLoading, type LiveTab } from "./live-slush";
import { SideEventsTab } from "./side-events";
import { SIDE_EVENTS, type SideEventFilters } from "@/lib/slush/side-events";

const TABS = ["overview", "new", "investors", "side-events"] as const;
type Tab = (typeof TABS)[number];

export function generateStaticParams() {
  return [...new Set([...TABS, ...LIVE_TABS])].map((tab) => ({ tab }));
}

export const metadata = { title: "Slush 2026" };

async function SlushPageContent({ params, searchParams }: PageProps<"/events/slush-2026/[tab]">) {
  const { tab } = (await params) as { tab: Tab };
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).slice(0, 100) : undefined);
  const filters: SideEventFilters = { day: str("day"), topic: str("topic"), q: str("q") };
  // Live from Cala unless USE_MOCKS=true (same switch as Market). The mock page below is the demo persona view.
  if (!mocksEnabled()) {
    if (tab === "new") redirect("/events/slush-2026/attendees");
    if (!LIVE_TABS.includes(tab as LiveTab)) notFound();
    const q = str("q") ?? "";
    const page = Number(str("page") ?? 1) || 1;
    return <LiveSlush tab={tab as LiveTab} q={q} page={page} filters={filters} />;
  }
  if (!TABS.includes(tab)) notFound();
  const [{ event: e, companies, investors }, profile] = await Promise.all([getEventAttendees(SLUSH_EVENT_ID), getProfile()]);
  const newest = [...companies].sort((a, b) => (b.slushJoined ?? "").localeCompare(a.slushJoined ?? ""));
  const investorRows = (await Promise.all(investors.map((i) => getInvestor(i.id)))).filter((r) => r !== null);

  return (
    <>
      <div className="mb-6 overflow-hidden rounded-2xl border border-slush/40 bg-card">
        <div className="h-1.5 bg-slush" />
        <div className="p-6">
          <PageHeader
            eyebrow={<SlushTag label="Event space" />}
            title="Slush 2026"
            description="Attendees are pulled from the verified event records and refreshed daily. Use this to plan who to meet."
          >
            <div className="mt-4 flex items-center gap-5 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-4" /> {formatDay(e.dates.value.start)} – {formatDay(e.dates.value.end)}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4" /> {e.city.value}
              </span>
              <SourceChip sources={e.dates.sources} />
            </div>
          </PageHeader>
        </div>
      </div>
      <TabNav
        active={tab}
        tabs={[
          { key: "overview", label: "Overview", href: "/events/slush-2026/overview" },
          { key: "new", label: "New attendees", href: "/events/slush-2026/new", count: e.newThisWeek },
          { key: "investors", label: "Investors", href: "/events/slush-2026/investors", count: investors.length },
          { key: "side-events", label: "Side events", href: "/events/slush-2026/side-events", count: SIDE_EVENTS.length },
        ]}
      />
      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Companies attending" value={e.attendeeCompanies.value.toLocaleString("en")} icon={Building2} sources={e.attendeeCompanies.sources} tone="slush" />
            <StatCard label="Investors attending" value={e.attendeeInvestors.value.toLocaleString("en")} icon={Landmark} sources={e.attendeeInvestors.sources} tone="slush" />
            <StatCard label="Joined this week" value={e.newThisWeek} icon={Sparkles} sources={e.attendeeCompanies.sources} tone="slush" />
          </div>
          <Panel title={profile.role === "founder" ? "Relevant to Northlight Robotics" : "Relevant to your focus"} description="Attendees matched on description to your space.">
            <CompanyTable companies={companies.filter((c) => c.sector === "Maritime robotics" && c.id !== profile.companyId)} showSlush={false} />
          </Panel>
          <Panel title="About the event">
            <FactGrid
              facts={[
                { label: "City", value: e.city.value, sources: e.city.sources },
                { label: "Dates", value: `${formatDay(e.dates.value.start)} – ${formatDay(e.dates.value.end)}`, sources: e.dates.sources },
                { label: "Event ID", value: <code className="text-xs">{e.id}</code> },
              ]}
            />
          </Panel>
        </div>
      )}
      {tab === "new" && (
        <Panel title="New attendees" description="Most recent first, by the date they first appeared on the attendee list.">
          <CompanyTable
            companies={newest}
            showSlush={false}
            extra={{
              key: "joined",
              label: "Joined",
              cells: Object.fromEntries(newest.map((c) => [c.id, <span key={c.id} className="text-[13px] tabular">{formatDay(c.slushJoined!)}</span>])),
            }}
          />
        </Panel>
      )}
      {tab === "side-events" && <SideEventsTab filters={filters} live={false} />}
      {tab === "investors" && (
        <Panel title="Investors attending" description="With the investor check: still active, and whether they lead or follow.">
          <InvestorTable rows={investorRows} />
        </Panel>
      )}
    </>
  );
}

// URL data is read inside Suspense so navigation can show the shell instantly.
export default function SlushPage(props: PageProps<"/events/slush-2026/[tab]">) {
  return (
    <Suspense fallback={mocksEnabled() ? <Loading /> : <LiveSlushLoading />}>
      <SlushPageContent {...props} />
    </Suspense>
  );
}
