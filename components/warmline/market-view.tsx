import { AlertCircle, Building2, CircleOff, Coins, KeyRound, Landmark, Loader2, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Pill } from "@/components/warmline/badges";
import { EmptyState, EntityAvatar, Panel, StatCard } from "@/components/warmline/blocks";
import { DataTable, type Row } from "@/components/warmline/data-table";
import { FundingChart } from "@/components/warmline/funding-chart";
import { SourceChip } from "@/components/warmline/source-chip";
import { calaErrorKind, mocksEnabled } from "@/lib/cala/client";
import { regionOf } from "@/lib/cala/market";
import { formatFuzzyDate, formatMoney, formatTotals, totalsByCurrency } from "@/lib/format";
import { lastEquityRound, summariseMarket, type MarketSummary } from "@/lib/market";
import type { MarketData } from "@/lib/types";

/** Stats, funding chart, companies and investors for a set of companies. Used for sector markets and competitor markets. */
export function MarketView({ data, title, note }: { data: MarketData; title: string; note?: React.ReactNode }) {
  const q = data.query;
  const s = summariseMarket(data);
  const region = regionOf(q.region).label;
  const cur = s.currency ?? "";

  return (
    <>
      <div className="mb-6 grid grid-cols-4 gap-4">
        <StatCard
          label="Companies analysed"
          value={s.companyCount}
          icon={Building2}
          hint={s.withoutFunding ? `${s.withoutFunding} with no funding on record` : "All have funding on record"}
        />
        <StatCard
          label="Equity raised"
          value={s.equityTotal ? formatMoney(s.equityTotal.value) : "None on record"}
          icon={Coins}
          sources={s.equityTotal?.sources}
          hint={s.currency ? `${cur} rounds only` : undefined}
        />
        <StatCard
          label="Grants"
          value={s.grantTotal ? formatMoney(s.grantTotal.value) : "None on record"}
          icon={Landmark}
          sources={s.grantTotal?.sources}
          hint="Kept separate from equity"
        />
        <StatCard
          label="Median seed round"
          value={s.medianSeed ? formatMoney(s.medianSeed.value) : "Not enough data"}
          icon={TrendingUp}
          sources={s.medianSeed?.sources}
          hint={s.seedCount ? `From ${s.seedCount} seed round${s.seedCount === 1 ? "" : "s"}` : "No seed rounds with an amount"}
        />
      </div>

      <div className="mb-6 grid grid-cols-3 gap-6">
        <Panel
          className="col-span-2"
          title="Funding by year"
          description={s.currency ? `Equity and grants as separate series, in ${cur} millions.` : "No rounds with an amount on record."}
          action={<SourceChip sources={s.yearSources} />}
        >
          {s.byYear.length ? <FundingChart data={s.byYear} currency={cur} /> : <EmptyState compact title="No dated rounds with an amount" />}
          <Exclusions s={s} />
        </Panel>
        <Panel title="Rounds per year" description={s.currency ? `${cur} rounds with an amount` : undefined}>
          <RoundsPerYear s={s} />
        </Panel>
      </div>

      <Panel className="mb-6" title={title} description="Sorted by equity raised. Click a company for its overview; each value opens its sources.">
        <CompaniesTable data={data} currency={s.currency} />
      </Panel>

      <Panel className="mb-6" title="Investors in this market" description="Investors with a sourced investment in at least one of these companies. Click one for its portfolio.">
        <InvestorsTable s={s} />
      </Panel>

      <p className="text-xs text-muted-foreground">
        How this market was defined: companies come from the structured query {" "}
        <code className="rounded bg-muted px-1">{data.definition}</code>. Every number above comes from sourced company and funding-round
        entities{mocksEnabled() ? " (mock data: USE_MOCKS=true)" : ""}.
        {note}
        {data.outsideRegion.length > 0 && (
          <>
            {" "}Left out because their headquarters on record are outside {region}:{" "}
            {data.outsideRegion.map((c) => `${c.name} (${c.country})`).join(", ")}.
          </>
        )}
      </p>
    </>
  );
}

function Exclusions({ s }: { s: MarketSummary }) {
  const parts = [
    s.excluded.otherCurrency && `${s.excluded.otherCurrency} in ${s.excluded.otherCurrencies.join(", ")} (not converted)`,
    s.excluded.undisclosed && `${s.excluded.undisclosed} with no amount on record`,
    s.excluded.undated && `${s.excluded.undated} with no date`,
    s.excluded.otherInstrument && `${s.excluded.otherInstrument} debt, unclassified filings or other instruments`,
  ].filter(Boolean);
  if (!parts.length) return null;
  return (
    <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
      <CircleOff className="mt-px size-3.5 shrink-0" />
      <span>Not in totals or chart: {parts.join(" · ")}.</span>
    </p>
  );
}

function RoundsPerYear({ s }: { s: MarketSummary }) {
  if (!s.byYear.length) return <p className="text-sm text-muted-foreground">No dated rounds on record.</p>;
  const max = Math.max(...s.byYear.map((y) => y.rounds), 1);
  return (
    <ul className="space-y-2.5">
      {s.byYear.map((y) => (
        <li key={y.year} className="flex items-center gap-3 text-sm">
          <span className="w-10 text-muted-foreground tabular">{y.year}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary/70" style={{ width: `${(y.rounds / max) * 100}%` }} />
          </div>
          <span className="w-6 text-right tabular">{y.rounds}</span>
        </li>
      ))}
    </ul>
  );
}

