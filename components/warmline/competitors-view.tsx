"use client";

import { SearchedFor } from "./searched-for";
import { Building2, MapPin, TrendingUp } from "lucide-react";
import Link from "next/link";
import { formatFuzzyDate, formatMoney } from "@/lib/format";
import type { CompetitorsAnalysis, Source, StandingRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmptyState, EntityAvatar, Panel } from "./blocks";
import { SourceChip } from "./source-chip";

function fuzzy(value: string | null | undefined) {
  if (!value) return "";
  return formatFuzzyDate({ date: value, precision: value.length === 4 ? "year" : value.length === 7 ? "month" : "day" });
}

const none = (
  <span className="text-[13px] text-subtle" title="Not on record">
    —
  </span>
);

/** Competitors tab: where you stand, money raised compared, and each competitor. */
export function CompetitorsView({ data, startupName }: { data: CompetitorsAnalysis; startupName: string }) {
  if (data.mode === "none")
    return (
      <EmptyState
        icon={Building2}
        title="Nothing to search on yet"
        description="Add an industry or a description with Edit details, then run the search again."
      />
    );
  const peers = data.mode === "peers";
  const rows = [data.you, ...data.companies];

  return (
    <div className="space-y-6">
      <Panel
        title="Where you stand"
        description={
          peers
            ? `${startupName} next to ${data.companies.length} companies in your space. Check that each one really competes with you.`
            : `${startupName} next to the ${data.companies.length} companies on record as its competitors.`
        }
        bodyClassName="px-0 pb-2"
      >
        {peers && (
          <div className="px-5 pb-3">
            <SearchedFor searches={data.searches} leftOut={data.left_out} />
          </div>
        )}
        <StandingTable rows={rows} />
        <p className="px-5 pt-2 text-xs text-subtle">— not on record. Hover a raised amount to see what it is based on.</p>
        {data.unresolved > 0 && (
          <p className="px-5 pt-2 text-xs text-subtle">
            {data.unresolved} more {data.unresolved === 1 ? "company was" : "companies were"} named without a verified profile, so{" "}
            {data.unresolved === 1 ? "it is" : "they are"} not shown.
          </p>
        )}
      </Panel>

      <RaisedChart data={data} />

      <Panel title={peers ? "Companies in your space" : "Competitors"} description="What each one does, from its record.">
        <CompetitorList companies={data.companies} />
      </Panel>
    </div>
  );
}

function StandingTable({ rows }: { rows: StandingRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] text-sm">
        <thead>
          <tr className="border-y bg-muted/40 text-left text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            <th className="px-5 py-2 font-medium max-sm:sticky max-sm:left-0 max-sm:z-10 max-sm:bg-[color-mix(in_oklab,var(--muted)_40%,var(--card))]">Company</th>
            <th className="px-3 py-2 font-medium">Stage</th>
            <th className="px-3 py-2 font-medium">Raised</th>
            <th className="px-3 py-2 font-medium">Last round</th>
            <th className="px-3 py-2 font-medium">Lead investor</th>
            <th className="px-5 py-2 font-medium">Team</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id || "you"} className={cn("border-b last:border-0", r.you && "bg-brand-soft/50")}>
              {/* Pinned on phones, where the name may wrap so the other columns stay in view. */}
              <td
                className={cn(
                  "px-5 py-3 max-sm:max-w-40 max-sm:sticky max-sm:left-0 max-sm:z-10 max-sm:shadow-[6px_0_8px_-8px_rgb(0_0_0/0.45)]",
                  r.you ? "max-sm:bg-[color-mix(in_oklab,var(--brand-soft)_50%,var(--card))]" : "max-sm:bg-card",
                )}
              >
                <span className="flex items-center gap-2 sm:whitespace-nowrap">
                  {r.you && <span className="h-5 w-1 shrink-0 rounded-full bg-primary" />}
                  {r.id && !r.you ? (
                    <Link href={`/company/${r.id}`} className="font-medium hover:text-primary hover:underline">
                      {r.name}
                    </Link>
                  ) : (
                    <span className="font-medium">{r.name}</span>
                  )}
                  {r.you && <span className="text-xs font-medium text-primary">(You)</span>}
                </span>
              </td>
              <td className="px-3 py-3 text-[13px] whitespace-nowrap">
                {r.stage ? (
                  <span title={r.stage.sources.length ? `${r.stage.sources.length} source(s)` : r.self_reported ? "Your entry" : undefined}>{r.stage.value}</span>
                ) : (
                  none
                )}
              </td>
              <td className="px-3 py-3 whitespace-nowrap">
                {r.raised ? (
                  <span className="flex items-center gap-1.5 tabular" title={`Basis: ${r.raised.basis}`}>
                    {formatMoney(r.raised.value)} <SourceChip sources={r.raised.sources} />
                  </span>
                ) : (
                  none
                )}
              </td>
              <td className="px-3 py-3 whitespace-nowrap">
                {r.last_round ? (
                  <span className="text-[13px]">
                    {r.last_round.date ? fuzzy(r.last_round.date.slice(0, 7)) : "Undated"}
                    <span className="block text-xs text-muted-foreground">{r.last_round.stage}</span>
                  </span>
                ) : (
                  none
                )}
              </td>
              <td className="max-w-40 px-3 py-3 text-[13px]">
                {r.last_round?.leads.length ? (
                  <Link href={`/investor/${r.last_round.leads[0].id}`} className="hover:text-primary hover:underline">
                    {r.last_round.leads[0].name}
                  </Link>
                ) : (
                  none
                )}
              </td>
              <td className="px-5 py-3 whitespace-nowrap">{r.employees ? <Val v={r.employees.value} sources={r.employees.sources} self={r.self_reported} /> : none}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A value with its sources; the founder's own entries with no source say so. */
