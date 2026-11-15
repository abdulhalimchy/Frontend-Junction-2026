"use client";

import { Building2, Check, Link2, Loader2, MoreHorizontal, Pencil, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatDay, formatFuzzyDate, formatMoney } from "@/lib/format";
import type { CalaCandidate, PortfolioCompany, PortfolioStatus, PortfolioSuggestion, PortfolioSuggestions } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Pill } from "./badges";
import { EmptyState, EntityAvatar, Panel } from "./blocks";
import { SourceChip } from "./source-chip";
import { type AnalysisIndex, plainError } from "@/lib/portfolio-insights";
import { SinceInvested } from "./portfolio-insights";
import { api, CompanyLookupDialog, StartupForm, valuesOf, type Values } from "./startup-dialogs";

// -- deal terms -----------------------------------------------------------------

export const STATUS_LABEL: Record<PortfolioStatus, string> = { active: "Active", exited: "Exited", written_off: "Written off" };
const STATUS_TONE: Record<PortfolioStatus, "success" | "neutral" | "warning"> = { active: "success", exited: "neutral", written_off: "warning" };
const CURRENCIES = ["EUR", "USD", "GBP", "SEK", "NOK", "DKK", "CHF"];

type Deal = {
  invested_amount: string;
  currency: string;
  entry_round: string;
  invested_on: string;
  ownership: string;
  board_seat: boolean;
  status: PortfolioStatus;
  notes: string;
};

const EMPTY_DEAL: Deal = { invested_amount: "", currency: "EUR", entry_round: "", invested_on: "", ownership: "", board_seat: false, status: "active", notes: "" };

function dealOf(c: PortfolioCompany): Deal {
  return {
    invested_amount: c.investedAmount === null ? "" : String(c.investedAmount),
    currency: c.currency || "EUR",
    entry_round: c.entryRound,
    invested_on: c.investedOn,
    ownership: c.ownership === null ? "" : String(c.ownership),
    board_seat: c.boardSeat,
    status: c.status,
    notes: c.notes,
  };
}

/** "1.5m", "250k", "250 000" or "1,000,000" → "1500000"; null when it is not a number. */
function parseAmount(text: string): string | null {
  const t = text.trim().toLowerCase().replace(/[\s,_]/g, "");
  if (!t) return "";
  const m = t.match(/^(\d+(?:\.\d+)?)([km])?$/);
  if (!m) return null;
  const n = Number(m[1]) * (m[2] === "m" ? 1e6 : m[2] === "k" ? 1e3 : 1);
  return String(Math.round(n * 100) / 100);
}

/** Deal body for the backend, or an error message. */
function dealBody(d: Deal): { body: Record<string, unknown> } | { error: string } {
  const amount = parseAmount(d.invested_amount);
  if (amount === null) return { error: "Enter the amount as a number, e.g. 500000, 500k or 1.5m." };
  const own = d.ownership.trim().replace(/%$/, "").replace(",", ".");
  if (own && !(/^\d+(\.\d+)?$/.test(own) && Number(own) <= 100)) return { error: "Ownership is a percentage between 0 and 100." };
  if (d.invested_on && !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(d.invested_on.trim())) return { error: "Use YYYY, YYYY-MM or YYYY-MM-DD for the investment date." };
  return {
    body: {
      invested_amount: amount || null,
      currency: d.currency,
      entry_round: d.entry_round.trim(),
      invested_on: d.invested_on.trim(),
      ownership: own || null,
      board_seat: d.board_seat,
      status: d.status,
      notes: d.notes,
    },
  };
}

