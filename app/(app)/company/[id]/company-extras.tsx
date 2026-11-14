import { Boxes, Building, Globe2, Landmark, Leaf, Network, PiggyBank } from "lucide-react";
import Link from "next/link";
import { Pill } from "@/components/warmline/badges";
import { Panel } from "@/components/warmline/blocks";
import { FinancialsChart } from "@/components/warmline/financials-chart";
import { SourceChip } from "@/components/warmline/source-chip";
import type { CompanyExtras, Linked, Metric } from "@/lib/cala/company-extras";
import { formatFuzzyDate, formatMoney } from "@/lib/format";
import type { Source } from "@/lib/types";
import { cn } from "@/lib/utils";

// Panels for the extra Cala data on a company page. Each one renders nothing when Cala has no data for it,
// so a young startup's page stays short instead of filling up with "not on record".

/** Revenue and EBITDA chart plus the latest value of each metric, every figure linked to its filing. */
export function FinancialsPanel({ metrics }: { metrics: Metric[] }) {
  if (!metrics.length) return null;
  const revenue = metrics.find((m) => m.key === "revenue");
  const ebitda = metrics.find((m) => m.key === "ebitda");
  const currency = revenue?.unit ?? metrics[0].unit;
  const periods = [...new Set([...(revenue?.points ?? []), ...(ebitda?.points ?? [])].map((p) => p.period))].sort();
  const chart = periods.map((period) => ({
    period,
    revenue: revenue?.points.find((p) => p.period === period)?.value,
    ebitda: ebitda?.points.find((p) => p.period === period)?.value,
  }));
  const sources = dedupe(metrics.flatMap((m) => m.points.map((p) => p.source).filter((s): s is Source => !!s)));

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          Financials <Pill>From filings</Pill>
        </span>
      }
      description="Reported figures by fiscal year. Each value links to the filing it comes from."
      action={<SourceChip sources={sources} />}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {metrics.map((m) => {
          const last = m.points[m.points.length - 1];
          const prev = m.points[m.points.length - 2];
          const growth = prev && prev.value > 0 && m.key === "revenue" ? (last.value - prev.value) / prev.value : null;
          return (
            <div key={m.key} className="rounded-lg border bg-background/60 p-3">
              <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{m.label}</div>
              <div className="mt-1.5 text-lg font-semibold tracking-tight tabular">{signedMoney(last.value, m.unit)}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                {m.key === "netDebt" ? `at ${formatFuzzyDate({ date: last.period, precision: "day" })}` : `FY${last.period}`}
                {growth !== null && (
                  <span className={cn("font-medium", growth >= 0 ? "text-success" : "text-warning")}>
                    {growth >= 0 ? "+" : "−"}
                    {Math.abs(growth * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {chart.length > 1 && (
        <div className="mt-5">
          <FinancialsChart data={chart} currency={currency} />
        </div>
      )}
    </Panel>
  );
}

export function ProductsPanel({ products }: { products: Linked[] }) {
  if (!products.length) return null;
  return (
    <Panel title="Products">
      <ul className="space-y-2">
        {products.map((p) => (
          <li key={p.id} className="flex items-center gap-2.5">
            <Boxes className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium first-letter:uppercase">{p.name}</div>
              {p.since && <div className="text-xs text-muted-foreground">Since {year(p.since)}</div>}
            </div>
            <SourceChip sources={p.sources} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function CountriesPanel({ countries }: { countries: Linked[] }) {
  if (!countries.length) return null;
  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          Operates in <Pill>{countries.length} countries</Pill>
        </span>
      }
      description="Countries where it has a local entity on record."
      action={<SourceChip sources={dedupe(countries.flatMap((c) => c.sources))} />}
    >
      <div className="flex flex-wrap gap-1.5">
        {countries.map((c) => (
          <span key={c.id} className="inline-flex h-6 items-center gap-1 rounded-full border bg-background/60 px-2.5 text-xs">
            <Globe2 className="size-3 text-muted-foreground" />
            {c.name}
          </span>
        ))}
      </div>
    </Panel>
  );
}

export function GroupPanel({ parents, subsidiaries, more }: { parents: Linked[]; subsidiaries: Linked[]; more: boolean }) {
  if (!parents.length && !subsidiaries.length) return null;
  return (
    <Panel title="Group structure" description="Parent company and legal entities it owns, often from filings.">
      {parents.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Owned by</div>
          <LinkedList items={parents} icon={Building} />
        </div>
      )}
      {subsidiaries.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            Subsidiaries ({subsidiaries.length}
            {more ? "+" : ""})
          </div>
          <LinkedList items={subsidiaries} icon={Network} scroll />
        </div>
      )}
    </Panel>
  );
}

export function InvestmentsPanel({ investments, name }: { investments: Linked[]; name: string }) {
  if (!investments.length) return null;
  return (
    <Panel title="Its own investments" description={`Companies and funds ${name} has a sourced stake in.`}>
      <LinkedList items={investments} icon={PiggyBank} scroll />
    </Panel>
  );
}

export function RegistryPanel({ extras }: { extras: CompanyExtras }) {
  const { registry, aliases, esg } = extras;
  if (!registry.length && !aliases.length && !esg) return null;
  return (
    <Panel title="Registry and identifiers">
      <dl className="space-y-3">
        {registry.map((r) => (
          <div key={r.label}>
            <dt className="text-xs text-muted-foreground">{r.label}</dt>
            <dd className="mt-0.5 flex items-start justify-between gap-2 text-sm">
              <span className="min-w-0 break-words">{r.value}</span>
              <SourceChip sources={r.sources} />
            </dd>
          </div>
        ))}
        {aliases.length > 0 && (
          <div>
            <dt className="text-xs text-muted-foreground">Also known as</dt>
            <dd className="mt-0.5 text-sm">{aliases.slice(0, 6).join(", ")}</dd>
          </div>
        )}
      </dl>
      {esg && (
        <details className="group mt-4 border-t pt-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
            <Leaf className="size-4 text-muted-foreground" /> ESG policy
            <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">Show</span>
            <SourceChip sources={esg.sources} />
          </summary>
          <p className="mt-2 max-h-64 overflow-auto text-[13px] leading-relaxed whitespace-pre-line text-muted-foreground">{cleanMarkdown(esg.value)}</p>
        </details>
      )}
    </Panel>
  );
}

/** Header badges: "NASDAQ · UBER $71.33" and index memberships like S&P 500. */
export function ListingBadges({ extras }: { extras: CompanyExtras }) {
  if (!extras.listings.length && !extras.indices.length) return null;
  return (
    <>
      {extras.listings.map((l) => (
        <span key={l.exchange} className="inline-flex items-center gap-1">
          <Pill tone="teal">
            <Landmark className="size-3" />
            {l.exchange}
            {l.symbol ? ` · ${l.symbol}` : ""}
            {l.lastClose && l.currency ? ` ${formatPrice(l.lastClose.value, l.currency)}` : ""}
          </Pill>
          <SourceChip sources={l.sources} />
        </span>
      ))}
      {extras.indices.map((i) => (
        <Pill key={i.id}>{i.name}</Pill>
      ))}
    </>
  );
}

function LinkedList({ items, icon: Icon, scroll }: { items: Linked[]; icon: typeof Building; scroll?: boolean }) {
  return (
    <ul className={cn("space-y-2", scroll && "max-h-64 overflow-auto pr-1")}>
      {items.map((x) => (
        <li key={x.id} className="flex items-center gap-2.5">
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            {x.entityType === "Company" ? (
              <Link href={`/company/${x.id}`} className="block truncate text-sm font-medium hover:text-primary hover:underline">
                {x.name}
              </Link>
            ) : (
              <div className="truncate text-sm font-medium">{x.name}</div>
            )}
            {(x.since || x.until) && (
              <div className="text-xs text-muted-foreground">
                {x.since && `Since ${year(x.since)}`}
                {x.since && x.until && " · "}
                {x.until && `until ${year(x.until)}`}
              </div>
            )}
          </div>
          <SourceChip sources={x.sources} />
        </li>
      ))}
    </ul>
  );
}

function signedMoney(amount: number, currency: string) {
  const s = formatMoney({ amount: Math.abs(amount), currency });
  return amount < 0 ? `−${s}` : s;
}

function formatPrice(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

/** Relationship dates have no precision; a 1 January date is usually a year-only placeholder. */
function year(d: string) {
  return d.endsWith("-01-01") ? d.slice(0, 4) : formatFuzzyDate({ date: d, precision: "day" });
}

/** ESG text arrives as markdown; show it as plain paragraphs. */
function cleanMarkdown(s: string) {
  return s.replace(/^#+\s*/gm, "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/\n{3,}/g, "\n\n").trim();
}

function dedupe(list: Source[]) {
  return list.filter((s, i, a) => a.findIndex((x) => x.document === s.document && x.name === s.name) === i);
}
