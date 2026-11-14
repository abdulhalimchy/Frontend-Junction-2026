import Link from "next/link";
import { formatFuzzyDate, formatMoney, totalsByCurrency } from "@/lib/format";
import type { Company, Investor, InvestorCheck } from "@/lib/types";
import { Pill, SlushTag } from "./badges";
import { EmptyState, EntityAvatar } from "./blocks";
import { DataTable, type Column, type Row } from "./data-table";
import { SourceChip } from "./source-chip";

function lastEquity(c: Company) {
  return [...c.rounds].filter((r) => r.kind === "equity").sort((a, b) => b.date.date.localeCompare(a.date.date))[0];
}

export function CompanyName({ c, sub }: { c: Company; sub?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <EntityAvatar name={c.name} size="sm" />
      <div className="min-w-0">
        <Link href={`/company/${c.id}`} className="font-medium hover:text-primary">
          {c.name}
        </Link>
        <div className="truncate text-xs text-muted-foreground">{sub ?? c.hq.value}</div>
      </div>
    </div>
  );
}

/** Company table. Equity and grants are separate columns; currencies are shown as recorded, never converted. */
export function CompanyTable({
  companies,
  reasons,
  showSlush = true,
  extra,
}: {
  companies: Company[];
  reasons?: Record<string, React.ReactNode>;
  showSlush?: boolean;
  extra?: { key: string; label: string; cells: Record<string, React.ReactNode> };
}) {
  const columns: Column[] = [
    { key: "name", label: "Company", width: "30%" },
    ...(reasons ? [{ key: "reason", label: "Why it matches", sortable: false }] : [{ key: "description", label: "What they do", sortable: false }]),
    { key: "last", label: "Last equity round" },
    { key: "grants", label: "Grants", align: "right" as const },
    ...(extra ? [{ key: extra.key, label: extra.label, sortable: false }] : []),
  ];
  const rows: Row[] = companies.map((c) => {
    const last = lastEquity(c);
    const grants = totalsByCurrency(c.rounds, "grant");
    return {
      id: c.id,
      href: `/company/${c.id}`,
      cells: {
        name: {
          display: (
            <div className="flex items-center gap-2">
              <CompanyName c={c} />
              {showSlush && c.attendsSlush && <SlushTag label="Slush" />}
            </div>
          ),
          sort: c.name,
        },
        reason: { display: <span className="text-[13px] text-muted-foreground">{reasons?.[c.id]}</span> },
        description: {
          display: (
            <div className="flex items-start gap-2">
              <span className="line-clamp-2 text-[13px] text-muted-foreground">{c.description.value}</span>
              <SourceChip sources={c.description.sources} />
            </div>
          ),
        },
        last: {
          display: last ? (
            <div className="flex items-center gap-2">
              <span className="tabular">
                {last.stage} · {formatMoney(last.amount)}
              </span>
              <span className="text-xs text-muted-foreground">{formatFuzzyDate(last.date)}</span>
              <SourceChip sources={last.sources} />
            </div>
          ) : (
            <span className="text-[13px] text-muted-foreground">No funding on record</span>
          ),
          sort: last?.date.date ?? null,
        },
        grants: {
          display: grants.length ? <span className="tabular">{grants.map(formatMoney).join(" + ")}</span> : <span className="text-subtle">—</span>,
          sort: grants[0]?.amount ?? null,
        },
        ...(extra ? { [extra.key]: { display: extra.cells[c.id] } } : {}),
      },
    };
  });
  return (
    <DataTable
      columns={columns}
      rows={rows}
      empty={<EmptyState compact title="No companies on record" description="Try a broader description." />}
    />
  );
}

export function InvestorTable({
  rows: list,
  competitorNames,
}: {
  rows: { investor: Investor; check: InvestorCheck; backsCompetitors?: string[] }[];
  competitorNames?: Record<string, string>;
}) {
  const columns: Column[] = [
    { key: "name", label: "Investor", width: "26%" },
    { key: "focus", label: "Focus", sortable: false },
    { key: "active", label: "Still active" },
    { key: "style", label: "Leads or follows" },
    ...(competitorNames ? [{ key: "competitor", label: "Backs a competitor" }] : []),
  ];
  const rows: Row[] = list.map(({ investor: i, check, backsCompetitors }) => {
    const { leads, follows } = check.leadsOrFollows.value;
    const a = check.stillActive.value;
    return {
      id: i.id,
      href: `/investor/${i.id}`,
      cells: {
        name: {
          display: (
            <div className="flex items-center gap-2.5">
              <EntityAvatar name={i.name} kind="investor" size="sm" />
              <div>
                <div className="flex items-center gap-2 font-medium">
                  {i.name}
                  {i.attendsSlush && <SlushTag label="Slush" />}
                </div>
                <div className="text-xs text-muted-foreground">
                  {i.kind} · {i.hq.value}
                </div>
              </div>
            </div>
          ),
          sort: i.name,
        },
        focus: { display: <span className="text-[13px] text-muted-foreground">{i.focus.value.join(", ")}</span> },
        active: {
          display: (
            <div className="flex items-center gap-2">
              {a.active ? <Pill tone="success">Active</Pill> : <Pill tone="warning">Quiet</Pill>}
              <span className="text-xs whitespace-nowrap text-muted-foreground">{a.lastInvestment ? `Last ${formatFuzzyDate(a.lastInvestment)}` : "No deals on record"}</span>
              <SourceChip sources={check.stillActive.sources} />
            </div>
          ),
          sort: a.lastInvestment?.date ?? null,
        },
        style: {
          display: (
            <div className="flex items-center gap-2">
              <span className="text-[13px]">{leads >= follows ? "Mostly leads" : "Mostly follows"}</span>
              <span className="text-xs text-muted-foreground tabular">
                {leads} lead · {follows} follow
              </span>
              <SourceChip sources={check.leadsOrFollows.sources} />
            </div>
          ),
          sort: leads / Math.max(1, leads + follows),
        },
        competitor: {
          display: backsCompetitors?.length ? (
            <div className="flex items-center gap-2">
              <Pill tone="warning">{backsCompetitors.map((id) => competitorNames?.[id] ?? id).join(", ")}</Pill>
              <SourceChip sources={check.backsCompetitor.sources} />
            </div>
          ) : (
            <span className="text-[13px] text-muted-foreground">None on record</span>
          ),
          sort: backsCompetitors?.length ?? 0,
        },
      },
    };
  });
  return <DataTable columns={columns} rows={rows} />;
}
