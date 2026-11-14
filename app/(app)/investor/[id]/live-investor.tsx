import { ArrowLeft, Briefcase, Building2, Crown, Globe, MapPin, Newspaper, Users } from "lucide-react";
import Link from "next/link";
import { Pill } from "@/components/warmline/badges";
import { EmptyState, EntityAvatar, Panel, StatCard } from "@/components/warmline/blocks";
import { DataTable, type Row } from "@/components/warmline/data-table";
import { MarketError } from "@/components/warmline/market-view";
import { SourceChip } from "@/components/warmline/source-chip";
import { fetchInvestorProfile, type InvestorProfile } from "@/lib/cala/investor";
import { formatFuzzyDate } from "@/lib/format";

/** Investor overview from Cala: profile, portfolio, round participation and team. One cached Cala call. */
export async function LiveInvestor({ id }: { id: string }) {
  let p: InvestorProfile;
  try {
    p = await fetchInvestorProfile(id);
  } catch (e) {
    return <MarketError error={e} />;
  }
  const leadShare = p.rounds.total ? Math.round((p.rounds.led / p.rounds.total) * 100) : 0;
  const plus = (capped: boolean) => (capped ? "+" : "");

  return (
    <>
      <Link href="/market" className="mb-4 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3" /> Market analysis
      </Link>

      <div className="mb-6 rounded-xl border bg-card p-6">
        <div className="flex items-start gap-4">
          <EntityAvatar name={p.name} kind="investor" size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{p.name}</h1>
              <Pill>Investor</Pill>
              {p.industries.map((i) => (
                <span key={i.name + i.label} className="inline-flex items-center gap-1">
                  <Pill>{i.label ?? i.name}</Pill>
                  <SourceChip sources={i.sources} />
                </span>
              ))}
            </div>
            {p.description ? (
              <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed">
                <span>{p.description.value}</span>
                <SourceChip sources={p.description.sources} className="mt-0.5" />
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No description on record.</p>
            )}
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {p.website && (
                <span className="inline-flex items-center gap-1.5">
                  <Globe className="size-3.5 text-muted-foreground" /> {p.website.value} <SourceChip sources={p.website.sources} />
                </span>
              )}
              {p.address && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-muted-foreground" /> {p.address.value} <SourceChip sources={p.address.sources} />
                </span>
              )}
              {!p.address && p.countries.length > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-muted-foreground" /> {p.countries.join(", ")}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-4">
        <StatCard label="Portfolio companies" value={`${p.portfolio.length}${plus(p.portfolioCapped)}`} icon={Briefcase} hint="With a sourced investment" />
        <StatCard
          label="Rounds on record"
          value={`${p.rounds.total}${plus(p.rounds.capped)}`}
          icon={Building2}
          sources={p.rounds.total ? p.rounds.sources : undefined}
          hint="Rounds it invested in"
        />
        <StatCard
          label="Leads or follows"
          value={p.rounds.total ? (leadShare >= 50 ? "Mostly leads" : "Mostly follows") : "Not on record"}
          icon={Crown}
          hint={p.rounds.total ? `${leadShare}% of rounds on record led` : undefined}
        />
        <StatCard
          label="Rounds led"
          value={p.rounds.total ? `${p.rounds.led}` : "Not on record"}
          icon={Newspaper}
          sources={p.rounds.total ? p.rounds.sources : undefined}
          hint={p.rounds.total ? `of ${p.rounds.total} rounds it joined` : undefined}
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <Panel
          className="col-span-2"
          title="Portfolio"
          description={`Companies with a sourced investment.${p.portfolioCapped ? ` Showing the first ${p.portfolio.length}.` : ""} "Earliest source" is the first press, company or filing source that mentions the investment, not the round date; "—" when only databases list it. Click a company for its overview.`}
        >
          <Portfolio p={p} />
        </Panel>
        <div className="space-y-6">
          <Panel title="Rounds by stage" description="Rounds this investor joined, by stage name.">
            {p.rounds.byStage.length ? (
              <ul className="space-y-2">
                {p.rounds.byStage.slice(0, 8).map((s) => (
                  <li key={s.stage} className="flex items-center gap-3 text-sm">
                    <span className="w-28 truncate text-muted-foreground">{s.stage}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary/70" style={{ width: `${(s.count / p.rounds.byStage[0].count) * 100}%` }} />
                    </div>
                    <span className="w-6 text-right tabular">{s.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No rounds on record.</p>
            )}
          </Panel>
          <Panel title="Team" description="People Cala links to this investor.">
            {p.team.length ? (
              <ul className="max-h-72 space-y-2.5 overflow-auto pr-1">
                {p.team.map((t) => (
                  <li key={`${t.id}-${t.role}`} className="flex items-start gap-2.5">
                    <EntityAvatar name={t.name} kind="person" size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{t.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{t.role}</div>
                    </div>
                    <SourceChip sources={t.sources} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={Users} title="No team on record" />
            )}
          </Panel>
          {p.backers.length > 0 && (
            <Panel title="Its own investors" description="Investors in this firm or fund, when on record.">
              <ul className="space-y-2">
                {p.backers.map((b) => (
                  <li key={b.id} className="flex items-center gap-2 text-sm">
                    <Link href={`/investor/${b.id}`} className="flex-1 truncate hover:text-primary hover:underline">
                      {b.name}
                    </Link>
                    <SourceChip sources={b.sources} />
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

function Portfolio({ p }: { p: InvestorProfile }) {
  if (!p.portfolio.length) return <EmptyState compact icon={Briefcase} title="No portfolio companies on record" />;
  const rows: Row[] = p.portfolio.map((c) => ({
    id: c.id,
    href: `/company/${c.id}`,
    cells: {
      name: {
        display: (
          <div className="flex items-center gap-2.5">
            <EntityAvatar name={c.name} size="sm" />
            <span className="font-medium">{c.name}</span>
          </div>
        ),
        sort: c.name,
      },
      latest: {
        display: (
          <span className="whitespace-nowrap text-[13px] tabular">
            {c.firstReported ? formatFuzzyDate({ date: c.firstReported, precision: "day" }) : "—"}
          </span>
        ),
        sort: c.firstReported,
      },
      sources: { display: <SourceChip sources={c.sources} /> },
    },
  }));
  return (
    <DataTable
      columns={[
        { key: "name", label: "Company", width: "55%" },
        { key: "latest", label: "Earliest source" },
        { key: "sources", label: "Sources", sortable: false },
      ]}
      rows={rows}
      initialSort={{ key: "latest", dir: "desc" }}
    />
  );
}