function DealFields({ deal, onChange }: { deal: Deal; onChange: (d: Deal) => void }) {
  const set = <K extends keyof Deal>(k: K, v: Deal[K]) => onChange({ ...deal, [k]: v });
  const label = "text-xs font-medium text-muted-foreground";
  return (
    <fieldset className="space-y-3 rounded-lg border border-dashed p-3">
      <legend className="px-1 text-xs font-semibold">
        Your investment <span className="font-normal text-subtle">· private, only you see this</span>
      </legend>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="deal-amount" className={label}>
            Amount invested
          </Label>
          <div className="flex gap-2">
            <Input id="deal-amount" value={deal.invested_amount} onChange={(e) => set("invested_amount", e.target.value)} placeholder="500k" />
            <Select value={deal.currency} onValueChange={(v) => set("currency", v)}>
              <SelectTrigger className="w-24" aria-label="Currency">
                <SelectValue>{deal.currency}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="deal-round" className={label}>
            Entry round
          </Label>
          <Input id="deal-round" value={deal.entry_round} onChange={(e) => set("entry_round", e.target.value)} placeholder="Seed" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="deal-date" className={label}>
            Invested on
          </Label>
          <Input id="deal-date" value={deal.invested_on} onChange={(e) => set("invested_on", e.target.value)} placeholder="2024 or 2024-03" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="deal-ownership" className={label}>
            Ownership %
          </Label>
          <Input id="deal-ownership" inputMode="decimal" value={deal.ownership} onChange={(e) => set("ownership", e.target.value)} placeholder="8" />
        </div>
        <div className="space-y-1.5">
          <Label className={label}>Status</Label>
          <Select value={deal.status} onValueChange={(v) => set("status", v as PortfolioStatus)}>
            <SelectTrigger className="w-full" aria-label="Status">
              <SelectValue>{STATUS_LABEL[deal.status]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_LABEL) as PortfolioStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={deal.board_seat} onCheckedChange={(v) => set("board_seat", v)} /> Board seat
          </label>
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="deal-notes" className={label}>
            Notes
          </Label>
          <Textarea id="deal-notes" value={deal.notes} onChange={(e) => set("notes", e.target.value)} className="min-h-14 resize-none" placeholder="Pro-rata rights, co-investors, ..." />
        </div>
      </div>
    </fieldset>
  );
}

// -- add ----------------------------------------------------------------------

function AddCompanyDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: CalaCandidate | null;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [deal, setDeal] = useState<Deal>(EMPTY_DEAL);
  const parsed = dealBody(deal);
  return (
    <CompanyLookupDialog
      open={open}
      onOpenChange={onOpenChange}
      endpoint="/api/portfolio"
      title="Add a portfolio company"
      noun="company"
      initial={initial}
      extra={<DealFields deal={deal} onChange={setDeal} />}
      extraBody={"body" in parsed ? parsed.body : undefined}
      validateExtra={() => ("error" in parsed ? parsed.error : null)}
      onReset={() => setDeal(EMPTY_DEAL)}
      onSaved={() => {
        onSaved?.();
        router.refresh();
      }}
    />
  );
}

export function AddCompanyButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> Add company
      </Button>
      <AddCompanyDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

// -- edit / remove --------------------------------------------------------------

