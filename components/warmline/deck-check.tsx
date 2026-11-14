"use client";

import { FileText, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDay } from "@/lib/format";
import type { DeckCheckResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ClaimBadge } from "./badges";
import { SourceChip } from "./source-chip";

type State = "idle" | "checking" | "done";

/**
 * Deck check UI. Phase 1 simulates the upload and shows a fixture result.
 * Phase 4: PDF upload → text extraction → LLM claim extraction → verification against Cala.
 */
export function DeckCheck({ result, initiallyDone = false }: { result: DeckCheckResult; initiallyDone?: boolean }) {
  const [state, setState] = useState<State>(initiallyDone ? "done" : "idle");
  const [fileName, setFileName] = useState(initiallyDone ? result.fileName : "");
  const [filter, setFilter] = useState<"all" | DeckCheckResult["claims"][number]["status"]>("all");
  const input = useRef<HTMLInputElement>(null);

  function start(name: string) {
    setFileName(name);
    setState("checking");
    setTimeout(() => setState("done"), 1400);
  }

  const counts = {
    confirmed: result.claims.filter((c) => c.status === "confirmed").length,
    differs: result.claims.filter((c) => c.status === "differs").length,
    cant_verify: result.claims.filter((c) => c.status === "cant_verify").length,
  };
  const claims = filter === "all" ? result.claims : result.claims.filter((c) => c.status === filter);

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) start(f.name);
        }}
        className={cn(
          "flex items-center gap-4 rounded-xl border border-dashed bg-card p-5",
          state === "idle" && "flex-col justify-center py-12 text-center",
        )}
      >
        <input
          ref={input}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && start(e.target.files[0].name)}
        />
        {state === "idle" ? (
          <>
            <div className="flex size-11 items-center justify-center rounded-full bg-teal-soft">
              <Upload className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Drop a pitch deck (PDF)</p>
              <p className="mt-1 text-[13px] text-muted-foreground">We extract each factual claim and check it against Cala. The file stays private to you.</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => input.current?.click()}>Choose PDF</Button>
              <Button variant="outline" className="bg-card" onClick={() => start(result.fileName)}>
                Use sample deck
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
              <FileText className="size-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{fileName}</div>
              <div className="text-xs text-muted-foreground">
                {state === "checking" ? "Extracting claims and checking sources…" : `${result.pages} pages · checked ${formatDay(result.checkedAt)}`}
              </div>
            </div>
            {state === "checking" ? (
              <Loader2 className="size-5 animate-spin text-primary" />
            ) : (
              <Button variant="outline" size="sm" className="bg-card" onClick={() => input.current?.click()}>
                Upload new version
              </Button>
            )}
          </>
        )}
      </div>

      {state === "done" && (
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
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium",
                      filter === f ? "bg-teal-soft text-accent-foreground" : "text-muted-foreground hover:bg-muted",
                    )}
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
                    {c.status === "cant_verify" && (
                      <p className="mt-1 text-[13px] text-muted-foreground">Cala has no source for this. Ask for evidence.</p>
                    )}
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
