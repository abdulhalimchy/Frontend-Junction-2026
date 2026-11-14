import { ArrowRight, Bell, Building2, FileSearch, Landmark, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DEMO_STARTUP_ID, startupHref } from "@/lib/startup-cookie";
import { Button } from "@/components/ui/button";
import { SlushTag } from "@/components/warmline/badges";
import { EntityAvatar, PageHeader, Panel, StatCard } from "@/components/warmline/blocks";
import { ProfileCard } from "@/components/warmline/profile-card";
import { SourceChip } from "@/components/warmline/source-chip";
import { getCompanies, getEventAttendees, getInvestorsForCompany, getSimilarCompanies, getInvestor } from "@/lib/cala";
import { buildCard } from "@/lib/cards";
import { formatDay, formatFuzzyDate, formatMoney } from "@/lib/format";
import { SLUSH_EVENT_ID } from "@/lib/mocks/misc";
import { getAlerts, getProfile } from "@/lib/session";
import type { Alert } from "@/lib/types";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  const profile = await getProfile();
  const [alerts, card, slush] = await Promise.all([getAlerts(), buildCard(profile), getEventAttendees(SLUSH_EVENT_ID)]);
  const firstName = profile.name.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description={
          profile.role === "founder"
            ? "Slush is in 4 days. Here is who to meet and what changed around Northlight Robotics."
            : "Slush is in 4 days. Here is what changed across your portfolio and who is new on the attendee list."
        }
        eyebrow={<SlushTag label="Slush 2026 · 18–19 Nov, Helsinki" />}
      />
      {profile.role === "founder" ? (
        <FounderHome companyId={profile.companyId!} alerts={alerts} card={card} slush={slush} />
      ) : (
        <InvestorHome investorId={profile.investorId!} alerts={alerts} card={card} slush={slush} />
      )}
    </>
  );
}

type Slush = Awaited<ReturnType<typeof getEventAttendees>>;
type Card = Awaited<ReturnType<typeof buildCard>>;

