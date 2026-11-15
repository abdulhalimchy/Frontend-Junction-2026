"use client";

import { ArrowUpRight, ChevronRight, Loader2, RefreshCw, Search, Swords, Ticket, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatDay, formatFuzzyDate, formatMoney } from "@/lib/format";
import { type AnalysisIndex, plainError } from "@/lib/portfolio-insights";
import type {
  Alert,
  AnalysisRound,
  CompetitorsAnalysis,
  InvestorMatch,
  InvestorsAnalysis,
  PortfolioAnalysis,
  PortfolioAnalysisKind,
  PortfolioCompany,
  PortfolioRounds,
  StandingRow,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { Pill, SlushTag } from "./badges";
import { EmptyState, EntityAvatar, Panel } from "./blocks";
import { SourceChip } from "./source-chip";
import { api } from "./startup-dialogs";

// Insights for an investor's portfolio, from the backend's stored Cala analyses:
//   rounds      → "Since you invested" (in the companies table)
//   competitors → competitor monitoring
//   investors   → who could lead the next round, narrowed to Slush attendees

const hasData = (a?: PortfolioAnalysis) => !!a && Object.keys(a.data).length > 0;
const RECENT_DAYS = 180;
const POLL_EVERY_MS = 4000;
const POLL_FOR_MS = 10 * 60 * 1000;

type AnalysesStatus = { loading: number; enriching: number; version: string | null };

/** A plain reason for a failed analysis. The backend's message names the data provider, so it is not shown. */
function failure(error: string) {
  if (/rate limit/i.test(error)) return "Too many lookups at once. Try again in a minute.";
  if (/credit/i.test(error)) return "The data source is out of credit. Try again later.";
  return "Try again in a moment.";
}

function fuzzy(text: string) {
  return formatFuzzyDate({ date: text, precision: text.length === 4 ? "year" : text.length === 7 ? "month" : "day" });
}

function isRecent(date: string | null, days = RECENT_DAYS) {
  if (!date) return false;
  return Date.now() - new Date(date.length === 4 ? `${date}-01-01` : date.length === 7 ? `${date}-01` : date).getTime() < days * 864e5;
}

function roundLabel(r: AnalysisRound) {
  return [r.stage, r.amount && formatMoney(r.amount)].filter(Boolean).join(" · ");
}

/** Start analyses in the background, then let the page poll. */
async function refresh(body: { companyId?: string; kinds: PortfolioAnalysisKind[] }) {
  return api<PortfolioAnalysis[]>("/api/portfolio/analyses/refresh", { method: "POST", body: JSON.stringify(body) });
}

function useRefresh() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  async function run(key: string, body: { companyId?: string; kinds: PortfolioAnalysisKind[] }, what: string) {
    setBusy(key);
    try {
      const started = await refresh(body);
      if (started.length) toast.success(`${what} started. Results appear here as they come in.`);
      else toast.info("Already running, or nothing to look up.");
      router.refresh();
    } catch (err) {
      toast.error(plainError(err, "Could not start it."));
    } finally {
      setBusy(null);
    }
  }
  return { busy, run };
}

/** Keeps the page fresh while analyses or lookups run in the background. */
export function InsightsPoller({ active, version }: { active: boolean; version: string | null }) {
  const router = useRouter();
  const seen = useRef(version);
  useEffect(() => {
    seen.current = version;
  }, [version]);
  useEffect(() => {
    if (!active) return;
    // Poll the small status endpoint, and reload the page's data (a full render, with its Cala calls)
    // only when something finished. Give up after a while rather than poll forever.
    const until = Date.now() + POLL_FOR_MS;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const s = await api<AnalysesStatus>("/api/portfolio/analyses/status");
        if (stop) return;
        if (s.version !== seen.current || (!s.loading && !s.enriching)) {
          seen.current = s.version;
          router.refresh();
        }
      } catch {
        /* a failed poll is retried on the next tick */
      }
      if (!stop && Date.now() < until) timer = setTimeout(tick, POLL_EVERY_MS);
    };
    timer = setTimeout(tick, POLL_EVERY_MS);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [active, router]);
  return null;
}

