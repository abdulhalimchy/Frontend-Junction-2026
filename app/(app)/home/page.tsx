import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bookmark,
  Building2,
  ChevronRight,
  FileSearch,
  Landmark,
  LineChart,
  Rocket,
  Route,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import Loading from "@/app/(app)/loading";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SlushTag } from "@/components/warmline/badges";
import { EmptyState, EntityAvatar, Panel } from "@/components/warmline/blocks";
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
import type { CompetitorsAnalysis, InvestorsAnalysis, Source } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Home" };

/** The demo is set four days before Slush; the hero and the copy read from this one value. */
const DAYS_TO_SLUSH = 4;

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

  const description =
    profile.role === "founder"
      ? founder?.startup
        ? `Here are your best investor matches, your competitors, and what changed around ${founder.startup.name}.`
        : "Add your startup to see which investors fit and how you compare."
      : "Here is what changed across your portfolio and who is new on the attendee list.";

  return (
    <div className="space-y-6">
      <Hero firstName={firstName} description={description} slush={slush} />
      {founder ? (
        <FounderHome {...founder} slush={slush} />
      ) : (
        <InvestorHome investorId={profile.investorId!} slush={slush} />
      )}
    </div>
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

/* ------------------------------------------------------------------ Hero */

function Hero({ firstName, description, slush }: { firstName: string; description: string; slush: Slush }) {
  const e = slush.event;
  return (
    <section className="relative overflow-hidden rounded-2xl border bg-card shadow-panel">
      {/* Soft Slush glow behind the countdown; amber is reserved for Slush. */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-slush/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 left-1/3 size-72 rounded-full bg-brand/10 blur-3xl" />

      <div className="relative grid gap-6 p-5 sm:p-6 md:p-8 xl:grid-cols-[1fr_auto] xl:items-center">
        <div className="min-w-0">
          <SlushTag label="Slush 2026 · 18–19 Nov, Helsinki" />
          <h1 className="mt-3 text-[28px] leading-tight font-semibold tracking-tight md:text-[32px]">
            Welcome back, {firstName}
          </h1>
          <p className="mt-2 max-w-xl text-[15px] text-muted-foreground">
            Slush is in <span className="font-medium text-foreground">{DAYS_TO_SLUSH} days</span>. {description}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/events/slush-2026/overview">
                Open event space <ArrowRight />
              </Link>
            </Button>
            <Button variant="outline" className="bg-card/70" asChild>
              <Link href="/events/slush-2026/new">See who&apos;s new</Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row">
          <div className="flex min-w-32 flex-col justify-center rounded-xl border border-slush/40 bg-slush-soft/70 px-5 py-4 text-center backdrop-blur-sm">
            <span className="text-5xl leading-none font-semibold tracking-tight text-slush-foreground tabular">{DAYS_TO_SLUSH}</span>
            <span className="mt-1.5 text-xs font-medium text-slush-foreground/80">days to Slush</span>
          </div>
          <dl className="grid min-w-44 flex-1 grid-cols-1 gap-2 rounded-xl border bg-card/80 px-4 py-3 backdrop-blur-sm">
            <HeroStat label="Companies" value={e.attendeeCompanies.value.toLocaleString("en")} sources={e.attendeeCompanies.sources} />
            <HeroStat label="Investors" value={e.attendeeInvestors.value.toLocaleString("en")} sources={e.attendeeInvestors.sources} />
            <div className="flex items-center gap-1.5 text-xs font-medium text-slush-foreground">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-slush opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-slush" />
              </span>
              {e.newThisWeek} joined this week
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

function HeroStat({ label, value, sources }: { label: string; value: string; sources?: Source[] }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1.5">
        <span className="text-lg font-semibold tracking-tight tabular">{value}</span>
        {sources && <SourceChip sources={sources} />}
      </dd>
    </div>
  );
}

/* --------------------------------------------------------- Quick actions */

type QuickAction = { href: string; label: string; hint: string; icon: LucideIcon };

function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <nav aria-label="Quick actions" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {actions.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="group flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-panel transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-glow"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <a.icon className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{a.label}</span>
            <span className="block truncate text-xs text-muted-foreground">{a.hint}</span>
          </span>
          <ArrowUpRight className="size-4 shrink-0 text-subtle transition-colors group-hover:text-primary" />
        </Link>
      ))}
    </nav>
  );
}

