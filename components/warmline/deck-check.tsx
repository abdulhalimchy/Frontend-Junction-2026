"use client";

import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Copy,
  FileText,
  History,
  Loader2,
  RotateCw,
  Trash2,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDay } from "@/lib/format";
import type { ClaimStatus, DeckCheckResult, DeckCheckSummary, DeckClaim } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ClaimBadge, Pill } from "./badges";
import { SourceChip } from "./source-chip";

const POLL_MS = 2000;
const MAX_BYTES = 20 * 1024 * 1024; // keep in step with the backend's DECK_CHECK_MAX_UPLOAD_MB
const HISTORY_PREVIEW = 4; // rows shown before "Show all"

const isRunning = (s: { status: DeckCheckResult["status"] }) => s.status === "pending" || s.status === "processing";

/** The history row for a full result: the same check without its claims. */
function summarize(r: DeckCheckResult): DeckCheckSummary {
  const { claims, ...rest } = r;
  const n = (st: ClaimStatus) => claims.filter((c) => c.status === st).length;
  return { ...rest, counts: { confirmed: n("confirmed"), differs: n("differs"), cant_verify: n("cant_verify") } };
}

async function api<T>(url: string, init: RequestInit, fallback: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? fallback);
  return body as T;
}

/**
 * Deck check UI. Uploads the PDF to the backend (via /api/deck-checks), then polls until the check finishes.
 * The backend reads the deck, matches each claim against Cala and stores confirmed / differs / can't verify.
 * Every past check stays in the history: a founder's earlier versions of the deck, an investor's other decks.
 */
