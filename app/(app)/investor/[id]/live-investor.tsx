import { ArrowLeft, Briefcase, CheckCircle2, CircleDashed, Globe, Layers, MapPin, Route, Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Pill, SlushTag } from "@/components/warmline/badges";
import { EmptyState, EntityAvatar, Panel } from "@/components/warmline/blocks";
import { DataTable, type Row } from "@/components/warmline/data-table";
import { MarketError } from "@/components/warmline/market-view";
import { SourceChip } from "@/components/warmline/source-chip";
import { WatchButton } from "@/components/warmline/watch-button";
import { DEALS_LIMIT, fetchInvestorDeals, fetchInvestorProfile, type InvestorProfile } from "@/lib/cala/investor";
import { SLUSH_EVENT_ID } from "@/lib/mocks/misc";
import { formatFuzzyDate, formatMoney, shortPlace } from "@/lib/format";
import type { Source } from "@/lib/types";
import { cn } from "@/lib/utils";

// Investor brief from Cala. The profile is one cached call; "Recent deals" needs one call per round, so it
// loads only when asked (?deals=1) and is capped at DEALS_LIMIT rounds, each cached for 7 days.

export async function LiveInvestor({ id, showDeals }: { id: string; showDeals: boolean }) {
  let p: InvestorProfile;
  try {
    p = await fetchInvestorProfile(id);
  } catch (e) {
    return <MarketError error={e} />;
  }
  const r = p.rounds;
  const leadShare = r.total ? Math.round((r.led / r.total) * 100) : 0;
  const plus = (capped: boolean) => (capped ? "+" : "");
  const slush = p.events.find((e) => e.id === SLUSH_EVENT_ID);
  const place = p.address ? shortPlace(p.address.value) : p.countries.join(", ");

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <Link href="/market" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" /> Market analysis
        </Link>
        <div className="flex items-center gap-2">
          <WatchButton entityType="investor" calaId={p.id} name={p.name} size="sm" />
          <Button variant="outline" size="sm" className="bg-card" asChild>
            <Link href={`/intros?${new URLSearchParams({ to: p.id, toName: p.name })}`}>
              <Route /> Warm intro
            </Link>
          </Button>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border bg-card p-6 shadow-panel">
        <div className="flex items-start gap-5">
          <EntityAvatar name={p.name} kind="investor" size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[26px] font-semibold tracking-tight">{p.name}</h1>
              {slush && (
                <Link href="/events/slush-2026/overview">
                  <SlushTag label="At Slush 2026" />
                </Link>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>Investor</span>
              {place && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" /> {place} {p.address && <SourceChip sources={p.address.sources} />}
                </span>
              )}
              {p.website && (
                <span className="inline-flex items-center gap-1">
                  <Globe className="size-3.5" /> {p.website.value} <SourceChip sources={p.website.sources} />
                </span>
              )}
            </div>
            {p.description ? (
              <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed">
                <span>{p.description.value}</span>
                <SourceChip sources={p.description.sources} className="mt-0.5" />
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No description on record.</p>
            )}
            {p.industries.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.industries.map((i) => (
                  <span key={i.name + i.label} className="inline-flex items-center gap-1">
                    <Pill>{i.label ?? i.name}</Pill>
                    <SourceChip sources={i.sources} />
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Rounds joined" sources={r.total ? r.sources : undefined} hint="Funding rounds on record">
          {r.total ? `${r.total}${plus(r.capped)}` : <Muted>None on record</Muted>}
        </Tile>
        <Tile label="Rounds led" sources={r.total ? r.sources : undefined} hint={r.total ? `${leadShare}% lead rate` : undefined}>
          {r.total ? r.led : <Muted>Not on record</Muted>}
        </Tile>
        <Tile label="Portfolio" hint="Companies with a sourced investment">
          {p.portfolio.length ? `${p.portfolio.length}${plus(p.portfolioCapped)}` : <Muted>None on record</Muted>}
        </Tile>
        <Tile label="Typical stage" sources={r.typicalStage ? r.sources : undefined} hint={r.typicalStage ? "Stages covering most of its rounds" : undefined}>
          {r.typicalStage ?? <Muted>Not on record</Muted>}
        </Tile>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Panel
            title="Recent deals"
            description={`Company, round, amount and date for up to ${DEALS_LIMIT} rounds, led rounds first. Click a company for its brief.`}
          >
            {!r.total ? (
              <EmptyState compact icon={Layers} title="No rounds on record" />
            ) : showDeals ? (
              <Suspense fallback={<Skeleton className="h-56 rounded-xl" />}>
                <Deals p={p} />
              </Suspense>
            ) : (
              <div className="flex items-center justify-between gap-4 rounded-xl border border-dashed p-4">
                <p className="text-sm text-muted-foreground">
                  Each round is a separate lookup, so deal details load on request. Cached for 7 days after.
                </p>
                <Button variant="outline" size="sm" className="shrink-0 bg-card" asChild>
                  <Link href={`/investor/${p.id}?deals=1`} scroll={false}>
                    Load deal details (up to {Math.min(DEALS_LIMIT, r.total)} lookups)
                  </Link>
                </Button>
              </div>
            )}
          </Panel>

          <Panel
            title="Portfolio"
            description={`Companies with a sourced investment.${p.portfolioCapped ? ` Showing the first ${p.portfolio.length}.` : ""} "Earliest source" is the first press, company or filing source mentioning it, not the round date.`}
          >
            <Portfolio p={p} />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Investor check" description="From the rounds on record.">
            <ul className="space-y-3">
              <Check
                ok={r.total > 0}
                label="Leads or follows?"
                value={r.total ? (leadShare >= 50 ? "Mostly leads" : "Mostly follows") : "Not on record"}
                detail={r.total ? `Led ${r.led} of ${r.total} rounds` : undefined}
                sources={r.total ? r.sources : undefined}
              />
              <Check
                ok={r.byStage.length > 0}
                label="Stage focus"
                value={r.typicalStage ?? "Not on record"}
                detail={r.byStage.length ? `${r.byStage.length} stage names across its rounds` : undefined}
              />
              <Check
                ok={!!slush}
                label="At Slush 2026?"
                value={slush ? `Yes${slush.role ? `, ${slush.role}` : ""}` : "Not on record"}
                sources={slush?.sources}
              />
            </ul>
          </Panel>

          <Panel title="Rounds by stage">
            {r.byStage.length ? (
              <ul className="space-y-2">
                {r.byStage.slice(0, 8).map((s) => (
                  <li key={s.stage} className="flex items-center gap-3 text-sm">
                    <span className="w-28 truncate text-muted-foreground">{s.stage}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary/70" style={{ width: `${(s.count / r.byStage[0].count) * 100}%` }} />
                    </div>
                    <span className="w-6 text-right tabular">{s.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No rounds on record.</p>
            )}
          </Panel>

          <Panel title="Team" description="People linked to this investor.">
            {p.team.length ? (
              <ul className="max-h-72 space-y-2.5 overflow-auto pr-1">
                {p.team.map((t) => (
                  <li key={`${t.id}-${t.role}`} className="flex items-center gap-2.5">
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

async function Deals({ p }: { p: InvestorProfile }) {
  let deals;
  try {
    deals = await fetchInvestorDeals(p);
  } catch (e) {
    return <MarketError error={e} />;
  }
  const rows: Row[] = deals.map((d) => ({
    id: d.round.id,
    href: d.issuer ? `/company/${d.issuer.id}` : undefined,
    cells: {
      company: {
        display: d.issuer ? (
          <div className="flex items-center gap-2.5">
            <EntityAvatar name={d.issuer.name} size="sm" />
            <span className="font-medium">{d.issuer.name}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">Company not on record</span>
        ),
        sort: d.issuer?.name ?? "",
      },
      round: { display: <span className="whitespace-nowrap text-[13px]">{d.round.stage}</span>, sort: d.round.stage },
      amount: {
        display: <span className="text-[13px] tabular">{d.round.amount ? formatMoney(d.round.amount) : "Not disclosed"}</span>,
        sort: d.round.amount?.amount ?? 0,
      },
      date: {
        display: <span className="whitespace-nowrap text-[13px] tabular">{d.round.date ? formatFuzzyDate(d.round.date) : "—"}</span>,
        sort: d.round.date?.date ?? "",
      },
      role: { display: d.led ? <Pill tone="brand">Lead</Pill> : <Pill>Participant</Pill>, sort: d.led ? 1 : 0 },
      sources: { display: <SourceChip sources={d.round.sources} className="whitespace-nowrap" /> },
    },
  }));
  return (
    <DataTable
      columns={[
        { key: "company", label: "Company", width: "26%" },
        { key: "round", label: "Round" },
        { key: "amount", label: "Amount" },
        { key: "date", label: "Date" },
        { key: "role", label: "Role" },
        { key: "sources", label: "Sources", sortable: false },
      ]}
      rows={rows}
      initialSort={{ key: "date", dir: "desc" }}
    />
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

function Tile({ label, children, hint, sources }: { label: string; children: React.ReactNode; hint?: string; sources?: Source[] }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
        {sources && sources.length > 0 && <SourceChip sources={sources} />}
      </div>
      <div className="mt-3 truncate text-xl font-semibold tracking-tight tabular">{children}</div>
      {hint && <div className="mt-1 truncate text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Check({ ok, label, value, detail, sources }: { ok: boolean; label: string; value: string; detail?: string; sources?: Source[] }) {
  const Icon = ok ? CheckCircle2 : CircleDashed;
  return (
    <li className="flex items-start gap-2.5">
      <Icon className={cn("mt-0.5 size-4 shrink-0", ok ? "text-primary" : "text-muted-foreground")} />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium">{value}</div>
        {detail && <div className="text-xs text-muted-foreground">{detail}</div>}
      </div>
      {sources && sources.length > 0 && <SourceChip sources={sources} />}
    </li>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-base font-normal text-muted-foreground italic">{children}</span>;
}

