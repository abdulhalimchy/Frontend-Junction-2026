"use client";

import { ArrowUpRight, Loader2, RefreshCw, Swords, Ticket } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatDay, formatFuzzyDate, formatMoney } from "@/lib/format";
import type { AnalysisIndex } from "@/lib/portfolio-insights";
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
import { Pill } from "./badges";
import { EmptyState, EntityAvatar, Panel } from "./blocks";
import { SourceChip } from "./source-chip";
import { api } from "./startup-dialogs";

// Insights for an investor's portfolio, from the backend's stored Cala analyses:
//   rounds      → "Since you invested" (in the companies table)
//   competitors → competitor monitoring
//   investors   → who could lead the next round, narrowed to Slush attendees

const hasData = (a?: PortfolioAnalysis) => !!a && Object.keys(a.data).length > 0;
const RECENT_DAYS = 180;
const COLLAPSED = 5;

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
      toast.error(err instanceof Error ? err.message : "Could not start it.");
    } finally {
      setBusy(null);
    }
  }
  return { busy, run };
}

/** Keeps the page fresh while analyses or lookups run in the background. */
export function InsightsPoller({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [active, router]);
  return null;
}

// -- 2. since you invested ---------------------------------------------------------

/** The companies-table cell: rounds after the investor's entry date (or the latest round when no date). */
export function SinceInvested({ company, analysis }: { company: PortfolioCompany; analysis?: PortfolioAnalysis }) {
  if (!company.calaCompanyId) return <span className="text-xs text-subtle" title="Not matched in Cala, so no funding history">—</span>;
  if (!hasData(analysis)) {
    if (analysis?.status === "failed") return <span className="text-xs text-destructive" title={analysis.error}>Lookup failed</span>;
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Checking Cala
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

// -- 1. competitor monitoring -------------------------------------------------------

export function CompetitorPanel({ companies, analyses, alerts }: { companies: PortfolioCompany[]; analyses: AnalysisIndex; alerts: Alert[] }) {
  const { busy, run } = useRefresh();
  const eligible = companies.filter((c) => c.status === "active" && (c.calaCompanyId || c.industry || c.description));
  const analysed = eligible.filter((c) => hasData(analyses[c.id]?.competitors) || analyses[c.id]?.competitors?.status === "loading");
  const missing = eligible.filter((c) => !analysed.includes(c));
  const recent = alerts.filter((a) => a.kind === "portfolio_competitor").slice(0, 5);
  const [showMissing, setShowMissing] = useState(false);

  return (
    <Panel
      className="mb-6"
      title="Competitor monitoring"
      description="Who competes with your companies, and how they are funded. When one of them raises, it shows up here."
      action={
        missing.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="bg-card"
            disabled={!!busy}
            onClick={() => run("all", { kinds: ["competitors"] }, `Competitor search for ${missing.length} ${missing.length === 1 ? "company" : "companies"}`)}
          >
            {busy === "all" ? <Loader2 className="animate-spin" /> : <Swords />} Find competitors for all {missing.length}
          </Button>
        )
      }
    >
      {!eligible.length ? (
        <EmptyState compact icon={Swords} title="No active companies to check" description="Competitors are found from a company's Cala record, industry or description." />
      ) : (
        <div className="space-y-4">
          {recent.length > 0 && (
            <div className="rounded-lg border border-warning/30 bg-warning-soft/40 p-3">
              <p className="mb-2 text-xs font-semibold">Recent competitor rounds</p>
              <ul className="space-y-1.5">
                {recent.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2 text-[13px]">
                    <Link href={a.href} className="font-medium hover:text-primary">
                      {a.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {a.reason} · {formatDay(a.date)}
                    </span>
                    <SourceChip sources={a.sources} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {analysed.map((c) => (
            <CompetitorsOf key={c.id} company={c} analysis={analyses[c.id]!.competitors!} onRefresh={() => run(c.id, { companyId: c.id, kinds: ["competitors"] }, "Competitor search")} busy={busy === c.id} />
          ))}
          {missing.length > 0 && (
            <ul className="divide-y rounded-lg border">
              {(showMissing ? missing : missing.slice(0, COLLAPSED)).map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                  <EntityAvatar name={c.name} size="sm" />
                  <span className="min-w-0 flex-1 text-sm font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">Not checked yet</span>
                  <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => run(c.id, { companyId: c.id, kinds: ["competitors"] }, "Competitor search")}>
                    {busy === c.id ? <Loader2 className="animate-spin" /> : <Swords />} Find competitors
                  </Button>
                </li>
              ))}
              {missing.length > COLLAPSED && (
                <li className="px-4 py-2">
                  <button type="button" onClick={() => setShowMissing((v) => !v)} className="text-[13px] text-muted-foreground hover:text-foreground">
                    {showMissing ? "Show fewer" : `Show all ${missing.length} not checked yet`}
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}

function CompetitorsOf({ company, analysis, onRefresh, busy }: { company: PortfolioCompany; analysis: PortfolioAnalysis; onRefresh: () => void; busy: boolean }) {
  const [all, setAll] = useState(false);
  const loading = analysis.status === "loading";
  const data = hasData(analysis) ? (analysis.data as unknown as CompetitorsAnalysis) : null;
  const rows = [...(data?.companies ?? [])].sort((a, b) => (b.last_round?.date ?? "").localeCompare(a.last_round?.date ?? ""));
  const shown = all ? rows : rows.slice(0, 5);

  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-2.5">
        <div className="min-w-0">
          <span className="text-sm font-medium">{company.name}</span>
          <span className="ml-2 text-xs text-muted-foreground">
            {data?.mode === "peers" ? "Companies like it (not matched in Cala)" : "Competitors on record in Cala"}
            {analysis.finishedAt && ` · checked ${formatDay(analysis.finishedAt)}`}
          </span>
        </div>
        <Button size="sm" variant="ghost" onClick={onRefresh} disabled={busy || loading} aria-label={`Refresh competitors of ${company.name}`}>
          {busy || loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          {loading ? "Checking" : "Refresh"}
        </Button>
      </div>
      {analysis.status === "failed" && <p className="px-4 py-2 text-xs text-destructive">The last check failed: {analysis.error}</p>}
      {!data ? (
        <p className="flex items-center gap-2 px-4 py-3 text-[13px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Finding competitors in Cala. This takes up to a minute.
        </p>
      ) : !rows.length ? (
        <p className="px-4 py-3 text-[13px] text-muted-foreground">Cala has no competitors on record for {company.name}.</p>
      ) : (
        <>
          <ul className="divide-y">
            {shown.map((r) => (
              <CompetitorRow key={r.id} row={r} />
            ))}
          </ul>
          {rows.length > 5 && (
            <button type="button" onClick={() => setAll((v) => !v)} className="px-4 pb-2.5 text-[13px] text-muted-foreground hover:text-foreground">
              {all ? "Show fewer" : `Show all ${rows.length}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function CompetitorRow({ row }: { row: StandingRow }) {
  const last = row.last_round;
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <Link href={`/company/${row.id}`} className="text-sm font-medium hover:text-primary">
          {row.name}
        </Link>
        <div className="truncate text-xs text-muted-foreground">
          {[row.stage?.value, row.headquarters?.value, row.raised && `${formatMoney(row.raised.value)} raised`].filter(Boolean).join(" · ") || "Little on record"}
        </div>
      </div>
      {last && isRecent(last.date) && <Pill tone="warning">Raised recently</Pill>}
      <div className="text-right text-[13px]">
        {last ? (
          <span className="inline-flex items-center gap-2">
            <span className="tabular">{roundLabel(last)}</span>
            <span className="text-xs text-muted-foreground">{last.date ? fuzzy(last.date) : "Date not on record"}</span>
            <SourceChip sources={last.sources} />
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">No funding on record</span>
        )}
      </div>
    </li>
  );
}

// -- 3. Slush ---------------------------------------------------------------------

const LEADS_SHOWN = 3;

export function SlushPanel({
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
  const notChecked = active.filter((c) => !hasData(analyses[c.id]?.investors) && analyses[c.id]?.investors?.status !== "loading");
  const [showAll, setShowAll] = useState(false);
  // Companies with results first, then the ones at Slush, then the rest.
  const rank = (c: PortfolioCompany) => (analyses[c.id]?.investors ? 0 : attending.includes(c.id) ? 1 : 2);
  const ordered = [...active].sort((a, b) => rank(a) - rank(b));

  return (
    <Panel
      className="mb-6"
      title={
        <span className="inline-flex items-center gap-2">
          <Ticket className="size-4 text-slush" /> Slush 2026
        </span>
      }
      description="Your companies at Slush, and investors there who could lead their next round. Ask for a warm intro before the event."
      action={
        notChecked.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="bg-card"
            disabled={!!busy}
            onClick={() => run("all", { kinds: ["investors"] }, `Investor search for ${notChecked.length} ${notChecked.length === 1 ? "company" : "companies"}`)}
          >
            {busy === "all" ? <Loader2 className="animate-spin" /> : <ArrowUpRight />} Find lead investors for all {notChecked.length}
          </Button>
        )
      }
    >
      {slushError && <p className="mb-3 text-[13px] text-destructive">Could not load the Slush attendee list: {slushError}</p>}
      <div className="mb-4">
        <p className="mb-2 text-xs font-semibold">Your companies attending</p>
        {atSlush.length ? (
          <div className="flex flex-wrap gap-2">
            {atSlush.map((c) => (
              <Pill key={c.id} tone="teal">
                {c.name}
              </Pill>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">None of your portfolio companies is on the Slush attendee list in Cala.</p>
        )}
      </div>

      <p className="mb-2 text-xs font-semibold">Investors at Slush who could lead the next round</p>
      {!active.length ? (
        <p className="text-[13px] text-muted-foreground">Add active companies to find investors for them.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {(showAll ? ordered : ordered.slice(0, COLLAPSED)).map((c) => {
            const a = analyses[c.id]?.investors;
            const data = hasData(a) ? (a!.data as unknown as InvestorsAnalysis) : null;
            const leads = (data?.investors ?? []).filter((i) => going.has(i.id)).slice(0, LEADS_SHOWN);
            // Nobody matching is at Slush: still show the best matches, to reach out to after the event.
            const fallback = leads.length ? [] : (data?.investors ?? []).slice(0, 2);
            return (
              <li key={c.id} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <EntityAvatar name={c.name} size="sm" />
                  <span className="min-w-0 flex-1 text-sm font-medium">{c.name}</span>
                  {a?.status === "loading" ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" /> Finding investors
                    </span>
                  ) : (
                    <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => run(c.id, { companyId: c.id, kinds: ["investors"] }, "Investor search")}>
                      {busy === c.id ? <Loader2 className="animate-spin" /> : data ? <RefreshCw /> : <ArrowUpRight />}
                      {data ? "Refresh" : "Find lead investors"}
                    </Button>
                  )}
                </div>
                {a?.status === "failed" && <p className="mt-1 text-xs text-destructive">The last search failed: {a.error}</p>}
                {data &&
                  (leads.length ? (
                    <ul className="mt-2 space-y-1.5 pl-10">
                      {leads.map((i) => (
                        <LeadRow key={i.id} investor={i} company={c} />
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-1 pl-10">
                      <p className="text-xs text-muted-foreground">
                        {data.investors.length
                          ? `None of the ${data.investors.length} investors in companies like it is on the Slush list. Best matches:`
                          : "No investors in companies like it on record."}
                      </p>
                      {fallback.length > 0 && (
                        <ul className="mt-1.5 space-y-1.5">
                          {fallback.map((i) => (
                            <LeadRow key={i.id} investor={i} company={c} offList />
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
              </li>
            );
          })}
          {ordered.length > COLLAPSED && (
            <li className="px-4 py-2">
              <button type="button" onClick={() => setShowAll((v) => !v)} className="text-[13px] text-muted-foreground hover:text-foreground">
                {showAll ? "Show fewer" : `Show all ${ordered.length} companies`}
              </button>
            </li>
          )}
        </ul>
      )}
    </Panel>
  );
}

function LeadRow({ investor: i, company: c, offList }: { investor: InvestorMatch; company: PortfolioCompany; offList?: boolean }) {
  const params = new URLSearchParams({ to: i.id, toName: i.name });
  if (c.calaCompanyId) {
    params.set("from", c.calaCompanyId);
    params.set("fromName", c.name);
  }
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
      <Pill tone={i.match.score >= 60 ? "success" : "neutral"}>{i.match.score}</Pill>
      <Link href={`/company/${i.id}`} className="font-medium hover:text-primary">
        {i.name}
      </Link>
      {offList && <span className="text-[11px] text-subtle">not on the Slush list</span>}
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
        {i.why}
        {i.rounds_led ? ` · led ${i.rounds_led} round${i.rounds_led === 1 ? "" : "s"}` : ""}
      </span>
      <SourceChip sources={i.sources} />
      <Link href={`/intros?${params}`} className="text-xs font-medium text-primary hover:underline">
        Ask for an intro
      </Link>
    </li>
  );
}