// -- 2. since you invested ---------------------------------------------------------

/** The companies-table cell: rounds after the investor's entry date (or the latest round when no date). */
export function SinceInvested({ company, analysis }: { company: PortfolioCompany; analysis?: PortfolioAnalysis }) {
  if (!company.calaCompanyId) return <span className="text-xs text-subtle" title="No verified record, so no funding history">—</span>;
  if (!hasData(analysis)) {
    if (analysis?.status === "failed") return <span className="text-xs text-destructive" title={failure(analysis.error)}>Lookup failed</span>;
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Checking records
      </span>
    );
  }
  const data = analysis!.data as unknown as PortfolioRounds;
  const rounds = (data.rounds ?? []).filter((r) => r.kind === "equity" && r.date);
  const entry = company.investedOn;

  if (!entry) {
    const last = rounds[0];
    return last ? (
      <span className="inline-flex flex-wrap items-center gap-1.5 text-[13px]">
        <span className="text-xs text-muted-foreground">Latest</span> {roundLabel(last)}
        <span className="text-xs text-muted-foreground">{fuzzy(last.date!)}</span>
        <SourceChip sources={last.sources} />
      </span>
    ) : (
      <span className="text-xs text-muted-foreground">No equity round on record</span>
    );
  }

  const after = rounds.filter((r) => r.date!.slice(0, entry.length) > entry);
  if (!after.length)
    return (
      <span className="text-xs text-muted-foreground" title={rounds[0] ? `Last round on record: ${roundLabel(rounds[0])}, ${fuzzy(rounds[0].date!)}` : undefined}>
        No new round since {fuzzy(entry)}
      </span>
    );
  const byCurrency = new Map<string, number>();
  for (const r of after) if (r.amount) byCurrency.set(r.amount.currency, (byCurrency.get(r.amount.currency) ?? 0) + r.amount.amount);
  const total = [...byCurrency].map(([currency, amount]) => formatMoney({ amount, currency })).join(" + ");
  const latest = after[0];
  return (
    <div className="text-[13px]">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-medium text-success">
          {after.length} new round{after.length === 1 ? "" : "s"}
          {total && ` · ${total}`}
        </span>
        <SourceChip sources={after.flatMap((r) => r.sources)} />
      </div>
      <div className="text-xs text-muted-foreground">
        Latest {latest.stage}, {fuzzy(latest.date!)}
        {latest.leads.length ? ` · led by ${latest.leads.map((l) => l.name).join(", ")}` : ""}
      </div>
    </div>
  );
}

export function RefreshFundingButton({ count }: { count: number }) {
  const { busy, run } = useRefresh();
  if (!count) return null;
  return (
    <Button variant="outline" className="bg-card" disabled={!!busy} onClick={() => run("rounds", { kinds: ["rounds"] }, "Funding check")}>
      {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Refresh funding
    </Button>
  );
}

// -- shared: company list on the left, the chosen company's results on the right ----

type PickerItem = { company: PortfolioCompany; status: React.ReactNode; attends?: boolean };

/** Searchable company list. The parent owns the selection. */
function CompanyPicker({ items, selected, onSelect }: { items: PickerItem[]; selected: string | null; onSelect: (id: string) => void }) {
  const [q, setQ] = useState("");
  const shown = q ? items.filter((i) => i.company.name.toLowerCase().includes(q.toLowerCase())) : items;
  return (
    <div className="flex min-h-0 flex-col rounded-lg border bg-background/40">
      <label className="flex items-center gap-2 border-b px-3 py-2">
        <Search className="size-3.5 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${items.length} companies`}
          className="w-full bg-transparent text-[13px] outline-none placeholder:text-subtle"
        />
      </label>
      <ul className="max-h-60 overflow-y-auto p-1.5 xl:max-h-[560px]">
        {shown.map(({ company: c, status, attends }) => {
          const active = c.id === selected;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                aria-current={active}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors",
                  active ? "bg-card shadow-sm ring-1 ring-primary/30" : "hover:bg-muted/70",
                )}
              >
                <EntityAvatar name={c.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className={cn("truncate text-[13px] font-medium", active && "text-primary")}>{c.name}</span>
                    {attends && <span className="size-1.5 shrink-0 rounded-full bg-slush" title="At Slush 2026" />}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{status}</span>
                </span>
                <ChevronRight className={cn("size-3.5 shrink-0 text-subtle", active && "text-primary")} />
              </button>
            </li>
          );
        })}
        {!shown.length && <li className="px-2 py-6 text-center text-xs text-muted-foreground">No company matches “{q}”.</li>}
      </ul>
    </div>
  );
}

