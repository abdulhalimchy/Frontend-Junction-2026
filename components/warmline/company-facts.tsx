import { Globe, Info } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Pill } from "@/components/warmline/badges";
import { Skeleton } from "@/components/ui/skeleton";
import { SourceChip } from "@/components/warmline/source-chip";
import type { Listing } from "@/lib/cala/company-extras";
import { fetchRoundDetail } from "@/lib/cala/rounds";
import { fetchWebFacts, type WebGap } from "@/lib/cala/company-web";
import { formatFuzzyDate, formatMoney, formatTotals, shortPlace, totalsByCurrency } from "@/lib/format";
import type { CompanyProfile, FundingRound, Source } from "@/lib/types";

// Key facts for one company, shared by the company page and Company analysis so the two never disagree.
// Only facts Cala has are shown as tiles; what it lacks is named once, in a quiet line underneath,
// instead of a grid of "Not on record" boxes.

type TileData = { label: string; value: React.ReactNode; hint?: string; sources?: Source[] };

export async function CompanyKeyFacts({
  p,
  listing,
  withLead = true,
  webSearch = true,
}: {
  p: CompanyProfile;
  listing?: Listing;
  withLead?: boolean;
  /** Fill gaps from Cala's web search (streams in 30–60 s later). */
  webSearch?: boolean;
}) {
  const lastEquity = latestEquity(p.rounds);
  const lead = withLead && lastEquity ? await leadOf(lastEquity) : null;
  const equity = totalsByCurrency(p.rounds, "equity");
  const equityRounds = p.rounds.filter((r) => r.kind === "equity");
  const grants = totalsByCurrency(p.rounds, "grant");

  const tiles: TileData[] = [];
  const missing: string[] = [];
  const gaps: WebGap[] = [];
  const gap = (key: WebGap) => {
    missing.push(GAP_TEXT[key]);
    gaps.push(key);
  };

  // Stage: as recorded, else public listing, else the latest round on record (said so in the hint).
  if (p.fundingStage) tiles.push({ label: "Stage", value: p.fundingStage.value, sources: p.fundingStage.sources });
  else if (listing) tiles.push({ label: "Stage", value: "Public", hint: `Listed on ${listing.exchange}${listing.symbol ? ` as ${listing.symbol}` : ""}`, sources: listing.sources });
  else if (lastEquity) tiles.push({ label: "Stage", value: lastEquity.stage, hint: "From the latest round on record", sources: lastEquity.sources });
  else gap("stage");

  if (p.totalFunding) tiles.push({ label: "Total raised", value: formatMoney(p.totalFunding.value), hint: "As reported, all instruments", sources: p.totalFunding.sources });
  if (p.totalFundingExDebt) tiles.push({ label: "Raised excl. debt", value: formatMoney(p.totalFundingExDebt.value), hint: "Reported total minus loans", sources: p.totalFundingExDebt.sources });
  if (equity.length) {
    tiles.push({
      label: "Equity on record",
      value: formatTotals(equity),
      hint: `${equityRounds.length} round${equityRounds.length === 1 ? "" : "s"}${p.totalFunding ? " summed" : " · may be incomplete"}`,
      sources: dedupe(equityRounds.flatMap((r) => r.sources)),
    });
  }
  if (!p.totalFunding && !equity.length) missing.push("funding amounts");
  else if (!p.totalFunding) missing.push("a reported funding total");
  if (!p.totalFunding) gaps.push("totalFunding");

  // The newest round with an amount; an undisclosed newer round still sets the stage and the lead question.
  const disclosed = latestEquity(p.rounds.filter((r) => r.amount)) ?? lastEquity;
  if (disclosed) {
    tiles.push({
      label: disclosed === lastEquity ? "Last equity round" : "Last disclosed round",
      value: formatMoney(disclosed.amount),
      hint: `${disclosed.stage} · ${formatFuzzyDate(disclosed.date)}`,
      sources: disclosed.sources,
    });
  }

  if (lead) {
    tiles.push({
      label: "Lead investor",
      value: (
        <Link href={`/investor/${lead.id}`} className="hover:text-primary hover:underline">
          {lead.name}
        </Link>
      ),
      hint: `${lastEquity!.stage}${lead.coLeads ? ` · +${lead.coLeads} co-lead` : ""}`,
      sources: lead.sources,
    });
  } else if (withLead && lastEquity) gap("lead");

  if (p.employees) tiles.push({ label: "Team", value: p.employees.value, hint: "Employees", sources: p.employees.sources });
  else gap("employees");

  if (grants.length) {
    const g = p.rounds.filter((r) => r.kind === "grant");
    tiles.push({ label: "Grants", value: formatTotals(grants), hint: "Kept separate from equity", sources: dedupe(g.flatMap((r) => r.sources)) });
  }

  return (
    <div>
      {tiles.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {tiles.map((t) => (
            <Tile key={t.label} {...t} />
          ))}
        </div>
      )}
      {webSearch ? (
        <Suspense fallback={<MissingLine missing={missing} searching />}>
          <WebFacts
            p={p}
            gaps={gaps}
            missing={missing}
            leadRound={lastEquity ? `${lastEquity.stage} of ${formatFuzzyDate(lastEquity.date)}` : undefined}
          />
        </Suspense>
      ) : (
        <MissingLine missing={missing} />
      )}
    </div>
  );
}

