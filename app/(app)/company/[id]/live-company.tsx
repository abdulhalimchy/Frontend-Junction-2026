import { ArrowLeft, ArrowRight, CalendarDays, Crown, Handshake, Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Pill, SlushTag } from "@/components/warmline/badges";
import { EmptyState, EntityAvatar, Panel } from "@/components/warmline/blocks";
import { MarketError, ResultsLoading } from "@/components/warmline/market-view";
import { SourceChip } from "@/components/warmline/source-chip";
import { FundingStats, Header, InvestorList, RoundsTable } from "@/app/(app)/market/company-analysis";
import { SLUSH_EVENT_ID } from "@/lib/mocks/misc";
import { fetchCompanyPeople, fetchCompanyProfile, type CompanyPeople, type PersonLink } from "@/lib/cala/company";
import { formatFuzzyDate } from "@/lib/format";
import { groupInvestors } from "@/lib/names";
import type { CompanyProfile } from "@/lib/types";

/** Company overview from Cala: profile, funding, investors, people, events and deals. Two cached Cala calls. */
export async function LiveCompany({ id }: { id: string }) {
  let p: CompanyProfile;
  try {
    p = await fetchCompanyProfile(id);
  } catch (e) {
    return <MarketError error={e} />;
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <Link href="/market?mode=company" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" /> Company analysis
        </Link>
        <Button variant="outline" size="sm" className="bg-card" asChild>
          <Link href={`/market?${new URLSearchParams({ company: id, region: "anywhere" })}`}>
            Competitors&apos; market <ArrowRight />
          </Link>
        </Button>
      </div>

      <Header p={p} />
      <FundingStats p={p} />

      <div className="mb-6 grid grid-cols-3 gap-6">
        <Panel className="col-span-2" title="Funding rounds" description="Every round Cala has a source for. Only equity and grants are summed.">
          <RoundsTable rounds={p.rounds} />
        </Panel>
        <Panel title="Investors" description="Click an investor for its portfolio and activity.">
          <InvestorList investors={groupInvestors(p.investors)} />
        </Panel>
      </div>

      <Suspense fallback={<ResultsLoading />}>
        <PeopleAndEvents id={id} />
      </Suspense>

      <Panel className="mt-6" title="Acquisitions and deals" description="Corporate deals the company took part in, from filings and announcements.">
        {p.deals.length ? (
          <ul className="divide-y">
            {p.deals.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <Handshake className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">{d.kind}</span>
                {d.role && <Pill>{d.role}</Pill>}
                <span className="ml-auto text-xs text-muted-foreground tabular">
                  {d.date ? formatFuzzyDate({ date: d.date, precision: "day" }) : "Date not on record"}
                </span>
                <SourceChip sources={d.sources} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No acquisitions or deals on record.</p>
        )}
      </Panel>
    </>
  );
}

async function PeopleAndEvents({ id }: { id: string }) {
  let people: CompanyPeople;
  try {
    people = await fetchCompanyPeople(id);
  } catch (e) {
    return <MarketError error={e} />;
  }
  const slush = people.events.find((e) => e.id === SLUSH_EVENT_ID);
  const leaders = mergeRoles([...people.founders, ...people.leadership]);

  return (
    <>
      {people.events.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border bg-card px-5 py-3">
          <CalendarDays className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Events</span>
          {people.events.map((e) => (
            <span key={e.id} className="inline-flex items-center gap-1.5">
              {e.id === SLUSH_EVENT_ID ? <SlushTag label={`Slush 2026${e.role ? ` · ${e.role}` : ""}`} /> : <Pill>{e.name}{e.role ? ` · ${e.role}` : ""}</Pill>}
              <SourceChip sources={e.sources} />
            </span>
          ))}
          {slush && (
            <Link href="/events/slush-2026/overview" className="ml-auto text-xs text-primary hover:underline">
              Open Slush 2026 space
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <Panel title="Founders and leadership" description="Roles with the date they start on record.">
          <PeopleList people={leaders} empty="No founders or executives on record." icon={Crown} />
        </Panel>
        <Panel title="Team" description="Other people Cala links to the company, with their role.">
          <PeopleList people={people.team} empty="No team members on record." icon={Users} />
        </Panel>
        <Panel title="Board" description="Directors, often from filings.">
          <PeopleList people={people.board} empty="No board members on record." icon={Users} />
        </Panel>
      </div>
    </>
  );
}

/** One row per person: "Founder, CEO since 25 Oct 2022" instead of two rows. */
function mergeRoles(list: PersonLink[]): PersonLink[] {
  const byId = new Map<string, PersonLink>();
  for (const p of list) {
    const e = byId.get(p.id);
    if (!e) byId.set(p.id, { ...p });
    else {
      e.role = `${e.role}, ${p.role}`;
      e.since = e.since && p.since ? (e.since < p.since ? e.since : p.since) : (e.since ?? p.since);
      e.sources = [...e.sources, ...p.sources.filter((s) => !e.sources.some((x) => x.document === s.document))];
    }
  }
  return [...byId.values()];
}

/**
 * Relationship dates carry no stated precision; a 1 January date is almost always a year-only placeholder,
 * so it is shown as the year rather than a precise day.
 */
function personDate(d: string) {
  return d.endsWith("-01-01") ? d.slice(0, 4) : formatFuzzyDate({ date: d, precision: "day" });
}

function PeopleList({ people, empty, icon: Icon }: { people: PersonLink[]; empty: string; icon: typeof Users }) {
  if (!people.length) return <EmptyState compact icon={Icon} title={empty} />;
  return (
    <ul className="max-h-80 space-y-2.5 overflow-auto pr-1">
      {people.map((p) => (
        <li key={`${p.id}-${p.role}`} className="flex items-start gap-2.5">
          <EntityAvatar name={p.name} kind="person" size="sm" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{p.name}</div>
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
