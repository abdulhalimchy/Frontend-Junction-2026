import { Banknote, Building2, Globe, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { Pill } from "@/components/warmline/badges";
import { EmptyState, EntityAvatar } from "@/components/warmline/blocks";
import { DataTable, type Row } from "@/components/warmline/data-table";
import { SourceChip } from "@/components/warmline/source-chip";
import { FILING_LABEL } from "@/lib/cala/market";
import { formatFuzzyDate, formatMoney, shortPlace } from "@/lib/format";
import type { InvestorGroup } from "@/lib/names";
import type { CompanyProfile, FundingRound, Source } from "@/lib/types";

// Company profile pieces shared by the company report (/market/company) and the company page.

export function Header({ p }: { p: CompanyProfile }) {
  const facts: { icon: typeof MapPin; label: string; value: string; sources: Source[] }[] = [];
  if (p.hq) facts.push({ icon: MapPin, label: "Headquarters", value: shortPlace(p.hq.value) || p.hq.value, sources: p.hq.sources });
  if (p.founded) facts.push({ icon: Building2, label: "Founded", value: formatFuzzyDate(p.founded.value), sources: p.founded.sources });
  if (p.employees) facts.push({ icon: Users, label: "Employees", value: p.employees.value, sources: p.employees.sources });
  if (p.website) facts.push({ icon: Globe, label: "Website", value: p.website.value, sources: p.website.sources });

  return (
    <div className="mb-6 rounded-xl border bg-card p-6">
      <div className="flex items-start gap-4">
        <EntityAvatar name={p.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">{p.name}</h2>
            {p.status && (
              <span className="inline-flex items-center gap-1">
                <Pill tone={/active/i.test(p.status.value) ? "success" : "neutral"}>{p.status.value}</Pill>
                <SourceChip sources={p.status.sources} />
              </span>
            )}
            {p.fundingStage && (
              <span className="inline-flex items-center gap-1">
                <Pill tone="teal">{p.fundingStage.value}</Pill>
                <SourceChip sources={p.fundingStage.sources} />
              </span>
            )}
          </div>
          {p.legalName && p.legalName.value !== p.name && (
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              Legal name: {p.legalName.value} <SourceChip sources={p.legalName.sources} />
            </div>
          )}
          {p.description ? (
            <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed">
              <span>{p.description.value}</span>
              <SourceChip sources={p.description.sources} className="mt-0.5" />
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No description on record.</p>
          )}
          {p.industries.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Industry (coarse code):</span>
              {p.industries.map((i) => (
                <span key={i.name + i.label} className="inline-flex items-center gap-1">
                  <Pill>{i.label ? `${i.name} · ${i.label}` : i.name}</Pill>
                  <SourceChip sources={i.sources} />
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {facts.length > 0 && (
        <dl className="mt-5 grid grid-cols-4 gap-3 border-t pt-4">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <f.icon className="size-3.5" /> {f.label}
              </dt>
              <dd className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                <span className="truncate">{f.value}</span>
                <SourceChip sources={f.sources} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

const KIND_LABEL = { equity: "Equity", grant: "Grant", other: "Debt or other" } as const;

export function RoundsTable({ rounds }: { rounds: FundingRound[] }) {
  if (!rounds.length) {
    return <EmptyState compact icon={Banknote} title="No funding on record" description="Normal for bootstrapped and young companies." />;
  }
  const rows: Row[] = rounds.map((r) => ({
    id: r.id,
    cells: {
      date: { display: <span className="whitespace-nowrap text-[13px] tabular">{formatFuzzyDate(r.date)}</span>, sort: r.date?.date ?? null },
      round: { display: <span className="text-[13px] font-medium">{r.stage}</span>, sort: r.stage },
      kind: {
        display: (
          <Pill tone={r.kind === "equity" ? "teal" : r.kind === "grant" ? "success" : "neutral"}>
            {r.stage === FILING_LABEL ? "Filing, unclassified" : KIND_LABEL[r.kind]}
          </Pill>
        ),
        sort: r.kind,
      },
      amount: { display: <span className="whitespace-nowrap text-[13px] tabular">{formatMoney(r.amount)}</span>, sort: r.amount?.amount ?? null },
      sources: { display: <SourceChip sources={r.sources} /> },
    },
  }));
  return (
    <DataTable
      columns={[
        { key: "date", label: "Date" },
        { key: "round", label: "Round" },
        { key: "kind", label: "Type" },
        { key: "amount", label: "Amount", align: "right" },
        { key: "sources", label: "Sources", sortable: false },
      ]}
      rows={rows}
      initialSort={{ key: "date", dir: "desc" }}
    />
  );
}

export function InvestorList({ investors }: { investors: InvestorGroup[] }) {
  if (!investors.length) return <p className="text-sm text-muted-foreground">No investors on record.</p>;
  return (
    <ul className="max-h-80 space-y-2.5 overflow-auto">
      {investors.map((i) => (
        <li key={i.id} className="flex items-center gap-2.5">
          <EntityAvatar name={i.name} kind="investor" size="sm" />
          <span className="min-w-0 flex-1">
            <Link href={`/investor/${i.id}`} className="block truncate text-sm hover:text-primary hover:underline">
              {i.name}
            </Link>
            {i.alsoKnownAs.length > 0 && (
              <span className="block truncate text-xs text-muted-foreground" title={i.alsoKnownAs.join(", ")}>
                Also recorded as {i.alsoKnownAs.join(", ")}
              </span>
            )}
          </span>
          <SourceChip sources={i.sources} />
        </li>
      ))}
    </ul>
  );
}
