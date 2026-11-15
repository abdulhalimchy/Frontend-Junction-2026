import Link from "next/link";
import { normaliseName } from "@/lib/cala/market";
import { slushAttendeeIndex } from "@/lib/cala/slush";
import { formatFuzzyDate, formatMoney } from "@/lib/format";
import { startupHref } from "@/lib/startup-cookie";
import type { CompetitorsAnalysis, DeckCheckResult, InvestorsAnalysis, Startup, StartupField } from "@/lib/types";
import { StartupGaps } from "./startup-gaps";
import { StartupProfile } from "./startup-profile";
import { CompetitorsCard, DeckCard, Figure, FigureGrid, InvestorsCard } from "./startup-overview";

function fuzzy(value: string | null | undefined) {
  if (!value) return "";
  return formatFuzzyDate({ date: value, precision: value.length === 4 ? "year" : value.length === 7 ? "month" : "day" });
}

/**
 * Overview for a startup the founder added. Funding figures come from Cala's record of the matched company (stored by
 * the Competitors analysis); founded, team and stage fall back to what the founder entered, marked as their entry.
 * The main column (About, and below it the Cala record) is passed in so the page keeps control of its Suspense.
 */
export async function AddedStartupOverview({
  startup: s,
  competitors,
  investors,
  deck,
  children,
}: {
  startup: Startup;
  competitors: CompetitorsAnalysis | null;
  investors: InvestorsAnalysis | null;
  deck: DeckCheckResult | null;
  children?: React.ReactNode;
}) {
  const you = competitors && !competitors.you.self_reported ? competitors.you : null;
  const last = you?.last_round ?? null;
  const notRun = !competitors && s.calaCompanyId ? "Run Competitors to load" : undefined;
  const own = (f: StartupField) => ({ value: s[f]?.trim() || null, sources: s.sources[f] ?? [] });

  // Founder's own value first (it is theirs to correct), else Cala's.
  const stage = own("stage").value ? own("stage") : you?.stage ? { value: you.stage.value, sources: you.stage.sources } : own("stage");
  const founded = own("founded").value ? { ...own("founded"), value: fuzzy(s.founded) } : you?.founded ? { value: fuzzy(you.founded.value), sources: you.founded.sources } : own("founded");
  const team = own("employees").value ? own("employees") : you?.employees ? { value: you.employees.value, sources: you.employees.sources } : own("employees");

  const slush = investors?.investors.length ? await slushAttendeeIndex().catch(() => null) : null;
  const atSlush = slush ? investors!.investors.filter((i) => slush.ids.has(i.id) || slush.names.has(normaliseName(i.name))).length : 0;

  return (
    <div className="space-y-6">
      <FigureGrid>
        <Figure label="Stage" sources={stage.sources} self={!!stage.value && !stage.sources.length}>
          {stage.value}
        </Figure>
        <Figure label="Equity raised" sources={you?.raised?.sources} hint={you?.raised ? undefined : notRun}>
          {you?.raised ? formatMoney(you.raised.value) : null}
        </Figure>
        <Figure label="Last round" sources={last?.sources} hint={last ? [last.stage, last.date ? fuzzy(last.date.slice(0, 7)) : "Undated"].join(" · ") : notRun}>
          {last ? formatMoney(last.amount) : null}
        </Figure>
        <Figure label="Lead investor" sources={last?.leads.length ? last.sources : undefined} hint={last ? undefined : notRun}>
          {last?.leads.length ? (
            <Link href={`/investor/${last.leads[0].id}`} className="hover:text-primary hover:underline">
              {last.leads[0].name}
            </Link>
          ) : null}
        </Figure>
        <Figure label="Founded" sources={founded.sources} self={!!founded.value && !founded.sources.length}>
          {founded.value}
        </Figure>
        <Figure label="Team" sources={team.sources} self={!!team.value && !team.sources.length}>
          {team.value}
        </Figure>
      </FigureGrid>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 min-w-0">
          <StartupProfile startup={s} variant="main" />
        </div>
        <div className="space-y-4">
          <CompetitorsCard data={competitors} href={startupHref(s.id, "competitors")} />
          <InvestorsCard data={investors} atSlush={atSlush} href={startupHref(s.id, "investors")} />
          <DeckCard deck={deck} href={startupHref(s.id, "deck")} />
          <StartupGaps
            key={s.id}
            startup={s}
            raisedOnRecord={competitors ? !!competitors.you.raised : null}
            calaStage={you?.stage?.value ?? null}
          />
        </div>
      </div>

      {children}
    </div>
  );
}