export function DeckCheck({
  initial,
  history: initialHistory = [],
  companyName = "",
  loadError = null,
  startupId = null,
  founder = false,
}: {
  /** The check to show first: the newest, or the one named in the URL (?check=). */
  initial: DeckCheckResult | null;
  /** Every past check, newest first. */
  history?: DeckCheckSummary[];
  /** Hint for finding the company in Cala. Empty for investors: the name is then read from the deck. */
  companyName?: string;
  loadError?: string | null;
  /** The founder's startup the deck is for; null for the demo company and investors. */
  startupId?: string | null;
  /** The founder checking their own deck: adds what to fix before sharing it. */
  founder?: boolean;
}) {
  const [result, setResult] = useState<DeckCheckResult | null>(initial);
  const [history, setHistory] = useState<DeckCheckSummary[]>(initialHistory);
  const [uploading, setUploading] = useState<string | null>(null); // file name while the upload is in flight
  const [opening, setOpening] = useState<string | null>(null); // history row being loaded
  const [error, setError] = useState<string | null>(loadError);
  const [dragging, setDragging] = useState(false);
  const [toDelete, setToDelete] = useState<DeckCheckSummary | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const wanted = useRef<string | null>(null); // the last history row asked for; older answers are dropped

  /** Store a fresh result: in the history, and on screen when it is the check being viewed (or `show`). */
  function store(r: DeckCheckResult, show = false) {
    setHistory((h) => (h.some((x) => x.id === r.id) ? h.map((x) => (x.id === r.id ? summarize(r) : x)) : [summarize(r), ...h]));
    setResult((cur) => (show || cur?.id === r.id ? r : cur));
  }

  // Keep the viewed check in the URL so a reload or a shared link opens the same one. The newest needs no parameter.
  function remember(id: string | null, newestId: string | undefined) {
    const url = new URL(window.location.href);
    if (id && id !== newestId) url.searchParams.set("check", id);
    else url.searchParams.delete("check");
    window.history.replaceState(null, "", url);
  }

  // Poll whichever check is still running, also when an older one is on screen.
  const runningId = history.find(isRunning)?.id ?? (result && isRunning(result) ? result.id : undefined);
  useEffect(() => {
    if (!runningId) return;
    let stop = false;
    const timer = setInterval(async () => {
      try {
        const body = await api<DeckCheckResult>(`/api/deck-checks/${runningId}`, {}, "Could not load the result.");
        if (!stop) store(body);
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : "Could not load the result.");
      }
    }, POLL_MS);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [runningId]);

  async function upload(file: File) {
    setError(null);
    if (!file.name.toLowerCase().endsWith(".pdf")) return setError("Only PDF files are supported. Export your slides to PDF first.");
    if (file.size > MAX_BYTES) return setError("That file is larger than 20 MB.");
    setUploading(file.name);
    try {
      const form = new FormData();
      form.append("file", file);
      if (companyName) form.append("company_name", companyName);
      if (startupId) form.append("startup", startupId);
      const body = await api<DeckCheckResult>("/api/deck-checks", { method: "POST", body: form }, "Upload failed.");
      wanted.current = body.id;
      store(body, true);
      remember(null, undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(null);
      if (input.current) input.current.value = "";
    }
  }

  async function retry() {
    if (!result) return;
    setError(null);
    try {
      store(await api<DeckCheckResult>(`/api/deck-checks/${result.id}/retry`, { method: "POST" }, "Could not retry."));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not retry.");
    }
  }

  /** Show a check from the history. */
  async function open(id: string) {
    if (id === result?.id) return;
    setError(null);
    wanted.current = id;
    setOpening(id);
    try {
      const body = await api<DeckCheckResult>(`/api/deck-checks/${id}`, {}, "Could not load that check.");
      if (wanted.current !== id) return;
      store(body, true);
      remember(id, history[0]?.id);
    } catch (e) {
      if (wanted.current === id) setError(e instanceof Error ? e.message : "Could not load that check.");
    } finally {
      setOpening((cur) => (cur === id ? null : cur));
    }
  }

  async function remove(item: DeckCheckSummary) {
    setError(null);
    try {
      await api<null>(`/api/deck-checks/${item.id}`, { method: "DELETE" }, "Could not delete that check.");
      const rest = history.filter((h) => h.id !== item.id);
      setHistory(rest);
      setToDelete(null);
      if (result?.id !== item.id) return;
      // The check on screen is gone: fall back to the newest one left.
      setResult(null);
      remember(null, undefined);
      if (rest[0]) await open(rest[0].id);
    } catch (e) {
      setToDelete(null);
      setError(e instanceof Error ? e.message : "Could not delete that check.");
    }
  }

  const running = !!result && isRunning(result);
  const busy = uploading !== null || running;
  const done = result?.status === "completed";
  const failed = result?.status === "failed";
  const empty = !result && !uploading;
  const newest = history[0]?.id;
  const older = !!result && !!newest && result.id !== newest && !uploading;

  // What the viewed check is compared with: the founder's previous version, or an investor's earlier check of
  // the same company.
  const at = result ? history.findIndex((h) => h.id === result.id) : -1;
  const company = result?.companyName.trim().toLowerCase();
  const previous =
    at < 0
      ? null
      : (history.slice(at + 1).find((h) => h.status === "completed" && (founder || (!!company && h.companyName.trim().toLowerCase() === company))) ?? null);

  return (
    <div className="space-y-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f && !busy) upload(f);
        }}
        className={cn(
          "relative overflow-hidden rounded-xl border bg-card transition-colors",
          empty && "border-dashed",
          dragging && "border-primary bg-brand-soft/50",
        )}
      >
        <input ref={input} type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        {empty ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-brand-soft">
              <Upload className="size-5 text-primary" />
            </div>
            <p className="mt-4 text-[15px] font-semibold">{founder ? "Drop your pitch deck (PDF)" : "Drop a pitch deck (PDF)"}</p>
            <p className="mt-1 max-w-md text-[13px] text-muted-foreground">
              We pull out each factual claim and check it against verified sources. The file stays private to you.
            </p>
            <Button className="mt-5" onClick={() => input.current?.click()}>
              Choose PDF
            </Button>
            <ul className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              {[...STATUS_ORDER].reverse().map((st) => (
                <li key={st} className="flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-full", TONE[st].dot)} />
                  <span className="font-medium text-foreground">{TONE[st].label}</span>
                  {TONE[st].hint}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4 sm:p-5">
            <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", failed ? "bg-destructive/10 text-destructive" : "bg-brand-soft text-primary")}>
              <FileText className="size-5" />
            </div>
            <div className="min-w-0 flex-1 basis-48">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold">{uploading ?? result?.fileName}</span>
                {older && <Pill tone="warning">Older check</Pill>}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {uploading ? (
                  "Uploading…"
                ) : running ? (
                  "Reading the deck and checking each claim against verified sources. This can take a minute…"
                ) : failed ? (
                  "Check failed"
                ) : (
                  <>
                    {result?.companyName && <span className="font-medium text-foreground">{result.companyName}</span>}
                    {result?.companyName && " · "}
                    {result?.pages ? `${result.pages} pages · ` : ""}checked {formatDay(result!.checkedAt)}
                  </>
                )}
              </div>
            </div>
            {busy ? (
              <Loader2 className="size-5 shrink-0 animate-spin text-primary" />
            ) : (
              <div className="flex shrink-0 items-center gap-2">
                {older && newest && (
                  <Button variant="ghost" size="sm" onClick={() => open(newest)}>
                    Back to latest
                  </Button>
                )}
                <Button variant="outline" size="sm" className="bg-card" onClick={() => input.current?.click()}>
                  <Upload /> {founder ? "Upload new version" : "Check another deck"}
                </Button>
              </div>
            )}
          </div>
        )}
        {busy && (
          <div className="h-0.5 w-full overflow-hidden bg-brand-soft" role="progressbar" aria-label="Checking the deck">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
          </div>
        )}
      </div>

      {(error || (failed && result?.error)) && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p className="min-w-0 flex-1">{error ?? result?.error}</p>
          {failed && !error && (
            <Button variant="outline" size="sm" className="bg-card" onClick={retry}>
              <RotateCw /> Retry
            </Button>
          )}
        </div>
      )}

      {/* From the first check on, so even a single check can be deleted. */}
      {history.length > 0 && (
        <HistoryList items={history} viewing={result?.id ?? null} opening={opening} founder={founder} onOpen={open} onDelete={setToDelete} />
      )}

      {done && result && <Results key={result.id} result={result} previous={previous} founder={founder} />}

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this check?</DialogTitle>
            <DialogDescription>
              “{toDelete?.fileName}”, checked {toDelete && formatDay(toDelete.checkedAt)}. The uploaded file and its claims are removed for good.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => toDelete && remove(toDelete)}>
              <Trash2 /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const STATUS_ORDER: ClaimStatus[] = ["differs", "cant_verify", "confirmed"];
