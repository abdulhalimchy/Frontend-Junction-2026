import { Users } from "lucide-react";
import Link from "next/link";
import { getInvestors, getPeople } from "@/lib/cala";
import { formatFuzzyDate } from "@/lib/format";
import type { Company } from "@/lib/types";
import { TrustBadge } from "./badges";
import { EmptyState, EntityAvatar, FactGrid, Panel } from "./blocks";
import { FundingTimeline } from "./funding-timeline";
import { SourceChip } from "./source-chip";

/** Facts, funding and people for a company. Used by the company brief and My startup. */
export async function CompanyOverview({ company: c }: { company: Company }) {
  const [investors, people] = await Promise.all([getInvestors(), getPeople(c.peopleIds)]);

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-6">
        <Panel title="About">
          <p className="flex items-start gap-2 text-sm leading-relaxed">
            <span>{c.description.value}</span>
            <SourceChip sources={c.description.sources} className="mt-0.5" />
          </p>
          <div className="mt-5">
            <FactGrid
              columns={3}
              facts={[
                { label: "Founded", value: formatFuzzyDate(c.founded.value), sources: c.founded.sources },
                { label: "Headquarters", value: c.hq.value, sources: c.hq.sources },
                { label: "Employees", value: c.employees?.value ?? "Not on record", sources: c.employees?.sources },
                {
                  label: "Stage",
                  value: c.stage,
                  sources: c.rounds
                    .filter((r) => r.kind === "equity")
                    .sort((a, b) => a.date.date.localeCompare(b.date.date))
                    .at(-1)?.sources,
                },
                {
                  label: "Industry code",
                  value: c.industryCode.value,
                  sources: c.industryCode.sources,
                  note: "Registry code; coarse and sometimes wrong.",
                },
                { label: "Website", value: c.domain },
              ]}
            />
          </div>
        </Panel>
        <Panel title="Funding" description="Equity and grants are counted separately.">
          <FundingTimeline rounds={c.rounds} investors={investors} />
        </Panel>
      </div>
      <div className="space-y-6">
        <Panel title="People">
          {people.length ? (
            <ul className="space-y-3">
              {people.map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  <EntityAvatar name={p.name} kind="person" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.title}</div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <TrustBadge level={p.trust} />
                      <SourceChip sources={p.sources} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={Users} title="No people on record" />
          )}
        </Panel>
        <Panel title="Investors">
          {(() => {
            const ids = [...new Set(c.rounds.flatMap((r) => [...r.leadInvestorIds, ...r.participantIds]))];
            if (!ids.length) return <p className="text-sm text-muted-foreground">No investors on record.</p>;
            return (
              <ul className="space-y-2.5">
                {ids.map((id) => {
                  const inv = investors.find((i) => i.id === id);
                  return (
                    <li key={id}>
                      <Link href={`/investor/${id}`} className="flex items-center gap-2.5 text-sm hover:text-primary">
                        <EntityAvatar name={inv?.name ?? id} kind="investor" size="sm" />
                        {inv?.name ?? id}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            );
          })()}
        </Panel>
      </div>
    </div>
  );
}