const GAP_TEXT: Record<WebGap, string> = {
  stage: "funding stage",
  totalFunding: "a reported funding total",
  lead: "who led the last round",
  employees: "team size",
};

/** Web-sourced answers for what Cala's records lack, kept visibly apart from the record above. */
async function WebFacts({ p, gaps, missing, leadRound }: { p: CompanyProfile; gaps: WebGap[]; missing: string[]; leadRound?: string }) {
  let result;
  try {
    result = await fetchWebFacts({ name: p.name, place: p.hq ? shortPlace(p.hq.value) : p.countries[0], gaps, leadRound });
  } catch {
    return <MissingLine missing={missing} />;
  }
  // Still missing: what the record lacks and the web search did not answer (funding amounts has no web question).
  const answered = new Set(gaps.filter((g) => !result.unanswered.includes(g)).map((g) => GAP_TEXT[g]));
  const still = missing.filter((m) => !answered.has(m));
  return (
    <>
      {result.facts.length > 0 && (
        <div className="mt-4 rounded-xl border border-dashed bg-card/60 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Globe className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">From the web</span>
            <Pill>Not in the records</Pill>
            <span className="text-xs text-muted-foreground">Found by search; check the sources.</span>
          </div>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {result.facts.map((f) => (
              <div key={f.key} className={f.value.length > 90 ? "sm:col-span-2" : undefined}>
                <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{f.label}</dt>
                <dd className="mt-1 flex items-start justify-between gap-2 text-sm leading-relaxed">
                  <span>{f.value}</span>
                  <SourceChip sources={f.sources} className="mt-0.5" />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <MissingLine missing={still} />
    </>
  );
}

function MissingLine({ missing, searching }: { missing: string[]; searching?: boolean }) {
  if (!missing.length && !searching) return null;
  return (
    <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
      <Info className="size-3.5 shrink-0" />
      {missing.length > 0 && <>Not on record yet: {joinList(missing)}.</>}
      {searching && (
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
          Searching the web{missing.length ? " for these" : " for customers and business model"}…
        </span>
      )}
    </p>
  );
}

export function CompanyKeyFactsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="rounded-xl border bg-card p-4">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="mt-3 h-6 w-2/3" />
        </div>
      ))}
    </div>
  );
}

function Tile({ label, value, hint, sources }: TileData) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
        {sources && sources.length > 0 && <SourceChip sources={sources} />}
      </div>
      <div className="mt-3 truncate text-xl font-semibold tracking-tight tabular">{value}</div>
      {hint && <div className="mt-1 truncate text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** The newest dated equity round. */
export function latestEquity(rounds: FundingRound[]): FundingRound | undefined {
  return rounds
    .filter((r) => r.kind === "equity" && r.date)
    .sort((a, b) => (b.date?.date ?? "").localeCompare(a.date?.date ?? ""))[0];
}

async function leadOf(round: FundingRound) {
  const d = await fetchRoundDetail(round.id, round.stage).catch(() => null);
  const lead = d?.leads[0];
  return lead ? { id: lead.id, name: lead.name, sources: lead.sources, coLeads: d!.leads.length - 1 } : null;
}

function joinList(items: string[]) {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function dedupe(list: Source[]) {
  return list.filter((s, i, a) => a.findIndex((x) => x.document === s.document && x.name === s.name) === i);
}