function EditCompanyDialog({ company, onOpenChange }: { company: PortfolioCompany | null; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={!!company} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {company?.name}</DialogTitle>
          <DialogDescription>Profile values you change are saved as your own entry, without sources.</DialogDescription>
        </DialogHeader>
        {company && <EditForm key={company.id} company={company} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({ company, onDone }: { company: PortfolioCompany; onDone: () => void }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(() => valuesOf(company));
  const [deal, setDeal] = useState<Deal>(() => dealOf(company));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!values.name.trim()) return setError("Give the company a name.");
    const parsed = dealBody(deal);
    if ("error" in parsed) return setError(parsed.error);
    setBusy(true);
    try {
      await api(`/api/portfolio/${company.id}`, { method: "PATCH", body: JSON.stringify({ ...values, ...parsed.body }) });
      toast.success("Saved");
      onDone();
      router.refresh();
    } catch (err) {
      setError(plainError(err, "Could not save."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <StartupForm values={values} onChange={setValues} sources={company.sources} />
      <DealFields deal={deal} onChange={setDeal} />
      {error && <p className="text-[13px] text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} Save changes
        </Button>
      </DialogFooter>
    </form>
  );
}

function RemoveDialog({ company, onOpenChange }: { company: PortfolioCompany | null; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (!company) return;
    setBusy(true);
    try {
      await api(`/api/portfolio/${company.id}`, { method: "DELETE" });
      toast.success(`${company.name} removed`);
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(plainError(err, "Could not remove."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={!!company} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Remove {company?.name}?</DialogTitle>
          <DialogDescription>
            This removes it from your portfolio with your investment details, and stops tracking changes on it. It cannot be undone. Its verified record
            is not affected.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={remove} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -- table ------------------------------------------------------------------------

function formatFuzzy(text: string) {
  if (!text) return "";
  return formatFuzzyDate({ date: text, precision: text.length === 4 ? "year" : text.length === 7 ? "month" : "day" });
}

/** The page polls (InsightsPoller) while one-click adds fill in and analyses run. */
export function PortfolioTable({ companies, analyses = {} }: { companies: PortfolioCompany[]; analyses?: AnalysisIndex }) {
  const [editing, setEditing] = useState<PortfolioCompany | null>(null);
  const [removing, setRemoving] = useState<PortfolioCompany | null>(null);

  if (!companies.length)
    return (
      <EmptyState
        icon={Building2}
        title="No portfolio companies yet"
        description="Add them from the suggestions above, look one up by name or website, or enter the details yourself."
        action={<AddCompanyButton />}
      />
    );

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Company</th>
              <th className="py-2 pr-4 font-medium">Stage</th>
              <th className="py-2 pr-4 font-medium">Invested</th>
              <th className="py-2 pr-4 font-medium">Entry</th>
              <th className="py-2 pr-4 font-medium">Since you invested</th>
              <th className="py-2 pr-4 text-right font-medium">Ownership</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="w-10 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {companies.map((c) => {
              const busy = c.enrichment.status === "pending" || c.enrichment.status === "processing";
              const sub = [c.industry, c.headquarters].filter(Boolean).join(" · ");
              return (
                <tr key={c.id} className="align-top">
                  <td className="py-3 pr-4">
                    <div className="flex items-start gap-3">
                      <EntityAvatar name={c.name} size="sm" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {c.calaCompanyId ? (
                            <Link href={`/company/${c.calaCompanyId}`} className="font-medium hover:text-primary">
                              {c.name}
                            </Link>
                          ) : (
                            <span className="font-medium">{c.name}</span>
                          )}
                          {c.boardSeat && <Pill tone="teal">Board</Pill>}
                          {busy && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Loader2 className="size-3 animate-spin" /> Filling in from records
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{sub || c.domain || (c.calaCompanyId ? "Verified record" : "Added by hand")}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="inline-flex items-center gap-1.5">
                      {c.stage || <span className="text-subtle">—</span>}
                      {c.sources.stage && <SourceChip sources={c.sources.stage} />}
                    </span>
                  </td>
                  <td className="py-3 pr-4 tabular">
                    {c.investedAmount !== null ? formatMoney({ amount: c.investedAmount, currency: c.currency }) : <span className="text-subtle">—</span>}
                  </td>
                  <td className="py-3 pr-4 text-[13px]">
                    {[c.entryRound, formatFuzzy(c.investedOn)].filter(Boolean).join(" · ") || <span className="text-subtle">—</span>}
                  </td>
                  <td className="max-w-64 py-3 pr-4">
                    <SinceInvested company={c} analysis={analyses[c.id]?.rounds} />
                  </td>
                  <td className="py-3 pr-4 text-right tabular">{c.ownership !== null ? `${c.ownership}%` : <span className="text-subtle">—</span>}</td>
                  <td className="py-3 pr-4">
                    <Pill tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Pill>
                  </td>
                  <td className="py-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${c.name}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditing(c)}>
                          <Pencil /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setRemoving(c)}>
                          <Trash2 /> Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <EditCompanyDialog company={editing} onOpenChange={(o) => !o && setEditing(null)} />
      <RemoveDialog company={removing} onOpenChange={(o) => !o && setRemoving(null)} />
    </>
  );
}

// -- suggestions from Cala -----------------------------------------------------

const SHOWN = 8;

export function SuggestionsPanel({ initial, error }: { initial: PortfolioSuggestions | null; error: string | null }) {
  const router = useRouter();
  const [data, setData] = useState<PortfolioSuggestions | null>(initial);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [reviewing, setReviewing] = useState<CalaCandidate | null>(null);
  const [linking, setLinking] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const mark = (id: string, on: boolean) =>
    setBusy((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  const drop = (id: string) => setData((d) => (d ? { ...d, results: d.results.filter((r) => r.id !== id) } : d));

  async function add(s: PortfolioSuggestion, quiet = false) {
    mark(s.id, true);
    try {
      await api("/api/portfolio/lookup", { method: "POST", body: JSON.stringify({ calaId: s.id, name: s.name, quick: true }) });
      drop(s.id);
      if (!quiet) toast.success(`${s.name} added. Filling in its profile from verified records.`);
      return true;
    } catch (err) {
      toast.error(plainError(err, `Could not add ${s.name}.`));
      return false;
    } finally {
      mark(s.id, false);
    }
  }

  async function addAll() {
    const list = data?.results ?? [];
    let n = 0;
    for (const s of list) if (await add(s, true)) n++;
    if (n) toast.success(`${n} ${n === 1 ? "company" : "companies"} added. Filling in their profiles from verified records.`);
    router.refresh();
  }

  async function dismiss(s: PortfolioSuggestion) {
    mark(s.id, true);
    try {
      await api("/api/portfolio/dismiss", { method: "POST", body: JSON.stringify({ calaId: s.id, name: s.name }) });
      drop(s.id);
    } catch (err) {
      toast.error(plainError(err, "Could not dismiss."));
    } finally {
      mark(s.id, false);
    }
  }

  if (!data?.fund)
    return (
      <Panel
        className="mb-6"
        title="Suggested from records"
        description="Link your fund and we list the companies with a sourced investment from it on record. Confirm the ones that are yours."
      >
        {error && <p className="mb-3 text-[13px] text-destructive">{error}</p>}
        <FundPicker
          onLinked={(next) => {
            setData(next);
            router.refresh();
          }}
        />
      </Panel>
    );

  return (
    <Panel
      className="mb-6"
      title="Suggested from records"
      description={
        <>
          Companies the records say <span className="font-medium text-foreground">{data.fund.name}</span> invested in. Add the ones that are yours; dismiss the
          rest.
        </>
      }
      action={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setLinking(true)}>
            <Link2 /> Change fund
          </Button>
          {data.results.length > 1 && (
            <Button size="sm" variant="outline" className="bg-card" onClick={addAll} disabled={busy.size > 0}>
              <Check /> Add all {data.results.length}
            </Button>
          )}
        </div>
      }
    >
      {linking ? (
        <FundPicker
          onCancel={() => setLinking(false)}
          onLinked={(next) => {
            setData(next);
            setLinking(false);
            router.refresh();
          }}
        />
      ) : data.results.length ? (
        <ul className="divide-y rounded-lg border">
          {(showAll ? data.results : data.results.slice(0, SHOWN)).map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
              <EntityAvatar name={s.name} size="sm" />
              <div className="min-w-0 flex-1">
                <Link href={`/company/${s.id}`} className="text-sm font-medium hover:text-primary">
                  {s.name}
                </Link>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {s.firstReported ? `First reported ${formatDay(s.firstReported)}` : "Report date not on record"}
                  <SourceChip sources={s.sources} />
                </div>
              </div>
              {busy.has(s.id) && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              <Button size="sm" variant="ghost" disabled={busy.has(s.id)} onClick={() => dismiss(s)} aria-label={`Dismiss ${s.name}`}>
                <X /> Not ours
              </Button>
              <Button size="sm" variant="outline" className="bg-card" disabled={busy.has(s.id)} onClick={() => setReviewing({ id: s.id, name: s.name, description: "", domain: "", headquarters: "", founded: "" })}>
                Review
              </Button>
              <Button
                size="sm"
                disabled={busy.has(s.id)}
                onClick={async () => {
                  if (await add(s)) router.refresh();
                }}
              >
                <Plus /> Add
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          All caught up: every company on record for {data.fund.name} is in your portfolio or dismissed.
        </p>
      )}
      {!linking && data.results.length > SHOWN && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-[13px] text-muted-foreground hover:text-foreground">
          {showAll ? "Show fewer" : `Show all ${data.results.length}`}
        </button>
      )}
      {data.capped && <p className="mt-2 text-xs text-subtle">Showing the first 100 companies on record for this fund.</p>}
      <AddCompanyDialog
        open={!!reviewing}
        initial={reviewing}
        onSaved={() => reviewing && drop(reviewing.id)}
        onOpenChange={(o) => !o && setReviewing(null)}
      />
    </Panel>
  );
}

function FundPicker({ onLinked, onCancel }: { onLinked: (s: PortfolioSuggestions) => void; onCancel?: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CalaCandidate[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("search");
    try {
      const { results } = await api<{ results: CalaCandidate[] }>(`/api/startups/search?${new URLSearchParams({ q: q.trim() })}`);
      setResults(results);
    } catch (err) {
      setError(plainError(err, "Could not search the records."));
    } finally {
      setBusy(null);
    }
  }

  async function link(c: CalaCandidate) {
    setError(null);
    setBusy(c.id);
    try {
      onLinked(await api<PortfolioSuggestions>("/api/portfolio/fund", { method: "PUT", body: JSON.stringify({ calaId: c.id }) }));
      toast.success(`Linked ${c.name}`);
    } catch (err) {
      setError(plainError(err, "Could not link the fund."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={search} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Your fund's name, e.g. Lifeline Ventures" className="pl-8" aria-label="Fund name" />
        </div>
        <Button type="submit" variant="outline" className="bg-card" disabled={q.trim().length < 2 || !!busy}>
          {busy === "search" ? <Loader2 className="animate-spin" /> : <Sparkles />} Find fund
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </form>
      {error && <p className="text-[13px] text-destructive">{error}</p>}
      {results &&
        (results.length ? (
          <ul className="max-h-72 space-y-1.5 overflow-y-auto">
            {results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => link(c)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 disabled:opacity-60",
                  )}
                >
                  <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {c.name} {busy === c.id && <Loader2 className="size-3.5 animate-spin text-primary" />}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[c.domain || "No website on record", c.headquarters, c.founded && `Founded ${c.founded}`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">No company on record is named “{q}”. Try another spelling.</p>
        ))}
    </div>
  );
}
