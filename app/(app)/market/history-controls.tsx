"use client";

import { ArrowRight, Loader2, RefreshCw, Search, Square, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { cancelAnalysisAction, clearHistoryAction, deleteAnalysisAction, refreshAnalysisAction } from "./actions";

/**
 * Free-text market search: any wording, with or without a place. The button is disabled (with a spinner)
 * from submit until the report opens, and while the current report is still being built (busy).
 */
export function MarketSearch({ defaultValue = "", busy = false, size = "md", autoFocus }: { defaultValue?: string; busy?: boolean; size?: "md" | "lg"; autoFocus?: boolean }) {
  const router = useRouter();
  const [text, setText] = useState(defaultValue);
  const [pending, start] = useTransition();
  const h = size === "lg" ? "h-11" : "h-10";
  const disabled = pending || busy || !text.trim();
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const q = text.trim();
        if (!q || pending || busy) return;
        start(() => router.push(`/market/report?${new URLSearchParams({ q })}`));
      }}
    >
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          autoFocus={autoFocus}
          readOnly={pending}
          placeholder="Describe any market, e.g. seed-stage fintech in Finland"
          aria-label="Market to analyse"
          className={cn(h, "pl-9")}
        />
      </div>
      <Button type="submit" className={h} disabled={disabled} aria-busy={pending}>
        {pending ? (
          <>
            <Loader2 className="animate-spin" /> Reading your search…
          </>
        ) : busy ? (
          <>
            <Loader2 className="animate-spin" /> Analysing…
          </>
        ) : (
          <>
            Analyse <ArrowRight />
          </>
        )}
      </Button>
    </form>
  );
}

/** Stops the running analysis: back to the last saved report, or (first run) removed from the history. */
export function StopAnalysisButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="bg-card text-destructive hover:text-destructive"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await cancelAnalysisAction(id);
          if (!res.ok) return void toast.error(res.error);
          if (res.deleted) {
            toast.success("Stopped. Nothing was saved.");
            router.push("/market");
          } else toast.success("Stopped. The previous report was restored.");
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Square className="fill-current" />} Stop
    </Button>
  );
}

/** Re-renders the page every few seconds while the backend is still answering, so sections appear as they land. */
export function PollWhileLoading({ active, everyMs = 4000 }: { active: boolean; everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(t);
  }, [active, everyMs, router]);
  return null;
}

export function RefreshAnalysisButton({ id, running }: { id: string; running: boolean }) {
  const [pending, start] = useTransition();
  const busy = pending || running;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="bg-card"
      disabled={busy}
      title="Fetches fresh verified data for this report and updates the saved copy"
      onClick={() => {
        if (!window.confirm("Refresh this report? It fetches fresh data (4 lookups) and updates the saved report. You can stop it while it runs.")) return;
        start(async () => {
          const res = await refreshAnalysisAction(id);
          if (!res.ok) toast.error(res.error);
        });
      }}
    >
      <RefreshCw className={busy ? "animate-spin" : undefined} /> {running ? "Updating…" : "Refresh data"}
    </Button>
  );
}

export function DeleteAnalysisButton({ id, name, afterDelete }: { id: string; name: string; afterDelete?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={`Delete ${name} from history`}
      title="Delete from history"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`Delete the analysis of “${name}” from your history?`)) return;
        start(async () => {
          const res = await deleteAnalysisAction(id);
          if (!res.ok) return void toast.error(res.error);
          toast.success("Deleted from history.");
          if (afterDelete) router.push(afterDelete);
        });
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
    </Button>
  );
}

export function ClearHistoryButton({ count }: { count: number }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      className="bg-card text-destructive hover:text-destructive"
      disabled={pending || !count}
      onClick={() => {
        if (!window.confirm(`Clear your whole market analysis history (${count} ${count === 1 ? "report" : "reports"})? They are deleted from the database and cannot be restored.`)) return;
        start(async () => {
          const res = await clearHistoryAction();
          if (!res.ok) return void toast.error(res.error);
          toast.success(`Cleared ${res.count ?? count} ${res.count === 1 ? "report" : "reports"}.`);
        });
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : <Trash2 />} Clear history
    </Button>
  );
}
