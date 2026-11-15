import { ArrowRight, Bell, Building2, FileSearch, Landmark, Rocket, Users } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import Loading from "@/app/(app)/loading";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SlushTag } from "@/components/warmline/badges";
import { EmptyState, EntityAvatar, PageHeader, Panel, StatCard } from "@/components/warmline/blocks";
import { AddStartupButton } from "@/components/warmline/add-startup-button";
import { SourceChip } from "@/components/warmline/source-chip";
import { getCompanies, getEventAttendees, getInvestor } from "@/lib/cala";
import { normaliseName } from "@/lib/cala/market";
import { slushAttendeeIndex } from "@/lib/cala/slush";
import { getAnalysis, getStartup } from "@/lib/backend/startups";
import { startupHref } from "@/lib/startup-cookie";
import { formatDay, formatMoney } from "@/lib/format";
import { SLUSH_EVENT_ID } from "@/lib/mocks/misc";
import { getActiveStartupId, getChanges, getProfile, getStartups } from "@/lib/session";
import type { CompetitorsAnalysis, InvestorsAnalysis } from "@/lib/types";

export const metadata: Metadata = { title: "Home" };

// Profile and changes are per request (cookie, backend), so they are read inside Suspense: navigation shows the
// shell at once, and the changes panel streams in on its own so a slow backend does not hold up the page.
export default function HomePage() {
  return (
    <Suspense fallback={<Loading />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const profile = await getProfile();
  const firstName = profile.name.split(" ")[0];
  const [founder, slush] = await Promise.all([
    profile.role === "founder" ? loadFounder() : null,
    getEventAttendees(SLUSH_EVENT_ID),
  ]);

  return (
    <>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description={
          profile.role === "founder"
            ? founder?.startup
              ? `Slush is in 4 days. Here is who to meet and what changed around ${founder.startup.name}.`
              : "Slush is in 4 days. Add your startup to see who to meet and how you compare."
            : "Slush is in 4 days. Here is what changed across your portfolio and who is new on the attendee list."
        }
        eyebrow={<SlushTag label="Slush 2026 · 18–19 Nov, Helsinki" />}
      />
      {founder ? (
        <FounderHome {...founder} slush={slush} />
      ) : (
        <InvestorHome investorId={profile.investorId!} slush={slush} />
      )}
    </>
  );
}

type Slush = Awaited<ReturnType<typeof getEventAttendees>>;

type Founder = Awaited<ReturnType<typeof loadFounder>>;

/**
 * The founder's Home is about the startup open under My startup (the last one chosen), using the competitors and
 * investors analyses already stored for it. Nothing is run from here; the tabs run them.
 */
async function loadFounder() {
  const { items } = await getStartups();
  const id = await getActiveStartupId(items);
  if (!id) return { startup: null, competitors: null, investors: null, slushIndex: null };
  const [startup, comp, inv, slushIndex] = await Promise.all([
    getStartup(id).catch(() => null),
    getAnalysis(id, "competitors").catch(() => null),
    getAnalysis(id, "investors").catch(() => null),
    slushAttendeeIndex().catch(() => null), // the Slush tags are a nice-to-have
  ]);
  const compData = comp?.data as Partial<CompetitorsAnalysis> | undefined;
  const invData = inv?.data as Partial<InvestorsAnalysis> | undefined;
  return {
    startup,
    competitors: compData?.companies ? (compData as CompetitorsAnalysis) : null,
    investors: invData?.investors ? (invData as InvestorsAnalysis) : null,
    slushIndex,
  };
}

async function FounderHome({ startup, competitors, investors, slushIndex, slush }: NonNullable<Founder> & { slush: Slush }) {
  const atSlush = (name: string, id: string) => !!slushIndex && (slushIndex.ids.has(id) || slushIndex.names.has(normaliseName(name)));
  const side = (
    <div className="space-y-6">
      <SlushPanel slush={slush} />
      <Suspense fallback={<Skeleton className="h-56 rounded-xl" />}>
        <ChangesPanel />
      </Suspense>
    </div>
  );

  if (!startup)
    return (
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <EmptyState
            icon={Rocket}
            title="Add your startup"
            description="We look it up in verified records, then show who to meet at Slush and how you compare with your competitors."
            action={<AddStartupButton />}
          />
        </div>
        {side}
      </div>
    );

  const toMeet = (investors?.investors ?? []).filter((i) => atSlush(i.name, i.id)).slice(0, 5);
  const rivals = (competitors?.companies ?? []).slice(0, 3);

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-6">
        <Panel
          title="Investors to meet at Slush"
          description="Attending, investing in companies like yours, and checked against your competitors."
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href={startupHref(startup.id, "investors")}>
                All investors <ArrowRight />
              </Link>
            </Button>
          }
        >
          {!investors ? (
            <EmptyState
              compact
              icon={Landmark}
              title="Investors not checked yet"
              description="Find who funds companies like yours; the ones attending Slush show here."
              action={
                <Button size="sm" asChild>
                  <Link href={startupHref(startup.id, "investors")}>Find investors</Link>
                </Button>
              }
            />
          ) : toMeet.length ? (
            <ul className="divide-y">
              {toMeet.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <EntityAvatar name={i.name} kind="investor" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/investor/${i.id}`} className="text-sm font-medium hover:text-primary">
                      {i.name}
                    </Link>
                    <div className="truncate text-xs text-muted-foreground">{i.why}</div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium tabular">{i.match.score}% match</span>
                    {i.conflict === "competitor" && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-warning">Backs a competitor</span>}
                    <SourceChip sources={i.sources} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">None of the {investors.investors.length} investors in companies like yours are on the Slush attendee list.</p>
          )}
        </Panel>
        <Panel title="Competitors" description="From verified records of companies like yours.">
          {!competitors ? (
            <EmptyState
              compact
              icon={Building2}
              title="Competitors not checked yet"
              description="See where you stand on money raised, stage and team."
              action={
                <Button size="sm" asChild>
                  <Link href={startupHref(startup.id, "competitors")}>Find competitors</Link>
                </Button>
              }
            />
          ) : rivals.length ? (
            <div className="grid grid-cols-3 gap-3">
              {rivals.map((c) => (
                <Link key={c.id} href={`/company/${c.id}`} className="rounded-lg border p-3 transition-colors hover:border-primary/40">
                  <div className="flex items-center gap-2">
                    <EntityAvatar name={c.name} size="sm" />
                    <span className="truncate text-sm font-medium">{c.name}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{c.description?.value ?? "No description on record"}</p>
                  <p className="mt-2 text-xs tabular">
                    {c.last_round ? `${c.last_round.stage} · ${formatMoney(c.last_round.amount)}` : "No funding on record"}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No competitors on record.</p>
          )}
        </Panel>
      </div>
      {side}
    </div>
  );
}

async function InvestorHome({ investorId, slush }: { investorId: string; slush: Slush }) {
  const data = (await getInvestor(investorId))!;
  const portfolio = await getCompanies(data.investor.portfolioIds);
  const newAtSlush = slush.companies.filter((c) => !data.investor.portfolioIds.includes(c.id)).slice(0, 4);

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Portfolio companies" value={portfolio.length} icon={Building2} sources={data.investor.description.sources} hint="Prefilled from verified records" />
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
        <Panel title="Deck check" description="Upload a founder's deck and check each claim against verified sources.">
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
        <SlushPanel slush={slush} />
        <Suspense fallback={<Skeleton className="h-56 rounded-xl" />}>
          <ChangesPanel />
        </Suspense>
      </div>
    </div>
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

/** The newest changes across the watch list. */
async function ChangesPanel() {
  const { changes } = await getChanges();
  return (
    <Panel
      title="Latest changes"
      action={
        <Link href="/watchlist" className="text-xs text-primary hover:underline">
          Watch list
        </Link>
      }
    >
      <ul className="space-y-3">
        {changes.slice(0, 4).map((a) => (
          <li key={a.id} className="flex gap-2.5">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
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
        {!changes.length && (
          <li className="flex items-center gap-2 text-sm text-muted-foreground">
            <Bell className="size-4" /> Nothing new.
          </li>
        )}
      </ul>
    </Panel>
  );
}