function Val({ v, sources, self }: { v: string; sources: Source[]; self: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-[13px]">
      {v}
      {sources.length ? <SourceChip sources={sources} /> : self ? <span className="text-[10px] text-subtle">your entry</span> : null}
    </span>
  );
}

function RaisedChart({ data }: { data: CompetitorsAnalysis }) {
  const rows = [data.you, ...data.companies];
  const cur = data.currency;
  const compared = rows.filter((r) => r.raised && r.raised.value.currency === cur).sort((a, b) => b.raised!.value.amount - a.raised!.value.amount);
  const other = rows.filter((r) => r.raised && r.raised.value.currency !== cur);
  const missing = rows.filter((r) => !r.raised);
  const max = compared[0]?.raised?.value.amount ?? 1;

  return (
    <Panel
      title="Total raised vs competitors"
      description={`Equity rounds on record, summed per company; where none are on record, the reported total. ${cur ? `Compared in ${cur} only.` : ""}`}
      action={
        data.rank ? (
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-accent-foreground">
            You rank {data.rank} of {data.compared}
          </span>
        ) : undefined
      }
    >
      {compared.length ? (
        <ul className="space-y-3">
          {compared.map((r) => (
            <li key={r.id || "you"} className={cn("rounded-lg", r.you && "-mx-2 bg-brand-soft/50 px-2 py-1.5")}>
              <div className="mb-1 flex items-center justify-between gap-3 text-[13px]">
                <span className={cn("truncate", r.you && "font-medium text-accent-foreground")}>
                  {r.name} {r.you && <span className="ml-1 rounded bg-card px-1 text-[10px] font-medium">You</span>}
                </span>
                <span className="flex items-center gap-1.5 font-medium tabular">
                  {formatMoney(r.raised!.value)} <SourceChip sources={r.raised!.sources} />
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", r.you ? "bg-primary" : "bg-[#cfcac1]")}
                  style={{ width: `${Math.max(2, (r.raised!.value.amount / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact icon={TrendingUp} title="No amounts on record to compare" />
      )}
      {(missing.length > 0 || other.length > 0) && (
        <p className="mt-4 text-xs text-subtle">
          {missing.length > 0 && <>Not on record: {missing.map((r) => (r.you ? `${r.name} (you)` : r.name)).join(", ")}. </>}
          {other.length > 0 && <>Not compared (other currency): {other.map((r) => `${r.name} ${formatMoney(r.raised!.value)}`).join(", ")}.</>}
        </p>
      )}
      {data.median_raised && (
        <p className="mt-4 flex items-start gap-2 border-t pt-3 text-[13px] text-muted-foreground">
          <TrendingUp className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <span>
            Median raised among these competitors: <span className="font-medium text-foreground">{formatMoney(data.median_raised)}</span>
            {data.you.raised ? null : <>. Yours is not on record, so you are not ranked.</>}
          </span>
        </p>
      )}
    </Panel>
  );
}

function CompetitorList({ companies }: { companies: StandingRow[] }) {
  if (!companies.length)
    return <EmptyState compact icon={Building2} title="No companies on record" description="No sourced companies are on record for this yet." />;
  return (
    <ul className="divide-y">
      {companies.map((c) => (
        <li key={c.id} className="flex gap-3 py-3.5 first:pt-1 last:pb-0">
          <EntityAvatar name={c.name} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div className="min-w-0">
                <Link href={`/company/${c.id}`} className="text-sm font-medium hover:text-primary hover:underline">
                  {c.name}
                </Link>
                {c.headquarters && (
                  <span className="ml-2 inline-flex max-w-full items-center gap-1 align-middle text-xs text-muted-foreground" title={c.headquarters.value}>
                    <MapPin className="size-3 shrink-0" />
                    <span className="max-w-64 truncate">{c.headquarters.value}</span>
                  </span>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {c.founded && (
                  <span className="flex items-center gap-1">
                    Founded {fuzzy(c.founded.value)} <SourceChip sources={c.founded.sources} />
                  </span>
                )}
                <span className="tabular">
                  {c.investors.length ? `${c.investors.length} investor${c.investors.length === 1 ? "" : "s"}` : "No investors on record"}
                </span>
              </div>
            </div>
            {c.description ? (
              <p className="mt-1 flex items-start gap-2 text-[13px] leading-snug text-muted-foreground">
                <span className="line-clamp-2">{c.description.value}</span>
                <SourceChip sources={c.description.sources} />
              </p>
            ) : (
              <p className="mt-1 text-[13px] text-subtle">No description on record</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
