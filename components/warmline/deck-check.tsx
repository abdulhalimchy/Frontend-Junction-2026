"use client";

import { AlertCircle, CircleAlert, CircleCheck, CircleHelp, FileText, Loader2, RotateCw, Upload, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDay } from "@/lib/format";
import type { ClaimStatus, DeckCheckResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ClaimBadge } from "./badges";
import { SourceChip } from "./source-chip";

const POLL_MS = 2000;
const MAX_BYTES = 20 * 1024 * 1024; // keep in step with the backend's DECK_CHECK_MAX_UPLOAD_MB

/**
 * Deck check UI. Uploads the PDF to the backend (via /api/deck-checks), then polls until the check finishes.
 * The backend reads the deck, matches each claim against Cala and stores confirmed / differs / can't verify.
 */
export function DeckCheck({
  initial,
  companyName = "",
  loadError = null,
  startupId = null,
  founder = false,
}: {
  initial: DeckCheckResult | null;
  /** Hint for finding the company in Cala. Empty for investors: the name is then read from the deck. */
  companyName?: string;
  loadError?: string | null;
  /** The founder's startup the deck is for; null for the demo company and investors. */
  startupId?: string | null;
  /** The founder checking their own deck: adds what to fix before sharing it. */
  founder?: boolean;
}) {
  const [result, setResult] = useState<DeckCheckResult | null>(initial);
  const [uploading, setUploading] = useState<string | null>(null); // file name while the upload is in flight
  const [error, setError] = useState<string | null>(loadError);
  const input = useRef<HTMLInputElement>(null);

  const running = result?.status === "pending" || result?.status === "processing";
  const id = result?.id;

  useEffect(() => {
    if (!running || !id) return;
    let stop = false;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/deck-checks/${id}`, { cache: "no-store" });
        const body = await res.json();
        if (stop) return;
        if (!res.ok) throw new Error(body.error ?? "Could not load the result.");
        setResult(body);
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : "Could not load the result.");
      }
    }, POLL_MS);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [running, id]);

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
      const res = await fetch("/api/deck-checks", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Upload failed.");
      setResult(body);
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
      const res = await fetch(`/api/deck-checks/${result.id}/retry`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not retry.");
      setResult(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not retry.");
    }
  }

  const busy = uploading !== null || running;
  const done = result?.status === "completed";
  const failed = result?.status === "failed";
  const empty = !result && !uploading;


  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f && !busy) upload(f);
        }}
        className={cn("flex items-center gap-4 rounded-xl border border-dashed bg-card p-5", empty && "flex-col justify-center py-12 text-center")}
      >
        <input ref={input} type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        {empty ? (
          <>
            <div className="flex size-11 items-center justify-center rounded-full bg-teal-soft">
              <Upload className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Drop a pitch deck (PDF)</p>
              <p className="mt-1 text-[13px] text-muted-foreground">We extract each factual claim and check it against verified sources. The file stays private to you.</p>
            </div>
            <Button onClick={() => input.current?.click()}>Choose PDF</Button>
          </>
        ) : (
          <>
            <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
              <FileText className="size-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{uploading ?? result?.fileName}</div>
              <div className="text-xs text-muted-foreground">
                {uploading
                  ? "Uploading…"
                  : running
                    ? "Reading the deck and checking claims against verified sources. This can take a minute…"
                    : failed
                      ? "Check failed"
                      : `${result?.pages ? `${result.pages} pages · ` : ""}${result?.companyName ? `${result.companyName} · ` : ""}checked ${formatDay(result!.checkedAt)}`}
              </div>
            </div>
            {busy ? (
              <Loader2 className="size-5 animate-spin text-primary" />
            ) : (
              <Button variant="outline" size="sm" className="bg-card" onClick={() => input.current?.click()}>
                Upload new version
              </Button>
            )}
          </>
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

      {done && result && <Results result={result} founder={founder} />}
    </div>
  );
}

const STATUS_ORDER: ClaimStatus[] = ["differs", "cant_verify", "confirmed"];
const DOT: Record<ClaimStatus, string> = { differs: "bg-warning", cant_verify: "bg-subtle", confirmed: "bg-success" };
const FILTER_LABEL = { all: "All", confirmed: "Confirmed", differs: "Differs", cant_verify: "Can't verify" } as const;

/** Summary, a slide list to narrow by slide, and every claim next to what Cala has on record. */
function Results({ result, founder }: { result: DeckCheckResult; founder: boolean }) {
  const [filter, setFilter] = useState<"all" | ClaimStatus>("all");
  const [slide, setSlide] = useState<number | null>(null);
  const total = result.claims.length;
  const counts = Object.fromEntries(STATUS_ORDER.map((st) => [st, result.claims.filter((c) => c.status === st).length])) as Record<ClaimStatus, number>;
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

  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <Summary icon={CircleCheck} label="Confirmed" hint="Matches a sourced record" n={counts.confirmed} pct={pct(counts.confirmed)} tone="success" onClick={() => setFilter("confirmed")} />
        <Summary icon={CircleAlert} label="Differs from record" hint="A source says something else" n={counts.differs} pct={pct(counts.differs)} tone="warning" onClick={() => setFilter("differs")} />
        <Summary icon={CircleHelp} label="Can't verify" hint="Not on record. This does not mean false." n={counts.cant_verify} pct={pct(counts.cant_verify)} tone="muted" onClick={() => setFilter("cant_verify")} />
      </div>

      {founder && total > 0 && (
        <div className={cn("flex items-start gap-4 rounded-xl border p-5", counts.differs ? "border-warning/30 bg-warning-soft/50" : "bg-card")}>
          <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", counts.differs ? "bg-card text-warning" : "bg-teal-soft text-primary")}>
            {counts.differs ? <CircleAlert className="size-5" /> : <CircleCheck className="size-5" />}
          </div>
          <div className="min-w-0 flex-1">
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

      <div className="grid grid-cols-[200px_1fr] items-start gap-6">
        <nav aria-label="Slides" className="sticky top-4 rounded-xl border bg-card p-2">
          <div className="flex items-center justify-between px-2 pt-1 pb-2">
            <span className="text-[13px] font-semibold">
              Slides <span className="font-normal text-muted-foreground">({slides.length})</span>
            </span>
          </div>
          <div className="max-h-[480px] space-y-0.5 overflow-y-auto">
            <SlideButton active={slide === null} onClick={() => setSlide(null)} label="All slides" sub={`${total} claims`} />
            {slides.map((sl) => (
              <SlideButton
                key={sl.n}
                active={slide === sl.n}
                onClick={() => setSlide(slide === sl.n ? null : sl.n)}
                label={`Slide ${sl.n}`}
                sub={sl.count ? `${sl.count} claim${sl.count === 1 ? "" : "s"}` : "No claims"}
                dot={sl.worst ? DOT[sl.worst] : "bg-border"}
                disabled={!sl.count}
              />
            ))}
          </div>
        </nav>

        <div className="min-w-0 rounded-xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
            <h2 className="text-[15px] font-semibold">
              Claims{slide !== null && <span className="font-normal text-muted-foreground"> · slide {slide}</span>}
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground tabular">{claims.length}</span>
            </h2>
            <div className="flex gap-1">
              {(["all", "differs", "cant_verify", "confirmed"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={cn("rounded-md px-2.5 py-1 text-xs font-medium", filter === f ? "bg-teal-soft text-accent-foreground" : "text-muted-foreground hover:bg-muted")}
                >
                  {FILTER_LABEL[f]}
                </button>
              ))}
            </div>
          </div>
          {claims.length ? (
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="w-[34%] px-5 py-2 font-medium">Claim</th>
                  <th className="w-16 px-2 py-2 font-medium">Slide</th>
                  <th className="w-40 px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">What the sources say</th>
                  <th className="w-32 px-5 py-2 text-right font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((c) => (
                  <tr key={c.id} className={cn("border-b align-top last:border-0", c.status === "differs" && "bg-warning-soft/40")}>
                    <td className="px-5 py-3">
                      <p className="font-medium">“{c.claim}”</p>
                      <span className="mt-1 inline-block text-[11px] text-subtle capitalize">{c.category}</span>
                    </td>
                    <td className="px-2 py-3">
                      <button type="button" onClick={() => setSlide(c.slide)} className="rounded bg-muted px-1.5 py-0.5 text-xs tabular hover:bg-teal-soft" title="Show only this slide">
                        {c.slide}
                      </button>
                    </td>
                    <td className="px-2 py-3">
                      <ClaimBadge status={c.status} />
                    </td>
                    <td className="px-2 py-3 text-[13px]">
                      {c.onRecord ? (
                        <span className={cn(c.status === "differs" && "text-warning")}>{c.onRecord}</span>
                      ) : c.status === "cant_verify" ? (
                        <span className="text-muted-foreground italic">No source on record.{founder ? " Be ready to back this up." : " Ask for evidence."}</span>
                      ) : (
                        <span className="text-subtle">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">{c.sources.length ? <SourceChip sources={c.sources} /> : <span className="text-subtle">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">No claims match. Pick another slide or status.</p>
          )}
        </div>
      </div>

    </>
  );
}

function SlideButton({ active, onClick, label, sub, dot, disabled }: { active: boolean; onClick: () => void; label: string; sub: string; dot?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left",
        active ? "bg-teal-soft ring-1 ring-primary/40" : "hover:bg-muted",
        disabled && "opacity-50 hover:bg-transparent",
      )}
    >
      <span className="min-w-0">
        <span className="block text-[13px] font-medium">{label}</span>
        <span className="block text-[11px] text-muted-foreground">{sub}</span>
      </span>
      {dot && <span className={cn("size-2 shrink-0 rounded-full", dot)} />}
    </button>
  );
}

function Summary({
  icon: Icon,
  label,
  hint,
  n,
  pct,
  tone,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  n: number;
  pct: number;
  tone: "success" | "warning" | "muted";
  onClick: () => void;
}) {
  const tones = {
    success: { icon: "bg-success-soft text-success", n: "text-success", pct: "bg-success-soft text-success" },
    warning: { icon: "bg-warning-soft text-warning", n: "text-warning", pct: "bg-warning-soft text-warning" },
    muted: { icon: "bg-muted text-muted-foreground", n: "text-foreground", pct: "bg-muted text-muted-foreground" },
  }[tone];
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-3 rounded-xl border bg-card p-4 text-left hover:border-primary/30" title={`Show ${label.toLowerCase()} claims`}>
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", tones.icon)}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={cn("text-2xl font-semibold tabular", tones.n)}>{n}</span>
          <span className="text-[13px] font-medium">{label}</span>
        </span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-medium tabular", tones.pct)}>{pct}%</span>
    </button>
  );
}
