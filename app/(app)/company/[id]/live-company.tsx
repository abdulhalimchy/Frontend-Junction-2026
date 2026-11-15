import { ArrowDown, ArrowLeft, CalendarDays, Crown, Handshake, Route, Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CompanyKeyFacts, CompanyKeyFactsSkeleton } from "@/components/warmline/company-facts";
import { Pill, SlushTag } from "@/components/warmline/badges";
import { EmptyState, EntityAvatar, Panel } from "@/components/warmline/blocks";
import { CompanyAsk } from "@/components/warmline/company-ask";
import { MarketError } from "@/components/warmline/market-view";
import { SourceChip } from "@/components/warmline/source-chip";
import { WatchButton } from "@/components/warmline/watch-button";
import { InvestorList, RoundsTable } from "../../market/company-analysis";
import { CompetitorsSection } from "./company-market";
import { SLUSH_EVENT_ID } from "@/lib/mocks/misc";
import { fetchCompanyPeople, fetchCompanyProfile, type CompanyPeople, type PersonLink } from "@/lib/cala/company";
import { EMPTY_EXTRAS, fetchCompanyExtras, type CompanyExtras } from "@/lib/cala/company-extras";
import { fetchRoundDetail, type RoundDetail } from "@/lib/cala/rounds";
import { formatFuzzyDate, formatMoney, shortPlace } from "@/lib/format";
import { groupInvestors } from "@/lib/names";
import type { CompanyProfile, FundingRound } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CountriesPanel, FinancialsPanel, GroupPanel, InvestmentsPanel, ListingBadges, ProductsPanel, RegistryPanel } from "./company-extras";

// Company brief from Cala. Layout: header, key facts, funding timeline with leads, people; a right column with
// events, investors, board and deals. Costs: profile (shared with every company view), people and events,
// one call per round shown in the timeline (at most TIMELINE_ROUNDS), and two for the extras (introspection,
// then only the fields that exist: financials, listing, group, products, investments, countries, registry),
// all cached for 7 days.

const TIMELINE_ROUNDS = 6;
const EMPTY_PEOPLE: CompanyPeople = { founders: [], leadership: [], board: [], team: [], events: [] };

export async function LiveCompany({ id, region }: { id: string; region: string }) {
  const [profile, peopleRes, extrasRes] = await Promise.allSettled([fetchCompanyProfile(id), fetchCompanyPeople(id), fetchCompanyExtras(id)]);
  if (profile.status === "rejected") return <MarketError error={profile.reason} />;
  const p = profile.value;
  const people = peopleRes.status === "fulfilled" ? peopleRes.value : EMPTY_PEOPLE;
  const extras = extrasRes.status === "fulfilled" ? extrasRes.value : EMPTY_EXTRAS;
  const slush = people.events.find((e) => e.id === SLUSH_EVENT_ID);

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <Link href="/market?mode=company" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" /> Company analysis
        </Link>
        <div className="flex items-center gap-2">
          <WatchButton entityType="company" calaId={id} name={p.name} size="sm" />
          <Button variant="outline" size="sm" className="bg-card" asChild>
            <Link href={`/intros?${new URLSearchParams({ to: id, toName: p.name })}`}>
              <Route /> Warm intro
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="bg-card" asChild>
            <a href="#competitors">
              Competitors&apos; market <ArrowDown />
            </a>
          </Button>
        </div>
      </div>

      <Header p={p} slush={slush} extras={extras} />

      <CompanyBody id={id} p={p} people={people} extras={extras} />

      <CompetitorsSection profile={p} region={region} />
    </>
  );
}

/** Cala's record for a company without the page header: key facts, funding, people, investors, events and
 * deals. Used by My startup for a startup matched to a Cala company. */
export async function CompanyRecord({ id }: { id: string }) {
  const [profile, peopleRes, extrasRes] = await Promise.allSettled([fetchCompanyProfile(id), fetchCompanyPeople(id), fetchCompanyExtras(id)]);
  if (profile.status === "rejected") return <MarketError error={profile.reason} />;
  const people = peopleRes.status === "fulfilled" ? peopleRes.value : EMPTY_PEOPLE;
  const extras = extrasRes.status === "fulfilled" ? extrasRes.value : EMPTY_EXTRAS;
  return <CompanyBody id={id} p={profile.value} people={people} extras={extras} />;
}