async function FounderHome({ companyId, alerts, card, slush }: { companyId: string; alerts: Alert[]; card: Card; slush: Slush }) {
  const [investors, competitors] = await Promise.all([getInvestorsForCompany(companyId), getSimilarCompanies(companyId)]);
  const atSlush = investors.filter((i) => i.investor.attendsSlush);

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-6">
        <ProfileCard data={card} />
        <Panel
          title="Investors to meet at Slush"
          description="Attending, active in your space, and checked against your competitors."
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href={startupHref(DEMO_STARTUP_ID, "investors")}>
                All investors <ArrowRight />
              </Link>
            </Button>
          }
        >
          <ul className="divide-y">
            {atSlush.map(({ investor: i, check, backsCompetitors }) => (
              <li key={i.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <EntityAvatar name={i.name} kind="investor" />
                <div className="min-w-0 flex-1">
                  <Link href={`/investor/${i.id}`} className="text-sm font-medium hover:text-primary">
                    {i.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">{i.focus.value.join(", ")}</div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {check.stillActive.value.active ? (
                    <span className="text-success">Active</span>
                  ) : (
                    <span className="text-warning">Quiet since {formatFuzzyDate(check.stillActive.value.lastInvestment!)}</span>
                  )}
                  {backsCompetitors.length > 0 && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-warning">Backs a competitor</span>}
                  <SourceChip sources={[...check.stillActive.sources, ...check.backsCompetitor.sources]} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Competitors" description="Matched on what they do, not on industry code.">
          <div className="grid grid-cols-3 gap-3">
            {competitors.map(({ company: c, reason }) => {
              const last = c.rounds.filter((r) => r.kind === "equity").at(-1);
              return (
                <Link key={c.id} href={`/company/${c.id}`} className="rounded-lg border p-3 transition-colors hover:border-primary/40">
                  <div className="flex items-center gap-2">
                    <EntityAvatar name={c.name} size="sm" />
                    <span className="text-sm font-medium">{c.name}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{reason}</p>
                  <p className="mt-2 text-xs tabular">{last ? `${last.stage} · ${formatMoney(last.amount)}` : "No funding on record"}</p>
                </Link>
              );
            })}
          </div>
        </Panel>
      </div>
      <div className="space-y-6">
        <SlushPanel slush={slush} />
        <AlertsPanel alerts={alerts} />
      </div>
    </div>
  );
}

async function InvestorHome({ investorId, alerts, card, slush }: { investorId: string; alerts: Alert[]; card: Card; slush: Slush }) {
  const data = (await getInvestor(investorId))!;
  const portfolio = await getCompanies(data.investor.portfolioIds);
  const newAtSlush = slush.companies.filter((c) => !data.investor.portfolioIds.includes(c.id)).slice(0, 4);

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Portfolio companies" value={portfolio.length} icon={Building2} sources={data.investor.description.sources} hint="Prefilled from Cala" />
          <StatCard label="Deals, last 12 months" value={data.check.stillActive.value.dealsLast12m} icon={Landmark} sources={data.check.stillActive.sources} />
          <StatCard label="Portfolio at Slush" value={portfolio.filter((c) => c.attendsSlush).length} icon={Users} tone="slush" sources={slush.event.attendeeCompanies.sources} />
        </div>
        <Panel
          title="New at Slush, outside your portfolio"
          description="Recently joined the attendee list. Matched on description to your focus."
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/events/slush-2026/new">
                See all <ArrowRight />
              </Link>
            </Button>
          }
        >
          <ul className="divide-y">
            {newAtSlush.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <EntityAvatar name={c.name} />
                <div className="min-w-0 flex-1">
                  <Link href={`/company/${c.id}`} className="text-sm font-medium hover:text-primary">
                    {c.name}
                  </Link>
                  <div className="truncate text-xs text-muted-foreground">{c.description.value}</div>
                </div>
                <span className="text-xs text-muted-foreground">Joined {formatDay(c.slushJoined!)}</span>
                <SourceChip sources={c.description.sources} />
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Deck check" description="Upload a founder's deck and check each claim against Cala.">
          <div className="flex items-center justify-between rounded-lg bg-muted/60 p-4">
            <div className="flex items-center gap-3">
              <FileSearch className="size-5 text-primary" />
              <div>
                <div className="text-sm font-medium">Tidewise_SeriesB_teaser.pdf</div>
                <div className="text-xs text-muted-foreground">5 claims · 3 confirmed · 1 differs · 1 can&apos;t verify</div>
              </div>
            </div>
            <Button size="sm" asChild>
              <Link href="/deck-check">Open deck check</Link>
            </Button>
          </div>
        </Panel>
      </div>
      <div className="space-y-6">
        <ProfileCardMini card={card} />
        <SlushPanel slush={slush} />
        <AlertsPanel alerts={alerts} />
      </div>
    </div>
  );
}

function ProfileCardMini({ card }: { card: Card }) {
  return (
    <Panel title="Your card" action={<Link href="/me" className="text-xs text-primary hover:underline">Edit</Link>}>
      <div className="flex items-center gap-3">
        <EntityAvatar name={card.name} kind="person" />
        <div>
          <div className="text-sm font-medium">{card.name}</div>
          <div className="text-xs text-muted-foreground">
            {card.title}, {card.org}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function SlushPanel({ slush }: { slush: Slush }) {
  const e = slush.event;
  return (
    <section className="rounded-xl border border-slush/40 bg-slush-soft/40 p-5">
      <div className="flex items-center justify-between">
        <SlushTag />
        <SourceChip sources={e.dates.sources} />
      </div>
      <div className="mt-3 text-lg font-semibold tracking-tight">Slush 2026</div>
      <div className="text-sm text-muted-foreground">Helsinki · 18–19 November</div>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs text-muted-foreground">Companies</dt>
          <dd className="text-lg font-semibold tabular">{e.attendeeCompanies.value.toLocaleString("en")}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Investors</dt>
          <dd className="text-lg font-semibold tabular">{e.attendeeInvestors.value.toLocaleString("en")}</dd>
        </div>
      </dl>
      <div className="mt-1 text-xs text-slush-foreground">{e.newThisWeek} joined this week</div>
      <Button variant="outline" size="sm" className="mt-4 w-full bg-card" asChild>
        <Link href="/events/slush-2026/overview">Open event space</Link>
      </Button>
    </section>
  );
}

function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  return (
    <Panel
      title="Latest alerts"
      action={
        <Link href="/alerts" className="text-xs text-primary hover:underline">
          View all
        </Link>
      }
    >
      <ul className="space-y-3">
        {alerts.slice(0, 4).map((a) => (
          <li key={a.id} className="flex gap-2.5">
            <span className={a.read ? "mt-1.5 size-1.5 shrink-0 rounded-full bg-transparent" : "mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"} />
            <div className="min-w-0">
              <Link href={a.href} className="text-[13px] font-medium leading-snug hover:text-primary">
                {a.title}
              </Link>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                {formatDay(a.date)}
                <SourceChip sources={a.sources} />
              </div>
            </div>
          </li>
        ))}
        {!alerts.length && (
          <li className="flex items-center gap-2 text-sm text-muted-foreground">
            <Bell className="size-4" /> Nothing new.
          </li>
        )}
      </ul>
    </Panel>
  );
}
