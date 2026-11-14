"use client";

import { AlertCircle, FileText, Loader2, RotateCw, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDay } from "@/lib/format";
import type { DeckCheckResult } from "@/lib/types";
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
}: {
  initial: DeckCheckResult | null;
  /** Hint for finding the company in Cala. Empty for investors: the name is then read from the deck. */
  companyName?: string;
  loadError?: string | null;
  /** The founder's startup the deck is for; null for the demo company and investors. */
  startupId?: string | null;
}) {
  const [result, setResult] = useState<DeckCheckResult | null>(initial);
  const [uploading, setUploading] = useState<string | null>(null); // file name while the upload is in flight
  const [error, setError] = useState<string | null>(loadError);
  const [filter, setFilter] = useState<"all" | DeckCheckResult["claims"][number]["status"]>("all");
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
      setFilter("all");
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

  const counts = {
    confirmed: result?.claims.filter((c) => c.status === "confirmed").length ?? 0,
    differs: result?.claims.filter((c) => c.status === "differs").length ?? 0,
    cant_verify: result?.claims.filter((c) => c.status === "cant_verify").length ?? 0,
  };
  const claims = !result ? [] : filter === "all" ? result.claims : result.claims.filter((c) => c.status === filter);

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

      {done && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Summary label="Confirmed" n={counts.confirmed} cls="text-success" />
            <Summary label="Differs from record" n={counts.differs} cls="text-warning" />
            <Summary label="Can't verify" n={counts.cant_verify} cls="text-muted-foreground" hint="Not on record. This does not mean false." />
          </div>
          <div className="rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h2 className="text-[15px] font-semibold">Claims</h2>
              <div className="flex gap-1">
                {(["all", "confirmed", "differs", "cant_verify"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={cn("rounded-md px-2.5 py-1 text-xs font-medium", filter === f ? "bg-teal-soft text-accent-foreground" : "text-muted-foreground hover:bg-muted")}
                  >
                    {{ all: "All", confirmed: "Confirmed", differs: "Differs", cant_verify: "Can't verify" }[f]}
                  </button>
                ))}
              </div>
            </div>
            <ul className="divide-y">
              {claims.map((c) => (
                <li key={c.id} className="grid grid-cols-[56px_1fr_auto] items-start gap-4 px-5 py-4">
                  <span className="text-xs text-muted-foreground tabular">Slide {c.slide}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">“{c.claim}”</p>
                    {c.onRecord && (
                      <p className="mt-1 text-[13px] text-muted-foreground">
                        <span className="font-medium text-foreground/80">On record: </span>
                        {c.onRecord}
                      </p>
                    )}
                    {c.status === "cant_verify" && <p className="mt-1 text-[13px] text-muted-foreground">No source was found for this. Ask for evidence.</p>}
                    <span className="mt-2 inline-block text-[11px] capitalize text-subtle">{c.category}</span>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <ClaimBadge status={c.status} />
                    {c.sources.length > 0 && <SourceChip sources={c.sources} />}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function Summary({ label, n, cls, hint }: { label: string; n: number; cls: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-[13px] text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold tabular", cls)}>{n}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