function CompanyBody({ id, p, people, extras }: { id: string; p: CompanyProfile; people: CompanyPeople; extras: CompanyExtras }) {
  const listing = extras.listings[0];
  // Rounds that move money and have a date, newest first.
  const timeline = p.rounds
    .filter((r) => r.kind !== "other" && r.date)
    .sort((a, b) => (b.date?.date ?? "").localeCompare(a.date?.date ?? ""))
    .slice(0, TIMELINE_ROUNDS);
  const counts = {
    equity: p.rounds.filter((r) => r.kind === "equity").length,
    grant: p.rounds.filter((r) => r.kind === "grant").length,
    other: p.rounds.filter((r) => r.kind === "other").length,
  };

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-6">
        <Suspense fallback={<CompanyKeyFactsSkeleton />}>
          <CompanyKeyFacts p={p} listing={listing} />
        </Suspense>

        <FinancialsPanel metrics={extras.financials} />

        <Panel
          title={
            <span className="flex items-center gap-2">
              Funding timeline
              {counts.equity > 0 && <Pill>{plural(counts.equity, "equity round")}</Pill>}
              {counts.grant > 0 && <Pill tone="success">{plural(counts.grant, "grant")}</Pill>}
            </span>
          }
          description={
            <>
              Newest first, with who led each round. Only equity and grants are summed anywhere on this page.
              {counts.other > 0 && ` ${plural(counts.other, "filing")} without a round type ${counts.other === 1 ? "is" : "are"} left out.`}
            </>
          }
        >
          {timeline.length ? (
            <Suspense fallback={<Skeleton className="h-40 rounded-xl" />}>
              <Timeline rounds={timeline} />
            </Suspense>
          ) : (
            <EmptyState compact title="No funding on record" description="Normal for bootstrapped and young companies." />
          )}
          {p.rounds.length > timeline.length && (
            <details className="mt-4 border-t pt-3">
              <summary className="cursor-pointer text-sm font-medium text-primary hover:underline">Show all {plural(p.rounds.length, "round")} and filings</summary>
              <div className="mt-3">
                <RoundsTable rounds={p.rounds} />
              </div>
            </details>
          )}
        </Panel>

        <Panel title="People" description="Founders and leadership first, with the role and start date on record.">
          <People people={people} />
        </Panel>
      </div>

      <div className="space-y-6">
        <CompanyAsk companyId={id} companyName={p.name} />
        {people.events.length > 0 && (
          <Panel title="Events">
            <ul className="space-y-2">
              {people.events.map((e) => (
                <li key={e.id} className="flex items-center gap-2">
                  <CalendarDays className="size-4 text-muted-foreground" />
                  {e.id === SLUSH_EVENT_ID ? (
                    <Link href="/events/slush-2026/overview">
                      <SlushTag label={`Slush 2026${e.role ? ` · ${e.role}` : ""}`} />
                    </Link>
                  ) : (
                    <span className="text-sm">
                      {e.name}
                      {e.role ? ` · ${e.role}` : ""}
                    </span>
                  )}
                  <SourceChip sources={e.sources} className="ml-auto" />
                </li>
              ))}
            </ul>
          </Panel>
        )}
        <Panel title="Investors" description="Click one for its portfolio and activity.">
          <InvestorList investors={groupInvestors(p.investors)} />
        </Panel>
        <ProductsPanel products={extras.products} />
        <Panel title="Board" description="Directors, often from filings.">
          <PeopleList people={mergeRoles(people.board)} empty="No board members on record." icon={Users} />
        </Panel>
        <GroupPanel parents={extras.parents} subsidiaries={extras.subsidiaries} more={extras.subsidiaryCountMayBeMore} />
        <InvestmentsPanel investments={extras.investments} name={p.name} />
        <CountriesPanel countries={extras.countries} />
        <Panel title="Acquisitions and deals">
          {p.deals.length ? (
            <ul className="space-y-2.5">
              {p.deals.map((d) => (
                <li key={d.id} className="flex items-start gap-2.5">
                  <Handshake className="mt-0.5 size-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{d.kind}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.role ? `${d.role} · ` : ""}
                      {d.date ? formatFuzzyDate({ date: d.date, precision: "day" }) : "Date not on record"}
                    </div>
                  </div>
                  <SourceChip sources={d.sources} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No acquisitions or deals on record.</p>
          )}
        </Panel>
        <RegistryPanel extras={extras} />
      </div>
    </div>
  );
}

function Header({ p, slush, extras }: { p: CompanyProfile; slush?: CompanyPeople["events"][number]; extras: CompanyExtras }) {
  const place = p.hq ? shortPlace(p.hq.value) : p.countries[0];
  // Cala lists industries in no particular order, so show a few rather than pretend the first is the main one.
  const industry = p.industries.length ? p.industries.slice(0, 3).map((i) => i.label ?? i.name).join(", ") + (p.industries.length > 3 ? ` +${p.industries.length - 3}` : "") : null;
  return (
    <div className="mb-6 rounded-2xl border bg-card p-6 shadow-[0_1px_2px_rgba(22,24,26,0.04)]">
      <div className="flex items-start gap-5">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-semibold text-primary-foreground">
          {initials(p.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[26px] font-semibold tracking-tight">{p.name}</h1>
            {slush && (
              <Link href="/events/slush-2026/overview">
                <SlushTag label="At Slush 2026" />
              </Link>
            )}
            {p.status && <Pill tone={/active/i.test(p.status.value) ? "success" : "neutral"}>{p.status.value}</Pill>}
            <ListingBadges extras={extras} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {industry && <span>{industry}</span>}
            {industry && place && <Dot />}
            {place && (
              <span className="inline-flex items-center gap-1">
                {place} {p.hq && <SourceChip sources={p.hq.sources} />}
              </span>
            )}
            {p.founded && (
              <>
                <Dot />
                <span className="inline-flex items-center gap-1">
                  Founded {formatFuzzyDate(p.founded.value)} <SourceChip sources={p.founded.sources} />
                </span>
              </>
            )}
            {p.website && (
              <>
                <Dot />
                <span>{p.website.value}</span>
              </>
            )}
          </div>
          {p.description && (
            <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed">
              <span>{p.description.value}</span>
              <SourceChip sources={p.description.sources} className="mt-0.5" />
            </p>
          )}
          {p.legalName && p.legalName.value !== p.name && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              Legal name: {p.legalName.value} <SourceChip sources={p.legalName.sources} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Horizontal timeline: one card per round, newest first, with its lead and co-investors. */
async function Timeline({ rounds }: { rounds: FundingRound[] }) {
  const details = await Promise.all(rounds.map((r) => fetchRoundDetail(r.id, r.stage).catch(() => null)));
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-max gap-3">
        {rounds.map((r, i) => (
          <RoundCard key={r.id} r={r} d={details[i]} latest={i === 0} />
        ))}
      </div>
    </div>
  );
}

function RoundCard({ r, d, latest }: { r: FundingRound; d: RoundDetail | null; latest: boolean }) {
  const grant = r.kind === "grant";
  return (
    <div className={cn("w-60 shrink-0 rounded-xl border p-4", latest ? "border-primary/30 bg-teal-soft/40" : "bg-background/60")}>
      <div className="flex items-center gap-2">
        <span className={cn("size-2.5 rounded-full", latest ? "bg-primary" : "bg-muted-foreground/40")} />
        <span className="text-sm font-semibold">{r.stage}</span>
        <span className="text-xs text-muted-foreground tabular">{formatFuzzyDate(r.date)}</span>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xl font-semibold tabular">{formatMoney(r.amount)}</span>
        {latest ? <Pill tone="teal">Latest</Pill> : grant ? <Pill tone="success">Grant</Pill> : null}
      </div>
      <div className="mt-3 space-y-1 text-[13px]">
        {d && d.leads.length > 0 && (
          <div className="truncate">
            <span className="text-muted-foreground">Lead: </span>
            {d.leads.map((l, i) => (
              <span key={l.id}>
                {i > 0 && ", "}
                <Link href={`/investor/${l.id}`} className="font-medium text-primary hover:underline">
                  {l.name}
                </Link>
              </span>
            ))}
          </div>
        )}
        {d && d.participants.length > 0 && (
          <div className="line-clamp-2 text-muted-foreground">
            Co-investors: {d.participants.slice(0, 3).map((x) => x.name).join(", ")}
            {d.participants.length > 3 ? ` +${d.participants.length - 3}` : ""}
          </div>
        )}
      </div>
      <div className="mt-3">
        <SourceChip sources={r.sources} />
      </div>
    </div>
  );
}

function People({ people }: { people: CompanyPeople }) {
  const leaders = mergeRoles([...people.founders, ...people.leadership]);
  // Leaders often appear again under WORKS_AT (sometimes as a separate entity); show them once.
  const leaderNames = new Set(leaders.map((l) => l.name.toLowerCase()));
  const team = mergeRoles(people.team.filter((t) => !leaderNames.has(t.name.toLowerCase())));
  if (!leaders.length && !team.length) return <EmptyState compact icon={Users} title="No people on record" />;
  return (
    <div className="space-y-4">
      {leaders.length > 0 && <PeopleList people={leaders} empty="" icon={Crown} large />}
      {team.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">Team</div>
          <PeopleList people={team} empty="" icon={Users} />
        </div>
      )}
    </div>
  );
}

/** One row per person: "Founder, CEO since 25 Oct 2022" instead of two rows. */
function mergeRoles(list: PersonLink[]): PersonLink[] {
  // Keyed by name: Cala sometimes holds one person as several entities.
  const byId = new Map<string, PersonLink>();
  for (const p of list) {
    const key = p.name.toLowerCase();
    const e = byId.get(key);
    if (!e) byId.set(key, { ...p });
    else {
      if (!e.role.split(", ").includes(p.role)) e.role = `${e.role}, ${p.role}`;
      e.until = e.until && p.until ? (e.until > p.until ? e.until : p.until) : null;
      e.since = e.since && p.since ? (e.since < p.since ? e.since : p.since) : (e.since ?? p.since);
      e.sources = [...e.sources, ...p.sources.filter((s) => !e.sources.some((x) => x.document === s.document))];
    }
  }
  // People still in the role first; former ones (with an end date) after.
  return [...byId.values()].sort((a, b) => Number(!!a.until) - Number(!!b.until));
}

/**
 * Relationship dates carry no stated precision; a 1 January date is almost always a year-only placeholder,
 * so it is shown as the year rather than a precise day.
 */
function personDate(d: string) {
  return d.endsWith("-01-01") ? d.slice(0, 4) : formatFuzzyDate({ date: d, precision: "day" });
}

function PeopleList({ people, empty, icon: Icon, large }: { people: PersonLink[]; empty: string; icon: typeof Users; large?: boolean }) {
  if (!people.length) return empty ? <EmptyState compact icon={Icon} title={empty} /> : null;
  return (
    <ul className={cn("space-y-2.5", !large && "max-h-72 overflow-auto pr-1")}>
      {people.map((p) => (
        <li key={`${p.id}-${p.role}`} className={cn("flex items-center gap-3", large && "rounded-lg px-1 py-1")}>
          <EntityAvatar name={p.name} kind="person" size={large ? "md" : "sm"} />
          <div className="min-w-0 flex-1">
            <div className={cn("truncate font-medium", large ? "text-[15px]" : "text-sm")}>{p.name}</div>
            <div className="truncate text-xs text-muted-foreground">
              {p.role}
              {p.since && ` · since ${personDate(p.since)}`}
              {p.until && ` · until ${personDate(p.until)}`}
            </div>
          </div>
          <SourceChip sources={p.sources} />
        </li>
      ))}
    </ul>
  );
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function Dot() {
  return <span className="text-subtle">·</span>;
}

function initials(name: string) {
  return name
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