const FILTER_LABEL = { all: "All", confirmed: "Confirmed", differs: "Differs", cant_verify: "Can't verify" } as const;
const TONE: Record<ClaimStatus, { label: string; hint: string; icon: LucideIcon; dot: string; text: string; soft: string }> = {
  confirmed: { label: "Confirmed", hint: "matches a sourced record", icon: CircleCheck, dot: "bg-success", text: "text-success", soft: "bg-success-soft" },
  differs: { label: "Differs from record", hint: "a source says something else", icon: CircleAlert, dot: "bg-warning", text: "text-warning", soft: "bg-warning-soft" },
  cant_verify: { label: "Can't verify", hint: "not on record; this does not mean false", icon: CircleHelp, dot: "bg-subtle", text: "text-muted-foreground", soft: "bg-muted" },
};

/** Day and time in the reader's own time zone, so the server's rendering is allowed to differ. */
function When({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
    </time>
  );
}

/** Proportions of the three verdicts as one bar. */
function VerdictBar({ counts, className }: { counts: Record<ClaimStatus, number>; className?: string }) {
  const total = counts.confirmed + counts.differs + counts.cant_verify;
  return (
    <span className={cn("flex h-1.5 gap-px overflow-hidden rounded-full bg-muted", className)} aria-hidden>
      {total > 0 &&
        (["confirmed", "differs", "cant_verify"] as const).map((st) => counts[st] > 0 && <span key={st} className={TONE[st].dot} style={{ flexGrow: counts[st] }} />)}
    </span>
  );
}

