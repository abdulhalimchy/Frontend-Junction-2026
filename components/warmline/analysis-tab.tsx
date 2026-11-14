"use client";

import { CircleAlert, Loader2, RefreshCw, Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Analysis, AnalysisKind, CompetitorsAnalysis, InvestorsAnalysis } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Panel } from "./blocks";
import { CompetitorsView } from "./competitors-view";
import { InvestorsView } from "./investors-view";

const POLL_MS = 3000;

const COPY: Record<AnalysisKind, { title: string; button: string; running: string; steps: string[] }> = {
  competitors: {
    title: "See where you stand against your competitors",
    button: "Find competitors",
    running: "Finding competitors",
    steps: [
      "Asks Cala for your competitors (or, if you are not in Cala yet, companies matching your industry)",
      "Reads each one's funding rounds, stage, team and lead investors, with sources",
      "Compares the money raised, in one currency only",
    ],
  },
  investors: {
    title: "Find investors who fund companies like yours",
    button: "Find investors",
    running: "Finding investors",
    steps: [
      "Collects every investor with a sourced investment in companies like yours",
      "Reads each investor's rounds: stages, rounds led, latest deal, location",
      "Scores how well each one fits you and flags who backs a competitor",
    ],
  },
};

function ago(iso: string | null) {
  if (!iso) return "";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

/**
 * One analysis tab. Nothing runs until the user clicks the button; the result is stored in the backend and
 * shown from there on every visit. Refresh runs it again with the latest Cala data, keeping the old result on
 * screen meanwhile.
 */
export function AnalysisTab({
  startupId,
  startupName,
  kind,
  initial,
}: {
  startupId: string;
  startupName: string;
  kind: AnalysisKind;
  initial: Analysis<unknown> | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<Analysis<unknown> | null>(initial);
  const [error, setError] = useState<string | null>(initial ? null : "Could not load the stored analysis.");
  const [starting, setStarting] = useState(false);
  const loading = state?.status === "loading";
  const copy = COPY[kind];
  const hasData = !!state && Object.keys(state.data ?? {}).length > 0;

  useEffect(() => {
    if (!loading) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const res = await fetch(`/api/startups/${startupId}/analyses/${kind}`);
        const body = await res.json();
        if (stop) return;
        if (res.ok) {
          setState(body);
          if (body.status !== "loading") {
            router.refresh(); // tab counts
            return;
          }
        }
      } catch {
        /* keep polling */
      }
      if (!stop) timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [loading, startupId, kind, router]);

  async function run() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/startups/${startupId}/analyses/${kind}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not start.");
      setState(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start.");
    } finally {
      setStarting(false);
    }
  }

  // Never run: explain what will happen and let the founder start it.
  if (!state || (state.status === "none" && !hasData) || (!hasData && state.status === "failed" && !loading)) {
    const failed = state?.status === "failed";
    return (
      <Panel>
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-teal-soft">
            {failed ? <CircleAlert className="size-5 text-destructive" /> : <Search className="size-5 text-primary" />}
          </div>
          <h2 className="text-base font-semibold tracking-tight">{failed ? "The last search failed" : copy.title}</h2>
          {failed ? (
            <p className="mt-1 max-w-md text-[13px] text-muted-foreground">{state?.error}</p>
          ) : (
            <ul className="mt-3 max-w-md space-y-1.5 text-left text-[13px] text-muted-foreground">
              {copy.steps.map((s) => (
                <li key={s} className="flex gap-2">
                  <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  {s}
                </li>
              ))}
            </ul>
          )}
          {error && <p className="mt-3 text-[13px] text-destructive">{error}</p>}
          <Button className="mt-5" onClick={run} disabled={starting}>
            {starting ? <Loader2 className="animate-spin" /> : <Search />} {failed ? "Try again" : copy.button}
          </Button>
          <p className="mt-2 text-xs text-subtle">Uses live Cala data. Takes 20–60 seconds; the result is saved for next time.</p>
        </div>
      </Panel>
    );
  }

  // First run in progress, nothing to show yet.
  if (loading && !hasData) return <Running label={`${copy.running} for ${startupName}`} />;

  const data = state.data;
  return (
    <div className="space-y-4">
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs",
          loading ? "border-primary/30 bg-teal-soft/50" : state.status === "failed" ? "border-destructive/30 bg-destructive/5" : "bg-card",
        )}
      >
        <span className="flex items-center gap-2 text-muted-foreground">
          {loading ? (
            <>
              <Loader2 className="size-3.5 animate-spin text-primary" /> Refreshing from Cala… showing the previous result meanwhile.
            </>
          ) : state.status === "failed" ? (
            <>
              <CircleAlert className="size-3.5 text-destructive" /> The refresh failed ({state.error}). Showing the result from {ago(state.finished_at)}.
            </>
          ) : (
            <>Live Cala data, saved {ago(state.finished_at)}.</>
          )}
        </span>
        <Button variant="ghost" size="sm" onClick={run} disabled={starting || loading} className="h-7">
          <RefreshCw className={cn("size-3.5", (starting || loading) && "animate-spin")} /> Refresh
        </Button>
      </div>
      {error && <p className="text-[13px] text-destructive">{error}</p>}
      {kind === "competitors" ? (
        <CompetitorsView data={data as CompetitorsAnalysis} startupName={startupName} />
      ) : (
        <InvestorsView data={data as InvestorsAnalysis} startupName={startupName} />
      )}
    </div>
  );
}

function Running({ label }: { label: string }) {
  return (
    <Panel>
      <div className="flex items-center gap-3">
        <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">Asking Cala and reading each company&apos;s records. You can leave this page; it keeps running.</p>
        </div>
      </div>
      <div className="mt-5 space-y-2.5">
        {[90, 75, 85, 60, 70].map((w) => (
          <div key={w} className="h-4 animate-pulse rounded bg-muted" style={{ width: `${w}%` }} />
        ))}
      </div>
    </Panel>
  );
}
