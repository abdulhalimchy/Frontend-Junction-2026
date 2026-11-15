"use client";

import { ArrowRight, Check, Info, Landmark, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatFuzzyDate } from "@/lib/format";
import type { InvestorMatch, InvestorsAnalysis } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Pill } from "./badges";
import { EmptyState, EntityAvatar, Panel } from "./blocks";
import { SearchedFor } from "./searched-for";
import { SourceChip } from "./source-chip";

const PAGE = 10;
const YEAR_MS = 365 * 24 * 3600 * 1000;

type FilterKey = "leads" | "active" | "stage" | "noConflict";

const FILTERS: { key: FilterKey; label: string; test: (i: InvestorMatch, stage: string | null) => boolean }[] = [
  { key: "leads", label: "Leads rounds", test: (i) => i.rounds_led > 0 },
  { key: "active", label: "Active in last 12 months", test: (i) => !!i.last_deal && Date.now() - new Date(pad(i.last_deal.date)).getTime() <= YEAR_MS },
  { key: "stage", label: "Invests at your stage", test: (i, stage) => !!stage && i.stages.some((s) => s.stage === stage) },
  { key: "noConflict", label: "No competitor conflict", test: (i) => i.conflict !== "competitor" },
];

function pad(d: string) {
  return d.length === 4 ? `${d}-01-01` : d.length === 7 ? `${d}-01` : d;
}

function lastDeal(i: InvestorMatch) {
  if (!i.last_deal) return null;
  const d = i.last_deal.date.slice(0, 7);
  return formatFuzzyDate({ date: d, precision: d.length === 4 ? "year" : "month" });
}