export function CompaniesTable({ data, currency }: { data: MarketData; currency: string | null }) {
  const rows: Row[] = data.companies.map((c) => {
    const last = lastEquityRound(c);
    const equity = totalsByCurrency(c.rounds, "equity");
    const grants = totalsByCurrency(c.rounds, "grant");
    return {
      id: c.id,
      href: `/company/${c.id}`,
      cells: {
        name: {
          display: (
            <div className="flex items-center gap-2.5">
              <EntityAvatar name={c.name} size="sm" />
              <div className="min-w-0">
                <div className="font-medium">{c.name}</div>
                <div className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
                  {c.founded ? `Founded ${formatFuzzyDate(c.founded.value)}` : "Founded: not on record"}
                  {c.founded && <SourceChip sources={c.founded.sources} />}
                </div>
              </div>
            </div>
          ),
          sort: c.name,
        },
        description: {
          display: c.description ? (
            <div className="flex items-start gap-2">
              <span className="line-clamp-2 text-[13px] text-muted-foreground">{c.description.value}</span>
              <SourceChip sources={c.description.sources} />
            </div>
          ) : (
            <span className="text-[13px] text-subtle">No description on record</span>
          ),
        },
        last: {
          display: last ? (
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-[13px] tabular">
                {last.stage} · {formatMoney(last.amount)}
              </span>
              <span className="text-xs text-muted-foreground">{last.date ? formatFuzzyDate(last.date) : "undated"}</span>
              <SourceChip sources={last.sources} />
            </div>
          ) : (
            <span className="text-[13px] text-muted-foreground">No funding on record</span>
          ),
          sort: last?.date?.date ?? null,
        },
        equity: {
          display: <span className="whitespace-nowrap text-[13px] tabular">{equity.length ? formatTotals(equity) : "—"}</span>,
          sort: equity.find((m) => m.currency === currency)?.amount ?? null,
        },
        grants: {
          display: <span className="whitespace-nowrap text-[13px] tabular">{grants.length ? formatTotals(grants) : "—"}</span>,
          sort: grants.find((m) => m.currency === currency)?.amount ?? null,
        },
      },
    };
  });

  return (
    <DataTable
      columns={[
        { key: "name", label: "Company", width: "24%" },
        { key: "description", label: "What they do", sortable: false, width: "34%" },
        { key: "last", label: "Last equity round" },
        { key: "equity", label: "Equity", align: "right" },
        { key: "grants", label: "Grants", align: "right" },
      ]}
      rows={rows}
      initialSort={{ key: "equity", dir: "desc" }}
    />
  );
}

function InvestorsTable({ s }: { s: MarketSummary }) {
  if (!s.investors.length) return <EmptyState compact title="No investors on record for these companies" />;
  const rows: Row[] = s.investors.slice(0, 15).map((i) => ({
    id: i.id,
    href: `/investor/${i.id}`,
    cells: {
      name: {
        display: (
          <div className="flex items-center gap-2.5">
            <EntityAvatar name={i.name} kind="investor" size="sm" />
            <div className="min-w-0">
              <div className="font-medium">{i.name}</div>
              {i.alsoKnownAs.length > 0 && (
                <div className="truncate text-xs text-muted-foreground" title={i.alsoKnownAs.join(", ")}>
                  Also recorded as {i.alsoKnownAs.join(", ")}
                </div>
              )}
            </div>
          </div>
        ),
        sort: i.name,
      },
      companies: { display: <span className="text-[13px] text-muted-foreground">{i.companies.join(", ")}</span> },
      count: {
        display: (
          <span className="inline-flex items-center gap-2">
            {i.companies.length > 1 && <Pill tone="teal">Repeat</Pill>}
            <span className="tabular">{i.companies.length}</span>
          </span>
        ),
        sort: i.companies.length,
      },
      sources: { display: <SourceChip sources={i.sources} /> },
    },
  }));
  return (
    <DataTable
      columns={[
        { key: "name", label: "Investor", width: "30%" },
        { key: "companies", label: "Backed in this market", sortable: false },
        { key: "count", label: "Companies", align: "right" },
        { key: "sources", label: "Sources", sortable: false },
      ]}
      rows={rows}
      initialSort={{ key: "count", dir: "desc" }}
    />
  );
}

export function MarketError({ error }: { error: unknown }) {
  const kind = calaErrorKind(error);
  const copy = {
    missing_key: {
      icon: KeyRound,
      title: "Data source key missing or rejected",
      description: "Data lookups run in the backend: set CALA_API_KEY in the backend's .env and restart it, or set USE_MOCKS=true here to use fixture data.",
    },
    rate_limited: { icon: AlertCircle, title: "Too many requests", description: "Wait a minute and reload. Results are cached once they load." },
    no_credit: {
      icon: KeyRound,
      title: "Data credit balance is empty",
      description: "Top up at console.cala.ai. Results already loaded stay available. New lookups are paused for 10 minutes after the empty balance is reported, then tried again.",
    },
    invalid_request: { icon: AlertCircle, title: "This search could not be run", description: "Try describing the market in different words." },
    upstream: { icon: AlertCircle, title: "Could not reach the data source", description: "It did not answer this time. Refresh to try again." },
  }[kind];
  return <EmptyState icon={copy.icon} title={copy.title} description={copy.description} />;
}

export function ResultsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" />
        Loading companies and funding rounds. The first load of a market can take up to a minute; repeat views are cached.
      </div>
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}
