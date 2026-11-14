"use client";

import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { useState } from "react";
import type { Startup, StartupField } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Panel } from "./blocks";
import { EditStartupDialog } from "./startup-dialogs";

type Gap = { id: string; title: string; why: string; action?: string; tone: "missing" | "info" };

const TRACKED: StartupField[] = ["description", "founded", "headquarters", "employees", "stage", "industry"];

/** What is missing or unverifiable in the founder's record, and why it matters. Computed from the record; no API calls. */
export function gapsFor(s: Startup, raisedOnRecord: boolean | null, calaStage?: string | null): Gap[] {
  const gaps: Gap[] = [];
  const missing = (f: StartupField) => !s[f]?.trim();
  if (missing("employees"))
    gaps.push({ id: "team", tone: "missing", title: "Team size not on record", why: "Investors screen by team size; without it you drop out of those filters.", action: "Add headcount" });
  if (missing("stage"))
    gaps.push({
      id: "stage",
      tone: "missing",
      title: "Stage not set",
      why: calaStage
        ? `Cala records you at ${calaStage}. Add your current stage so investor matching can score stage fit.`
        : "Investor matching scores stage fit; it is neutral until you set one.",
      action: "Add stage",
    });
  if (missing("industry"))
    gaps.push({ id: "industry", tone: "missing", title: "Industry not set", why: "Needed to find companies like yours when you are not matched in Cala.", action: "Add industry" });
  if (missing("headquarters"))
    gaps.push({ id: "hq", tone: "missing", title: "Location missing", why: "Used to score investors by region.", action: "Add location" });
  if (missing("founded"))
    gaps.push({ id: "founded", tone: "missing", title: "Founding date missing", why: "Investors use company age to judge traction.", action: "Add founding date" });
  if (missing("description"))
    gaps.push({ id: "desc", tone: "missing", title: "No description", why: "A clear one-liner is the first thing an investor reads.", action: "Add description" });
  if (!s.calaCompanyId)
    gaps.push({
      id: "cala",
      tone: "info",
      title: "Not matched in Cala",
      why: "Your funding and team are not on public record yet, so competitors are found by industry instead.",
    });
  else if (raisedOnRecord === false)
    gaps.push({ id: "raised", tone: "info", title: "No funding round on record", why: "Cala has no sourced round for you, so you are not ranked on money raised." });
  const unsourced = TRACKED.filter((f) => !missing(f) && !s.sources[f]?.length).length;
  if (unsourced)
    gaps.push({
      id: "self",
      tone: "info",
      title: `${unsourced} value${unsourced === 1 ? " is" : "s are"} your own entry`,
      why: "They show “No source”. A press release, filing or your website stating them makes them verifiable.",
    });
  return gaps;
}

export function StartupGaps({
  startup,
  raisedOnRecord = null,
  calaStage = null,
}: {
  startup: Startup;
  raisedOnRecord?: boolean | null;
  calaStage?: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const gaps = gapsFor(startup, raisedOnRecord, calaStage);
  const missing = gaps.filter((g) => g.tone === "missing").length;

  return (
    <Panel
      title="Gaps in your record"
      action={
        gaps.length ? (
          <span className="flex size-6 items-center justify-center rounded-full bg-destructive/10 text-xs font-semibold text-destructive tabular">
            {gaps.length}
          </span>
        ) : undefined
      }
    >
      {gaps.length ? (
        <ul className="space-y-2.5">
          {gaps.map((g) => (
            <li key={g.id} className="flex gap-2.5 rounded-lg bg-muted/50 p-3">
              {g.tone === "missing" ? (
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
              ) : (
                <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0">
                <p className="text-[13px] font-medium">{g.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{g.why}</p>
                {g.action && (
                  <button type="button" onClick={() => setEditing(true)} className="mt-1.5 text-xs font-medium text-primary hover:underline">
                    + {g.action} →
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <CircleCheck className="size-4 text-primary" /> Your record is complete.
        </p>
      )}
      {missing > 0 && <p className={cn("mt-3 text-xs text-subtle")}>Filling these in improves your investor matches.</p>}
      <EditStartupDialog startup={startup} open={editing} onOpenChange={setEditing} />
    </Panel>
  );
}