/** Keeps a valid selection: the chosen id while it is in the list, else the first one. */
function useSelection(ids: string[]) {
  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked && ids.includes(picked) ? picked : (ids[0] ?? null);
  return [selected, setPicked] as const;
}

function DetailHeader({
  company,
  attends,
  meta,
  action,
}: {
  company: PortfolioCompany;
  attends?: boolean;
  meta?: React.ReactNode;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
      <EntityAvatar name={company.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[15px] font-semibold tracking-tight">{company.name}</span>
          {attends && <SlushTag label="At Slush" />}
        </div>
        {meta && <div className="truncate text-xs text-muted-foreground">{meta}</div>}
      </div>
      {action}
    </div>
  );
}

function Searching({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center text-[13px] text-muted-foreground">
      <Loader2 className="size-5 animate-spin text-primary" />
      {children}
    </div>
  );
}

function ShowMore({ total, shown, open, onToggle, noun }: { total: number; shown: number; open: boolean; onToggle: () => void; noun: string }) {
  if (total <= shown) return null;
  return (
    <button type="button" onClick={onToggle} className="w-full border-t px-4 py-2.5 text-center text-[13px] font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground">
      {open ? "Show fewer" : `Show all ${total} ${noun}`}
    </button>
  );
}

/** "San Francisco, US" from a full street address; the record's headquarters field is often a mailing address. */
function shortPlace(address?: string | null) {
  if (!address) return null;
  // Trailing postcodes ("CA 94105", "FR-74") are dropped from each part.
  const parts = address
    .split(",")
    .map((p) => p.trim().replace(/\s+\d[\d\s-]*$/, ""))
    .filter(Boolean);
  if (parts.length < 2) return address;
  const country = parts[parts.length - 1];
  const city = parts
    .slice(0, -1)
    .filter((p) => !/\d/.test(p) && !/^[A-Z]{2}(-[A-Z0-9]+)?$/.test(p) && !/^c\/o\b/i.test(p))
    .pop();
  const tidy = (s: string) => (s === s.toUpperCase() && s.length > 3 ? s.charAt(0) + s.slice(1).toLowerCase() : s);
  return city ? `${tidy(city)}, ${country}` : country;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// -- 1. competitor monitoring -------------------------------------------------------

const COMPETITORS_SHOWN = 8;

export function CompetitorPanel({ companies, analyses, alerts }: { companies: PortfolioCompany[]; analyses: AnalysisIndex; alerts: Alert[] }) {
  const { busy, run } = useRefresh();
  const eligible = companies.filter((c) => c.status === "active" && (c.calaCompanyId || c.industry || c.description));
  const recentRounds = alerts.filter((a) => a.kind === "portfolio_competitor").slice(0, 4);

  const info = (c: PortfolioCompany) => {
    const a = analyses[c.id]?.competitors;
    const data = hasData(a) ? (a!.data as unknown as CompetitorsAnalysis) : null;
    const rows = data?.companies ?? [];
    return { a, data, rows, recent: rows.filter((r) => r.last_round && isRecent(r.last_round.date)).length };
  };
  // Companies whose competitors raised recently first, then the rest that were checked, then unchecked.
  const ordered = [...eligible].sort((x, y) => {
    const a = info(x);
    const b = info(y);
    return b.recent - a.recent || Number(!!b.data || b.a?.status === "loading") - Number(!!a.data || a.a?.status === "loading");
  });
  const missing = eligible.filter((c) => !info(c).data && info(c).a?.status !== "loading");
  const [selected, setSelected] = useSelection(ordered.map((c) => c.id));
  const current = ordered.find((c) => c.id === selected);

  const items: PickerItem[] = ordered.map((c) => {
    const { a, data, rows, recent } = info(c);
    const status =
      a?.status === "loading" ? (
        <span className="inline-flex items-center gap-1">
          <Loader2 className="size-3 animate-spin" /> Searching
        </span>
      ) : data ? (
        <>
          {plural(rows.length, "competitor")}
          {recent > 0 && <span className="text-warning"> · {recent} raised recently</span>}
        </>
      ) : a?.status === "failed" ? (
        <span className="text-destructive">Search failed</span>
      ) : (
        "Not checked yet"
      );
    return { company: c, status };
  });

  return (
    <Panel
      title={
        <span className="inline-flex items-center gap-2">
          <Swords className="size-4 text-primary" /> Competitor monitoring
        </span>
      }
      description="Who competes with your companies, and how they are funded. When one of them raises, it shows up here."
      action={
        missing.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="bg-card"
            disabled={!!busy}
            onClick={() => run("all", { kinds: ["competitors"] }, `Competitor search for ${plural(missing.length, "company", "companies")}`)}
          >
            {busy === "all" ? <Loader2 className="animate-spin" /> : <Swords />} Check all {missing.length} remaining
          </Button>
        )
      }
    >
      {!eligible.length ? (
        <EmptyState compact icon={Swords} title="No active companies to check" description="Competitors are found from a company's verified record, industry or description." />
      ) : (
        <div className="space-y-4">
          {recentRounds.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                <TrendingUp className="size-3.5 text-warning" /> Recent competitor rounds
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {recentRounds.map((a) => (
                  <Link
                    key={a.id}
                    href={a.href}
                    className="group rounded-lg border border-warning/25 bg-warning-soft/40 px-3 py-2.5 transition-colors hover:border-warning/50"
                  >
                    <div className="truncate text-[13px] font-medium group-hover:text-primary">{a.title}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{[a.reason, formatDay(a.date)].filter(Boolean).join(" · ")}</span>
                      <SourceChip sources={a.sources} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-[260px_1fr]">
            <CompanyPicker items={items} selected={selected} onSelect={setSelected} />
            {current && (
              <CompetitorsOf
                key={current.id}
                company={current}
                analysis={info(current).a}
                onRefresh={() => run(current.id, { companyId: current.id, kinds: ["competitors"] }, "Competitor search")}
                busy={busy === current.id || busy === "all"}
              />
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

function CompetitorsOf({ company, analysis, onRefresh, busy }: { company: PortfolioCompany; analysis?: PortfolioAnalysis; onRefresh: () => void; busy: boolean }) {
  const [all, setAll] = useState(false);
  const loading = analysis?.status === "loading";
  const data = hasData(analysis) ? (analysis!.data as unknown as CompetitorsAnalysis) : null;
  const rows = [...(data?.companies ?? [])].sort((a, b) => (b.last_round?.date ?? "").localeCompare(a.last_round?.date ?? ""));
  const shown = all ? rows : rows.slice(0, COMPETITORS_SHOWN);

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border bg-card">
      <DetailHeader
        company={company}
        meta={
          data
            ? [data.mode === "peers" ? "Companies like it (no verified record to match)" : "Competitors on record", analysis?.finishedAt && `checked ${formatDay(analysis.finishedAt)}`]
                .filter(Boolean)
                .join(" · ")
            : company.industry || undefined
        }
        action={
          <Button size="sm" variant={data ? "ghost" : "default"} onClick={onRefresh} disabled={busy || loading}>
            {busy || loading ? <Loader2 className="animate-spin" /> : data ? <RefreshCw /> : <Swords />}
            {loading ? "Searching" : data ? "Refresh" : "Find competitors"}
          </Button>
        }
      />
      {analysis?.status === "failed" && <p className="border-b bg-destructive/5 px-4 py-2 text-xs text-destructive">The last search failed. {failure(analysis.error)}</p>}
      {!data ? (
        loading ? (
          <Searching>Finding competitors in the records. This takes up to a minute.</Searching>
        ) : (
          <div className="p-4">
            <EmptyState
              compact
              icon={Swords}
              title="Not checked yet"
              description={`Find who competes with ${company.name} and how they are funded.`}
            />
          </div>
        )
      ) : !rows.length ? (
        <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">No competitors on record for {company.name}.</p>
      ) : (
        <>
          <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.3fr)] gap-4 border-b bg-muted/40 px-4 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase md:grid">
            <span>Company</span>
            <span>Total raised</span>
            <span className="text-right">Latest round</span>
          </div>
          <ul className="divide-y">
            {shown.map((r) => (
              <CompetitorRow key={r.id} row={r} />
            ))}
          </ul>
          <ShowMore total={rows.length} shown={COMPETITORS_SHOWN} open={all} onToggle={() => setAll((v) => !v)} noun="competitors" />
        </>
      )}
    </div>
  );
}

function CompetitorRow({ row }: { row: StandingRow }) {
  const last = row.last_round;
  const place = shortPlace(row.headquarters?.value);
  return (
    <li className="grid grid-cols-1 gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-muted/30 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.3fr)] md:items-center">
      <div className="flex min-w-0 items-center gap-2.5">
        <EntityAvatar name={row.name} size="sm" />
        <div className="min-w-0">
          <Link href={`/company/${row.id}`} className="block truncate text-sm font-medium hover:text-primary">
            {row.name}
          </Link>
          <div className="truncate text-xs text-muted-foreground">{[row.stage?.value, place].filter(Boolean).join(" · ") || "Little on record"}</div>
        </div>
      </div>
      <div className="text-[13px] tabular">
        {row.raised ? <span className="font-medium">{formatMoney(row.raised.value)}</span> : <span className="text-xs text-subtle">Not on record</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[13px] md:justify-end">
        {last ? (
          <>
            {isRecent(last.date) && <Pill tone="warning">Raised recently</Pill>}
            <span className="font-medium tabular">{roundLabel(last)}</span>
            <span className="text-xs text-muted-foreground">{last.date ? fuzzy(last.date) : "date unknown"}</span>
            <SourceChip sources={last.sources} />
          </>
        ) : (
          <span className="text-xs text-subtle">No funding on record</span>
        )}
      </div>
    </li>
  );
}

// -- 2. lead investors, with Slush --------------------------------------------------

const LEADS_SHOWN = 6;
const ATTENDING_CHIPS = 12;

export function LeadInvestorsPanel({
  companies,
  analyses,
  attending,
  attendingInvestors,
  slushError,
}: {
  companies: PortfolioCompany[];
  analyses: AnalysisIndex;
  /** Portfolio company ids attending Slush 2026. */
  attending: string[];
  /** Ids of investors (from the analyses) attending Slush 2026. */
  attendingInvestors: string[];
  slushError: string | null;
}) {
  const { busy, run } = useRefresh();
  const going = new Set(attendingInvestors);
  const active = companies.filter((c) => c.status === "active" && (c.calaCompanyId || c.industry || c.description));
  const atSlush = companies.filter((c) => attending.includes(c.id));
  const [allChips, setAllChips] = useState(false);

  const info = (c: PortfolioCompany) => {
    const a = analyses[c.id]?.investors;
    const data = hasData(a) ? (a!.data as unknown as InvestorsAnalysis) : null;
    const list = data?.investors ?? [];
    return { a, data, list, atEvent: list.filter((i) => going.has(i.id)).length };
  };
  const notChecked = active.filter((c) => !info(c).data && info(c).a?.status !== "loading");
  // Leads at Slush first, then companies with results, then the ones attending, then the rest.
  const rank = (c: PortfolioCompany) => {
    const i = info(c);
    return i.atEvent ? 0 : i.data || i.a?.status === "loading" ? 1 : attending.includes(c.id) ? 2 : 3;
  };
  const ordered = [...active].sort((a, b) => rank(a) - rank(b) || info(b).atEvent - info(a).atEvent);
  const [selected, setSelected] = useSelection(ordered.map((c) => c.id));
  const current = ordered.find((c) => c.id === selected);

  const items: PickerItem[] = ordered.map((c) => {
    const { a, data, list, atEvent } = info(c);
    const status =
      a?.status === "loading" ? (
        <span className="inline-flex items-center gap-1">
          <Loader2 className="size-3 animate-spin" /> Searching
        </span>
      ) : data ? (
        atEvent ? (
          <span className="text-slush-foreground">{atEvent} at Slush · {list.length} matches</span>
        ) : (
          plural(list.length, "match", "matches")
        )
      ) : a?.status === "failed" ? (
        <span className="text-destructive">Search failed</span>
      ) : (
        "Not checked yet"
      );
    return { company: c, status, attends: attending.includes(c.id) };
  });

  return (
    <Panel
      title={
        <span className="inline-flex items-center gap-2">
          <ArrowUpRight className="size-4 text-primary" /> Lead investors
        </span>
      }
      description="Investors who could lead each company's next round. The ones attending Slush come first, so you can make intros before the event."
      action={
        notChecked.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="bg-card"
            disabled={!!busy}
            onClick={() => run("all", { kinds: ["investors"] }, `Investor search for ${notChecked.length} ${notChecked.length === 1 ? "company" : "companies"}`)}
          >
            {busy === "all" ? <Loader2 className="animate-spin" /> : <ArrowUpRight />} Check all {notChecked.length} remaining
          </Button>
        )
      }
    >
      {slushError && <p className="mb-3 text-[13px] text-destructive">Could not load the Slush attendee list: {slushError}</p>}

      <div className="mb-4 rounded-lg border border-slush/40 bg-slush-soft/40 p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <Ticket className="size-4 text-slush-foreground" />
          <span className="text-[13px] font-medium">
            {atSlush.length ? `${plural(atSlush.length, "portfolio company", "portfolio companies")} at Slush 2026` : "None of your portfolio companies is on the Slush attendee list"}
          </span>
        </div>
        {atSlush.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {(allChips ? atSlush : atSlush.slice(0, ATTENDING_CHIPS)).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(c.id)}
                className="inline-flex h-6 items-center rounded-full border border-slush/40 bg-card px-2.5 text-xs font-medium transition-colors hover:border-slush hover:text-slush-foreground"
              >
                {c.name}
              </button>
            ))}
            {atSlush.length > ATTENDING_CHIPS && (
              <button type="button" onClick={() => setAllChips((v) => !v)} className="h-6 px-2 text-xs font-medium text-slush-foreground hover:underline">
                {allChips ? "Show fewer" : `+${atSlush.length - ATTENDING_CHIPS} more`}
              </button>
            )}
          </div>
        )}
      </div>

      {!active.length ? (
        <p className="text-[13px] text-muted-foreground">Add active companies to find investors for them.</p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[260px_1fr]">
          <CompanyPicker items={items} selected={selected} onSelect={setSelected} />
          {current && (
            <LeadsFor
              key={current.id}
              company={current}
              analysis={info(current).a}
              going={going}
              attends={attending.includes(current.id)}
              onRefresh={() => run(current.id, { companyId: current.id, kinds: ["investors"] }, "Investor search")}
              busy={busy === current.id || busy === "all"}
            />
          )}
        </div>
      )}
    </Panel>
  );
}

function LeadsFor({
  company,
  analysis,
  going,
  attends,
  onRefresh,
  busy,
}: {
  company: PortfolioCompany;
  analysis?: PortfolioAnalysis;
  going: Set<string>;
  attends: boolean;
  onRefresh: () => void;
  busy: boolean;
}) {
  const [all, setAll] = useState(false);
  const loading = analysis?.status === "loading";
  const data = hasData(analysis) ? (analysis!.data as unknown as InvestorsAnalysis) : null;
  const list = [...(data?.investors ?? [])].sort((a, b) => Number(going.has(b.id)) - Number(going.has(a.id)) || b.match.score - a.match.score);
  const atEvent = list.filter((i) => going.has(i.id)).length;
  const shown = all ? list : list.slice(0, LEADS_SHOWN);

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border bg-card">
      <DetailHeader
        company={company}
        attends={attends}
        meta={
          data
            ? [`${plural(list.length, "match", "matches")}`, atEvent ? `${atEvent} at Slush` : "none at Slush", analysis?.finishedAt && `checked ${formatDay(analysis.finishedAt)}`]
                .filter(Boolean)
                .join(" · ")
            : company.industry || undefined
        }
        action={
          <Button size="sm" variant={data ? "ghost" : "default"} onClick={onRefresh} disabled={busy || loading}>
            {busy || loading ? <Loader2 className="animate-spin" /> : data ? <RefreshCw /> : <ArrowUpRight />}
            {loading ? "Searching" : data ? "Refresh" : "Find lead investors"}
          </Button>
        }
      />
      {analysis?.status === "failed" && <p className="border-b bg-destructive/5 px-4 py-2 text-xs text-destructive">The last search failed. {failure(analysis.error)}</p>}
      {!data ? (
        loading ? (
          <Searching>Finding investors in companies like {company.name}. This takes up to a minute.</Searching>
        ) : (
          <div className="p-4">
            <EmptyState
              compact
              icon={ArrowUpRight}
              title="Not checked yet"
              description={`Find investors who back companies like ${company.name}, and which of them are at Slush.`}
            />
          </div>
        )
      ) : !list.length ? (
        <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">No investors in companies like {company.name} on record.</p>
      ) : (
        <>
          {!atEvent && (
            <p className="border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">None of these investors is on the Slush list. Reach out to the best matches after the event.</p>
          )}
          <ul className="divide-y">
            {shown.map((i) => (
              <LeadRow key={i.id} investor={i} company={company} atSlush={going.has(i.id)} />
            ))}
          </ul>
          <ShowMore total={list.length} shown={LEADS_SHOWN} open={all} onToggle={() => setAll((v) => !v)} noun="investors" />
        </>
      )}
    </div>
  );
}

function LeadRow({ investor: i, company: c, atSlush }: { investor: InvestorMatch; company: PortfolioCompany; atSlush: boolean }) {
  const params = new URLSearchParams({ to: i.id, toName: i.name });
  if (c.calaCompanyId) {
    params.set("from", c.calaCompanyId);
    params.set("fromName", c.name);
  }
  const score = Math.max(0, Math.min(100, i.match.score));
  return (
    <li className={cn("flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center", atSlush && "bg-slush-soft/25")}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <EntityAvatar name={i.name} kind="investor" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href={`/company/${i.id}`} className="text-sm font-medium hover:text-primary">
              {i.name}
            </Link>
            {atSlush && <SlushTag label="At Slush" />}
            {i.conflict === "competitor" && <Pill tone="warning">Backs a competitor</Pill>}
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{i.why}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {i.rounds_led > 0 && <span>Led {plural(i.rounds_led, "round")}</span>}
            {i.last_deal && <span>Last deal {fuzzy(i.last_deal.date)}</span>}
            <SourceChip sources={i.sources} />
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 pl-12 sm:pl-0">
        <span className="flex items-center gap-2 text-xs" title={`${score}% match`}>
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
            <span className={cn("block h-full rounded-full", score >= 60 ? "bg-primary" : "bg-primary/50")} style={{ width: `${score}%` }} />
          </span>
          <span className="w-8 font-semibold tabular">{score}%</span>
        </span>
        <Button size="sm" variant="outline" className="bg-card" asChild>
          <Link href={`/intros?${params}`}>Ask for an intro</Link>
        </Button>
      </div>
    </li>
  );
}