/** Past checks, newest first: a founder's earlier versions of the deck, an investor's other decks. */
function HistoryList({
  items,
  viewing,
  opening,
  founder,
  onOpen,
  onDelete,
}: {
  items: DeckCheckSummary[];
  viewing: string | null;
  opening: string | null;
  founder: boolean;
  onOpen: (id: string) => void;
  onDelete: (item: DeckCheckSummary) => void;
}) {
  const [all, setAll] = useState(false);
  // Never hide the row on screen behind "Show all".
  const at = items.findIndex((h) => h.id === viewing);
  const shown = all || at >= HISTORY_PREVIEW ? items : items.slice(0, HISTORY_PREVIEW);

  return (
    <section aria-label={founder ? "Deck versions" : "Pitch deck history"} className="rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-3 px-5 py-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <History className="size-4 text-muted-foreground" />
          {founder ? "Versions" : "History"}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground tabular">{items.length}</span>
        </h2>
        <p className="hidden text-xs text-muted-foreground sm:block">
          {founder ? "Every version you checked. Open one to compare." : "Every deck you checked. Open one to see its claims again."}
        </p>
      </div>
      <ul className="max-h-[21rem] overflow-y-auto border-t">
        {shown.map((h) => {
          const active = h.id === viewing;
          const version = items.length - items.indexOf(h);
          return (
            <li key={h.id} className={cn("group relative flex items-center border-b last:border-0", active ? "bg-brand-soft/60" : "hover:bg-muted/50")}>
              {active && <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" />}
              <button
                type="button"
                onClick={() => onOpen(h.id)}
                aria-current={active ? "true" : undefined}
                className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-2 pl-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
              >
                {founder && <span className="w-7 shrink-0 text-xs font-medium text-muted-foreground tabular">v{version}</span>}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium">{founder ? h.fileName : h.companyName || h.fileName}</span>
                    {h === items[0] && <Pill tone="brand">Latest</Pill>}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {!founder && h.companyName && `${h.fileName} · `}
                    <When iso={h.checkedAt} />
                  </span>
                </span>
                {opening === h.id ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                ) : isRunning(h) ? (
                  <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin text-primary" /> Checking…
                  </span>
                ) : h.status === "failed" ? (
                  <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-destructive/10 px-2 text-[11px] font-medium text-destructive">Failed</span>
                ) : (
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="hidden items-center gap-2.5 text-xs tabular sm:flex">
                      {(["confirmed", "differs", "cant_verify"] as const).map((st) => (
                        <span key={st} className="flex items-center gap-1" title={`${h.counts[st]} ${TONE[st].label.toLowerCase()}`}>
                          <span className={cn("size-1.5 rounded-full", TONE[st].dot)} />
                          <span className={cn("font-medium", st === "differs" && h.counts.differs > 0 && "text-warning")}>{h.counts[st]}</span>
                        </span>
                      ))}
                    </span>
                    <VerdictBar counts={h.counts} className="w-16" />
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => onDelete(h)}
                disabled={isRunning(h)}
                aria-label={`Delete the check of ${h.fileName}`}
                title="Delete this check"
                className="mr-3 flex size-7 shrink-0 items-center justify-center rounded-md text-subtle outline-none hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
      {items.length > HISTORY_PREVIEW && at < HISTORY_PREVIEW && (
        <button
          type="button"
          onClick={() => setAll(!all)}
          className="flex w-full items-center justify-center gap-1 rounded-b-xl border-t py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        >
          {all ? "Show fewer" : `Show all ${items.length}`}
          <ChevronDown className={cn("size-3.5 transition-transform", all && "rotate-180")} />
        </button>
      )}
    </section>
  );
}

/** The verdict overview, a slide strip to narrow by slide, and every claim next to what the sources say. */
function Results({ result, previous, founder }: { result: DeckCheckResult; previous: DeckCheckSummary | null; founder: boolean }) {
  const [filter, setFilter] = useState<"all" | ClaimStatus>("all");
  const [slide, setSlide] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const total = result.claims.length;
  const counts = summarize(result).counts;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  // Every slide of the deck, each marked with its most pressing claim status (differs first).
  const lastSlide = Math.max(result.pages ?? 0, ...result.claims.map((c) => c.slide));
  const slides = Array.from({ length: lastSlide }, (_, i) => {
    const onSlide = result.claims.filter((c) => c.slide === i + 1);
    return { n: i + 1, count: onSlide.length, worst: STATUS_ORDER.find((st) => onSlide.some((c) => c.status === st)) ?? null };
  });
  const claims = result.claims
    .filter((c) => (filter === "all" || c.status === filter) && (slide === null || c.slide === slide))
    .sort((a, b) => a.slide - b.slide || STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
  const bySlide = new Map<number, DeckClaim[]>();
  for (const c of claims) bySlide.set(c.slide, [...(bySlide.get(c.slide) ?? []), c]);
  const open = counts.differs + counts.cant_verify;

  // The claims that need a conversation, as plain text for an email or a notes doc.
  async function copyFollowUps() {
    const lines = [`Pitch deck check: ${result.fileName}${result.companyName ? ` (${result.companyName})` : ""}, checked ${formatDay(result.checkedAt)}`];
    for (const st of ["differs", "cant_verify"] as const) {
      const list = result.claims.filter((c) => c.status === st).sort((a, b) => a.slide - b.slide);
      if (!list.length) continue;
      lines.push("", `${TONE[st].label} (${list.length})`);
      for (const c of list) lines.push(`- Slide ${c.slide}: “${c.claim}”${c.onRecord ? ` On record: ${c.onRecord}` : ""}`);
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked by the browser: nothing to copy to.
    }
  }

  return (
    <>
      <section aria-label="Verdict" className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-sm text-muted-foreground">
            <span className="text-2xl font-semibold text-foreground tabular">{total}</span> claims checked
            {lastSlide > 0 && ` across ${lastSlide} slides`}
          </p>
          {previous && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>
                Since the {founder ? "previous version" : "previous check"} (<When iso={previous.checkedAt} />)
              </span>
              {(["differs", "confirmed"] as const).map((st) => (
                <span key={st} className="flex items-center gap-1 tabular">
                  <span className={cn("size-1.5 rounded-full", TONE[st].dot)} />
                  {previous.counts[st]}
                  <ArrowRight className="size-3" />
                  <span className="font-medium text-foreground">{counts[st]}</span>
                </span>
              ))}
            </p>
          )}
        </div>
        <VerdictBar counts={counts} className="mt-4 h-2" />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(["confirmed", "differs", "cant_verify"] as const).map((st) => {
            const t = TONE[st];
            const active = filter === st;
            return (
              <button
                key={st}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(active ? "all" : st)}
                title={active ? "Show all claims" : `Show only ${t.label.toLowerCase()} claims`}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  active ? "border-primary/40 bg-brand-soft/50" : "hover:border-primary/30 hover:bg-muted/40",
                )}
              >
                <span className="flex items-center gap-1.5 text-xs font-medium">
                  <t.icon className={cn("size-3.5", t.text)} />
                  {t.label}
                </span>
                <span className="mt-1.5 flex items-baseline gap-2">
                  <span className={cn("text-2xl font-semibold tabular", st === "cant_verify" ? "text-foreground" : t.text)}>{counts[st]}</span>
                  <span className="text-xs text-muted-foreground tabular">{pct(counts[st])}%</span>
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground first-letter:uppercase">{t.hint}</span>
              </button>
            );
          })}
        </div>
      </section>

      {founder && total > 0 && (
        <div className={cn("flex flex-wrap items-start gap-4 rounded-xl border p-5", counts.differs ? "border-warning/30 bg-warning-soft/50" : "bg-card")}>
          <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", counts.differs ? "bg-card text-warning" : "bg-brand-soft text-primary")}>
            {counts.differs ? <CircleAlert className="size-5" /> : <CircleCheck className="size-5" />}
          </div>
          <div className="min-w-0 flex-1 basis-64">
            <p className="text-[15px] font-semibold">
              {counts.differs
                ? `Fix ${counts.differs} claim${counts.differs === 1 ? "" : "s"} before investors see this deck`
                : "Nothing in this deck contradicts the record"}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {counts.differs
                ? "Investors check decks against the same records. Change the slide to match, or, if the record is wrong, correct it at the source and upload the deck again."
                : "Every claim that could be checked matches a sourced record."}
              {counts.cant_verify > 0 && ` ${counts.cant_verify} claim${counts.cant_verify === 1 ? " has" : "s have"} no public source; keep the evidence at hand.`}
            </p>
          </div>
          {counts.differs > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 bg-card"
              onClick={() => {
                setFilter("differs");
                setSlide(null);
              }}
            >
              Show the {counts.differs}
            </Button>
          )}
        </div>
      )}

      <section aria-label="Claims" className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <h2 className="text-[15px] font-semibold">
            Claims{slide !== null && <span className="font-normal text-muted-foreground"> · slide {slide}</span>}
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground tabular">{claims.length}</span>
          </h2>
          <div className="flex flex-wrap items-center gap-1">
            {(["all", "differs", "cant_verify", "confirmed"] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={cn("rounded-md px-2.5 py-1 text-xs font-medium", filter === f ? "bg-brand-soft text-accent-foreground" : "text-muted-foreground hover:bg-muted")}
              >
                {FILTER_LABEL[f]}
              </button>
            ))}
            {open > 0 && (
              <Button variant="outline" size="sm" className="ml-2 bg-card" onClick={copyFollowUps} title="Copy the claims that differ or can't be verified, as text">
                {copied ? <Check /> : <Copy />} {copied ? "Copied" : founder ? "Copy fix list" : "Copy follow-ups"}
              </Button>
            )}
          </div>
        </div>

        <nav aria-label="Slides" className="flex flex-wrap items-center gap-1.5 border-t bg-muted/30 px-5 py-2.5">
          <span className="mr-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Slides</span>
          <SlideChip active={slide === null} onClick={() => setSlide(null)} label="All" title={`All slides · ${total} claims`} />
          {slides.map((sl) => (
            <SlideChip
              key={sl.n}
              active={slide === sl.n}
              onClick={() => setSlide(slide === sl.n ? null : sl.n)}
              label={String(sl.n)}
              title={`Slide ${sl.n} · ${sl.count ? `${sl.count} claim${sl.count === 1 ? "" : "s"}` : "no claims"}`}
              dot={sl.worst ? TONE[sl.worst].dot : undefined}
              disabled={!sl.count}
            />
          ))}
        </nav>

        {claims.length ? (
          [...bySlide].map(([n, list]) => (
            <div key={n} className="border-t">
              {slide === null && (
                <button
                  type="button"
                  onClick={() => setSlide(n)}
                  title="Show only this slide"
                  className="flex w-full items-center gap-2 px-5 pt-3 text-left text-[11px] font-medium tracking-wide text-muted-foreground uppercase hover:text-primary"
                >
                  Slide {n}
                  <span className="font-normal normal-case">
                    {list.length} claim{list.length === 1 ? "" : "s"}
                  </span>
                </button>
              )}
              <ul className="divide-y divide-border/60">
                {list.map((c) => (
                  <Claim key={c.id} claim={c} founder={founder} />
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p className="border-t px-5 py-10 text-center text-sm text-muted-foreground">No claims match. Pick another slide or status.</p>
        )}
      </section>
    </>
  );
}

const BASIS = { record: "Verified record", web: "Web sources" } as const;

/** One claim from the deck, next to what the sources say about it. */
function Claim({ claim: c, founder }: { claim: DeckClaim; founder: boolean }) {
  const t = TONE[c.status];
  return (
    <li className="flex gap-3 px-5 py-3.5">
      <t.icon className={cn("mt-0.5 size-4 shrink-0", c.status === "cant_verify" ? "text-subtle" : t.text)} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <p className="min-w-0 flex-1 basis-64 text-sm font-medium">“{c.claim}”</p>
          <ClaimBadge status={c.status} />
        </div>
        {c.status === "differs" && c.onRecord ? (
          <div className="mt-2 rounded-lg border border-warning/25 bg-warning-soft/50 px-3 py-2 text-[13px]">
            <span className="mr-2 text-[11px] font-semibold tracking-wide text-warning uppercase">On record</span>
            {c.onRecord}
          </div>
        ) : c.onRecord ? (
          <p className="mt-1 text-[13px] text-muted-foreground">
            <span className="font-medium text-foreground">On record:</span> {c.onRecord}
          </p>
        ) : (
          c.status === "cant_verify" && (
            <p className="mt-1 text-[13px] text-muted-foreground italic">No source on record.{founder ? " Be ready to back this up." : " Ask for evidence."}</p>
          )
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-subtle">
          <span className="capitalize">{c.category}</span>
          {c.basis && c.status !== "cant_verify" && (
            <>
              <span aria-hidden>·</span>
              <span>{BASIS[c.basis]}</span>
            </>
          )}
          {c.sources.length > 0 && <SourceChip sources={c.sources} />}
        </div>
      </div>
    </li>
  );
}

function SlideChip({ active, onClick, label, title, dot, disabled }: { active: boolean; onClick: () => void; label: string; title: string; dot?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        "relative flex h-7 min-w-7 items-center justify-center rounded-md border px-2 text-xs font-medium tabular outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        active ? "border-primary/50 bg-brand-soft text-accent-foreground" : "bg-card hover:border-primary/30",
        disabled && "border-transparent bg-transparent text-subtle hover:border-transparent",
      )}
    >
      {label}
      {dot && <span className={cn("absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2 ring-card", dot)} />}
    </button>
  );
}
