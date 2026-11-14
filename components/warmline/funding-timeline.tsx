import { Banknote, Landmark } from "lucide-react";
import Link from "next/link";
import { formatFuzzyDate, formatMoney, formatTotals, totalsByCurrency } from "@/lib/format";
import type { FundingRound, Investor } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmptyState } from "./blocks";
import { SourceChip } from "./source-chip";

/** Vertical funding timeline. Equity and grants are visually and numerically separate. */
export function FundingTimeline({ rounds, investors }: { rounds: FundingRound[]; investors: Investor[] }) {
  if (!rounds.length) {
    return (
      <EmptyState
        compact
        icon={Banknote}
        title="No funding on record"
        description="Common for young companies. We only show rounds Cala has a source for."
      />
    );
  }
  const name = (id: string) => investors.find((i) => i.id === id);
  const sorted = [...rounds].sort((a, b) => (b.date?.date ?? "").localeCompare(a.date?.date ?? ""));
  const equity = totalsByCurrency(rounds, "equity");
  const grants = totalsByCurrency(rounds, "grant");

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-teal-soft/60 px-3 py-2">
          <div className="text-xs text-muted-foreground">Equity raised</div>
          <div className="text-sm font-semibold tabular">{formatTotals(equity)}</div>
        </div>
        <div className="rounded-lg bg-muted px-3 py-2">
          <div className="text-xs text-muted-foreground">Grants (not equity)</div>
          <div className="text-sm font-semibold tabular">{formatTotals(grants)}</div>
        </div>
      </div>
      <ol className="relative ml-2 border-l">
        {sorted.map((r) => {
          const isGrant = r.kind === "grant";
          const Icon = isGrant ? Landmark : Banknote;
          return (
            <li key={r.id} className="relative pb-5 pl-6 last:pb-0">
              <span
                className={cn(
                  "absolute -left-[11px] top-0.5 flex size-[22px] items-center justify-center rounded-full border-2 border-card",
                  isGrant ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground",
                )}
              >
                <Icon className="size-3" />
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{r.stage}</span>
                <span className="text-sm tabular">{formatMoney(r.amount)}</span>
                <span className="text-xs text-muted-foreground">{formatFuzzyDate(r.date)}</span>
                <SourceChip sources={r.sources} />
              </div>
              <div className="mt-1 text-[13px] text-muted-foreground">
                {isGrant ? (
                  <>Grant from {r.grantor}</>
                ) : r.leadInvestorIds.length || r.participantIds.length ? (
                  <>
                    {r.leadInvestorIds.map((id) => (
                      <InvestorLink key={id} id={id} name={name(id)?.name} lead />
                    ))}
                    {r.participantIds.map((id) => (
                      <InvestorLink key={id} id={id} name={name(id)?.name} />
                    ))}
                  </>
                ) : (
                  <>Investors not on record</>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function InvestorLink({ id, name, lead }: { id: string; name?: string; lead?: boolean }) {
  return (
    <span className="mr-3 inline-flex items-center gap-1">
      <Link href={`/investor/${id}`} className="text-foreground hover:text-primary hover:underline">
        {name ?? id}
      </Link>
      {lead && <span className="text-[11px] text-subtle">lead</span>}
    </span>
  );
}