/* --------------------------------------------------------------- Founder */

async function FounderHome({ startup, competitors, investors, slushIndex }: NonNullable<Founder> & { slush: Slush }) {
  const atSlush = (name: string, id: string) => !!slushIndex && (slushIndex.ids.has(id) || slushIndex.names.has(normaliseName(name)));

  const actions: QuickAction[] = [
    { href: startup ? startupHref(startup.id, "investors") : "/market", label: "Find investors", hint: "Who funds companies like yours", icon: Landmark },
    { href: "/intros", label: "Connect", hint: "Who can introduce you", icon: Route },
    { href: "/market", label: "Market", hint: "Size up your space", icon: LineChart },
    { href: "/watchlist", label: "Watch list", hint: "What you follow", icon: Bookmark },
  ];

  if (!startup)
    return (
      <>
        <QuickActions actions={actions} />
        <MainGrid side={<ChangesSide />}>
          <EmptyState
            icon={Rocket}
            title="Add your startup"
            description="We look it up in verified records, then show which investors fit and how you compare with your competitors."
            action={<AddStartupButton />}
          />
        </MainGrid>
      </>
    );

  // Best matches overall; attending Slush is a tag, not a filter.
  const topInvestors = [...(investors?.investors ?? [])].sort((a, b) => b.match.score - a.match.score).slice(0, 5);
  const rivals = (competitors?.companies ?? []).slice(0, 3);

  return (
    <>
      <QuickActions actions={actions} />
      <MainGrid side={<ChangesSide />}>
        <Panel
          title={<PanelTitle icon={Landmark}>Investors for you</PanelTitle>}
          description="Investing in companies like yours, checked against your competitors."
          action={<SeeAll href={startupHref(startup.id, "investors")}>All investors</SeeAll>}
        >
          {!investors ? (
            <EmptyState
              compact
              icon={Landmark}
              title="Investors not checked yet"
              description="Find who funds companies like yours and how well each one fits."
              action={
                <Button size="sm" asChild>
                  <Link href={startupHref(startup.id, "investors")}>Find investors</Link>
                </Button>
              }
            />
          ) : topInvestors.length ? (
            <ul className="-mx-2">
              {topInvestors.map((i) => (
                <li key={i.id}>
                  <RowLink href={`/investor/${i.id}`}>
                    <EntityAvatar name={i.name} kind="investor" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium group-hover:text-primary">{i.name}</span>
                        {atSlush(i.name, i.id) && <SlushTag label="At Slush" className="shrink-0" />}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{i.why}</div>
                    </div>
                    <div className="hidden items-center gap-2 text-xs sm:flex">
                      {i.conflict === "competitor" && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-warning">Backs a competitor</span>}
                      <MatchMeter score={i.match.score} />
                      <SourceChip sources={i.sources} />
                    </div>
                  </RowLink>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No investors on record for companies like yours.</p>
          )}
        </Panel>

        <Panel
          title={<PanelTitle icon={Building2}>Competitors</PanelTitle>}
          description="From verified records of companies like yours."
          action={competitors ? <SeeAll href={startupHref(startup.id, "competitors")}>Compare</SeeAll> : undefined}
        >
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
            <div className="grid gap-3 sm:grid-cols-3">
              {rivals.map((c) => (
                <Link
                  key={c.id}
                  href={`/company/${c.id}`}
                  className="group flex flex-col rounded-lg border bg-background/40 p-3.5 transition-all hover:-translate-y-px hover:border-primary/40 hover:bg-card hover:shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <EntityAvatar name={c.name} size="sm" />
                    <span className="truncate text-sm font-medium group-hover:text-primary">{c.name}</span>
                    {atSlush(c.name, c.id) && <SlushTag label="At Slush" className="ml-auto shrink-0" />}
                  </div>
                  <p className="mt-2 line-clamp-2 flex-1 text-xs text-muted-foreground">{c.description?.value ?? "No description on record"}</p>
                  <div className="mt-3 border-t border-dashed pt-2.5 text-xs">
                    {c.last_round ? (
                      <span className="flex items-center justify-between gap-2">
                        <span className="rounded-full bg-brand-soft px-2 py-0.5 font-medium text-accent-foreground">{c.last_round.stage}</span>
                        <span className="font-semibold tabular">{formatMoney(c.last_round.amount)}</span>
                      </span>
                    ) : (
                      <span className="text-subtle">No funding on record</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No competitors on record.</p>
          )}
        </Panel>
      </MainGrid>
    </>
  );
}

/* -------------------------------------------------------------- Investor */

async function InvestorHome({ investorId, slush }: { investorId: string; slush: Slush }) {
  const data = (await getInvestor(investorId))!;
  const portfolio = await getCompanies(data.investor.portfolioIds);
  const newAtSlush = slush.companies.filter((c) => !data.investor.portfolioIds.includes(c.id)).slice(0, 4);
  const portfolioAtSlush = portfolio.filter((c) => c.attendsSlush).length;

  const actions: QuickAction[] = [
    { href: "/portfolio", label: "Portfolio", hint: "Your companies", icon: Building2 },
    { href: "/deck-check", label: "Deck check", hint: "Verify a founder's claims", icon: FileSearch },
    { href: "/intros", label: "Connect", hint: "Who can introduce you", icon: Route },
    { href: "/market", label: "Market", hint: "Analyse a market", icon: LineChart },
  ];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="Portfolio companies"
          value={portfolio.length}
          icon={Building2}
          sources={data.investor.description.sources}
          hint="Prefilled from verified records"
          href="/portfolio"
        />
        <Metric label="Deals, last 12 months" value={data.check.stillActive.value.dealsLast12m} icon={Landmark} sources={data.check.stillActive.sources} hint="Still actively investing" />
        <Metric
          label="Portfolio at Slush"
          value={portfolioAtSlush}
          icon={Users}
          tone="slush"
          sources={slush.event.attendeeCompanies.sources}
          hint={portfolio.length ? `${Math.round((portfolioAtSlush / portfolio.length) * 100)}% of your companies attend` : undefined}
          progress={portfolio.length ? portfolioAtSlush / portfolio.length : undefined}
        />
      </div>

      <QuickActions actions={actions} />

      <MainGrid side={<ChangesSide />}>
        <Panel
          title={<PanelTitle icon={Users}>New at Slush, outside your portfolio</PanelTitle>}
          description="Recently joined the attendee list. Matched on description to your focus."
          action={<SeeAll href="/events/slush-2026/new">See all</SeeAll>}
        >
          {newAtSlush.length ? (
            <ul className="-mx-2">
              {newAtSlush.map((c) => (
                <li key={c.id}>
                  <RowLink href={`/company/${c.id}`}>
                    <EntityAvatar name={c.name} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium group-hover:text-primary">{c.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{c.description.value}</div>
                    </div>
                    <span className="hidden shrink-0 rounded-full bg-slush-soft px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-slush-foreground sm:inline">
                      Joined {formatDay(c.slushJoined!)}
                    </span>
                    <SourceChip sources={c.description.sources} />
                  </RowLink>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No new companies outside your portfolio this week.</p>
          )}
        </Panel>

        <Panel
          title={<PanelTitle icon={FileSearch}>Deck check</PanelTitle>}
          description="Upload a founder's deck and check each claim against verified sources."
          action={<SeeAll href="/deck-check">Open</SeeAll>}
        >
          <Link
            href="/deck-check"
            className="group flex flex-col gap-4 rounded-lg border bg-background/40 p-4 transition-colors hover:border-primary/40 sm:flex-row sm:items-center"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft">
                <FileSearch className="size-5 text-primary" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium group-hover:text-primary">Tidewise_SeriesB_teaser.pdf</div>
                <div className="text-xs text-muted-foreground">5 claims checked</div>
              </div>
            </div>
            <ClaimBar confirmed={3} differs={1} unknown={1} />
          </Link>
        </Panel>
      </MainGrid>
    </>
  );
}

/* ----------------------------------------------------------- Shared bits */

function MainGrid({ children, side }: { children: React.ReactNode; side: React.ReactNode }) {
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="min-w-0 space-y-6 xl:col-span-2">{children}</div>
      <aside className="min-w-0 space-y-6">{side}</aside>
    </div>
  );
}

function ChangesSide() {
  return (
    <Suspense fallback={<Skeleton className="h-72 rounded-xl" />}>
      <ChangesPanel />
    </Suspense>
  );
}

function PanelTitle({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <Icon className="size-4 text-primary" />
      {children}
    </span>
  );
}

function SeeAll({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button variant="ghost" size="sm" className="shrink-0 text-primary" asChild>
      <Link href={href}>
        {children} <ArrowRight />
      </Link>
    </Button>
  );
}

function RowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60">
      {children}
      <ChevronRight className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}

function MatchMeter({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <span className="flex items-center gap-2" title={`${pct}% match`}>
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </span>
      <span className="w-9 text-right font-medium tabular">{pct}%</span>
    </span>
  );
}

function Metric({
  label,
  value,
  hint,
  sources,
  icon: Icon,
  tone = "default",
  href,
  progress,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  sources?: Source[];
  icon: LucideIcon;
  tone?: "default" | "slush";
  href?: string;
  progress?: number;
}) {
  const slush = tone === "slush";
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-lg",
            slush ? "bg-slush/25 text-slush-foreground" : "bg-brand-soft text-primary",
          )}
        >
          <Icon className="size-4" />
        </span>
        {sources && <SourceChip sources={sources} />}
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight tabular">{value}</div>
      <div className="mt-0.5 text-[13px] font-medium">{label}</div>
      {progress !== undefined && (
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slush/20">
          <div className="h-full rounded-full bg-slush" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      {hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
    </>
  );
  const cls = cn(
    "block rounded-xl border bg-card p-4 shadow-panel",
    slush && "border-slush/40 bg-slush-soft/50",
    href && "transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-glow",
  );
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Claim outcomes as one stacked bar; "can't verify" stays neutral, never red. */
function ClaimBar({ confirmed, differs, unknown }: { confirmed: number; differs: number; unknown: number }) {
  const total = confirmed + differs + unknown || 1;
  const parts = [
    { n: confirmed, label: "confirmed", bar: "bg-success", dot: "bg-success" },
    { n: differs, label: "differs", bar: "bg-warning", dot: "bg-warning" },
    { n: unknown, label: "can't verify", bar: "bg-subtle/50", dot: "bg-subtle" },
  ];
  return (
    <div className="w-full sm:w-64">
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
        {parts.map((p) => p.n > 0 && <span key={p.label} className={p.bar} style={{ width: `${(p.n / total) * 100}%` }} />)}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {parts.map((p) => (
          <span key={p.label} className="flex items-center gap-1.5">
            <span className={cn("size-1.5 rounded-full", p.dot)} />
            <span className="font-medium text-foreground tabular">{p.n}</span> {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The newest changes across the watch list, as a timeline. */
async function ChangesPanel() {
  const { changes } = await getChanges();
  const latest = changes.slice(0, 5);
  return (
    <Panel
      title={<PanelTitle icon={Bell}>Latest changes</PanelTitle>}
      action={
        <Link href="/watchlist" className="mt-0.5 shrink-0 text-xs font-medium text-primary hover:underline">
          Watch list
        </Link>
      }
    >
      {latest.length ? (
        <ol className="relative space-y-4 before:absolute before:top-1.5 before:bottom-1.5 before:left-[3px] before:w-px before:bg-border">
          {latest.map((a, i) => (
            <li key={a.id} className="relative flex gap-3">
              <span
                className={cn(
                  "relative mt-1.5 size-[7px] shrink-0 rounded-full ring-4 ring-card",
                  i === 0 ? "bg-primary" : "bg-primary/40",
                )}
              />
              <div className="min-w-0">
                <Link href={a.href} className="text-[13px] leading-snug font-medium hover:text-primary">
                  {a.title}
                </Link>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  {formatDay(a.date)}
                  <SourceChip sources={a.sources} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          <Bell className="size-4" />
          Nothing new on your watch list.
        </div>
      )}
    </Panel>
  );
}