/** Find investors tab: investors in companies like yours, ranked by a transparent match score. */
export function InvestorsView({ data, startupName }: { data: InvestorsAnalysis; startupName: string }) {
  const [active, setActive] = useState<Set<FilterKey>>(new Set());
  const [all, setAll] = useState(false);
  const filtered = useMemo(
    () => data.investors.filter((i) => FILTERS.every((f) => !active.has(f.key) || f.test(i, data.your_stage))),
    [data, active],
  );

  if (data.mode === "none")
    return (
      <EmptyState
        icon={Landmark}
        title="Nothing to search on yet"
        description="Add an industry or a description with Edit details, then run the search again."
      />
    );

  const shown = all ? filtered : filtered.slice(0, PAGE);
  const peers = data.mode === "peers";
  const toggle = (k: FilterKey) =>
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Filters</span>
        {FILTERS.map((f) => {
          const on = active.has(f.key);
          const disabled = f.key === "stage" && !data.your_stage;
          return (
            <button
              key={f.key}
              type="button"
              disabled={disabled}
              title={disabled ? "Set your stage with Edit details to use this filter" : undefined}
              onClick={() => toggle(f.key)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors disabled:opacity-40",
                on ? "border-primary/40 bg-brand-soft font-medium text-accent-foreground" : "bg-card hover:bg-muted",
              )}
            >
              {on && <Check className="size-3.5" />}
              {f.label}
            </button>
          );
        })}
        <span className="ml-auto text-xs text-muted-foreground tabular">
          Matches: <span className="font-semibold text-foreground">{filtered.length}</span> of {data.investors.length}
        </span>
      </div>

      {data.existing.length > 0 && (
        <Panel title="Already backing you" description={`Investors on record in ${startupName}.`}>
          <ul className="flex flex-wrap gap-2">
            {data.existing.map((i) => (
              <li key={i.id}>
                <Link
                  href={`/investor/${i.id}`}
                  className="inline-flex items-center gap-2 rounded-full border bg-card py-1 pr-3 pl-1 text-[13px] hover:border-primary/40 hover:text-primary"
                >
                  <EntityAvatar name={i.name} kind="investor" size="sm" />
                  {i.name}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel
        title="Investors who fund companies like yours"
        description={
          peers
            ? `Investors in ${data.peers.length} companies like yours, ranked by match.`
            : `Investors in ${startupName}'s ${data.peers.length} competitors, ranked by match.`
        }
        action={
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <SlidersHorizontal className="size-3.5" /> Ranked by match
          </span>
        }
        bodyClassName="px-0 pb-3"
      >
        {peers && (
          <div className="px-5 pb-3">
            <SearchedFor searches={data.searches} leftOut={data.left_out} />
          </div>
        )}
        {shown.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-y bg-muted/40 text-left text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  <th className="px-5 py-2 font-medium">Investor</th>
                  <th className="px-3 py-2 font-medium">Why they fit</th>
                  <th className="px-3 py-2 font-medium">Match</th>
                  <th className="px-3 py-2 text-right font-medium">Rounds led</th>
                  <th className="px-3 py-2 font-medium">Last deal</th>
                  <th className="px-3 py-2 font-medium">Conflict</th>
                  <th className="px-5 py-2" />
                </tr>
              </thead>
              <tbody>
                {shown.map((i) => (
                  <InvestorRow key={i.id} i={i} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5">
            <EmptyState compact icon={Landmark} title="No investors match these filters" description="Turn a filter off to see more." />
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-3 text-xs text-muted-foreground">
          <span className="flex items-start gap-1.5">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            Match is scored from verified records: your space 35, stage 25, recent activity 20, leading rounds 10, location 10; −10 for backing a
            direct competitor. Click a score for its breakdown.
          </span>
          {filtered.length > PAGE && (
            <Button variant="outline" size="sm" onClick={() => setAll(!all)}>
              {all ? "Show top 10" : `View all ${filtered.length}`}
            </Button>
          )}
        </div>
      </Panel>
    </div>
  );
}

function InvestorRow({ i }: { i: InvestorMatch }) {
  const tone = i.match.score >= 60 ? "bg-primary" : i.match.score >= 40 ? "bg-primary/60" : "bg-subtle";
  return (
    <tr className="border-b align-top last:border-0">
      <td className="px-5 py-3">
        <div className="flex items-center gap-2.5">
          <EntityAvatar name={i.name} kind="investor" size="sm" />
          <div className="min-w-0">
            <Link href={`/investor/${i.id}`} className="block max-w-52 truncate font-medium hover:text-primary hover:underline" title={i.name}>
              {i.name}
            </Link>
            <span className="block max-w-52 truncate text-xs text-muted-foreground">
              {[i.country, i.entity_type === "Person" ? "Angel" : i.portfolio_size ? `${i.portfolio_size} portfolio cos.` : null]
                .filter(Boolean)
                .join(" · ") || "—"}
            </span>
          </div>
        </div>
      </td>
      <td className="min-w-56 px-3 py-3">
        <span className="flex items-start gap-1.5 text-[13px] leading-snug">
          <span>{i.why}</span>
          <SourceChip sources={i.sources} />
        </span>
      </td>
      <td className="px-3 py-3">
        <Popover>
          <PopoverTrigger className="group flex items-center gap-2" title="See how this score was reached">
            <span className="w-9 text-right text-sm font-semibold tabular group-hover:text-primary">{i.match.score}%</span>
            <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
              <span className={cn("block h-full rounded-full", tone)} style={{ width: `${i.match.score}%` }} />
            </span>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-0">
            <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
              {i.name}: {i.match.score}% match
            </div>
            <ul className="divide-y">
              {i.match.parts.map((p) => (
                <li key={p.label} className="flex items-start justify-between gap-3 px-3 py-2">
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium">{p.label}</span>
                    <span className="block text-xs text-muted-foreground">{p.detail}</span>
                  </span>
                  <span className={cn("shrink-0 text-[13px] font-semibold tabular", p.points < 0 && "text-destructive")}>
                    {p.points > 0 ? "+" : ""}
                    {p.points}
                    {p.max > 0 && <span className="font-normal text-subtle">/{p.max}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      </td>
      <td className="px-3 py-3 text-right text-[13px] tabular">{i.rounds_led || <span className="text-subtle">0</span>}</td>
      <td className="px-3 py-3 text-[13px] whitespace-nowrap">
        {lastDeal(i) ?? <span className="text-subtle">Not on record</span>}
        {i.last_deal?.basis === "reported" && <span className="block text-[10px] text-subtle">date reported</span>}
      </td>
      <td className="px-3 py-3">
        {i.conflict === "competitor" ? (
          <Pill tone="warning" className="max-w-40">
            <span className="truncate" title={i.backs.join(", ")}>
              Backs {i.backs[0]}
              {i.backs.length > 1 ? ` +${i.backs.length - 1}` : ""}
            </span>
          </Pill>
        ) : i.conflict === "space" ? (
          <Pill className="max-w-40">
            <span className="truncate" title={i.backs.join(", ")}>
              Backs a similar co.
            </span>
          </Pill>
        ) : (
          <Pill tone="success">None</Pill>
        )}
      </td>
      <td className="px-5 py-3 text-right">
        <Link href={`/investor/${i.id}`} className="inline-flex items-center gap-1 text-[13px] font-medium whitespace-nowrap text-primary hover:underline">
          View brief <ArrowRight className="size-3.5" />
        </Link>
      </td>
    </tr>
  );
}
