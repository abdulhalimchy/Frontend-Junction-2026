import { Building2, FileText } from "lucide-react";
import Link from "next/link";
import { formatFuzzyDate } from "@/lib/format";
import type { Startup, StartupField } from "@/lib/types";
import { EmptyState, FactGrid, Panel } from "./blocks";
import { SourceChip } from "./source-chip";

const TRACKED: StartupField[] = ["description", "founded", "headquarters", "employees", "stage", "industry"];

function founded(value: string) {
  if (!value) return "";
  const precision = value.length === 4 ? "year" : value.length === 7 ? "month" : "day";
  return formatFuzzyDate({ date: value, precision });
}

const missing = <span className="font-normal text-subtle">Not added</span>;

/**
 * Overview of a startup the founder added. Values kept from the lookup show their sources; typed ones show "No source".
 * variant "main" renders only the main column (About and funding) for pages that bring their own side column.
 */
export function StartupProfile({ startup: s, variant = "full" }: { startup: Startup; variant?: "full" | "main" }) {
  const src = (f: StartupField) => s.sources[f] ?? [];
  const filled = TRACKED.filter((f) => s[f]);
  const sourced = filled.filter((f) => src(f).length);

  const main = (
    <div className="col-span-2 space-y-6">
      <Panel
        title="About"
        action={
          variant === "main" ? (
            <span
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
              title="Values found by the lookup keep their sources; anything you typed or changed is your own entry."
            >
              <FileText className="size-3.5" />
              <span className="tabular">
                {sourced.length} of {filled.length}
              </span>{" "}
              values sourced
            </span>
          ) : undefined
        }
      >
        {s.description ? (
          <p className="flex items-start gap-2 text-sm leading-relaxed">
            <span>{s.description}</span>
            <SourceChip sources={src("description")} className="mt-0.5" />
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No description yet. Use Edit details to add one.</p>
        )}
        <div className="mt-5">
          <FactGrid
            columns={3}
            facts={[
              { label: "Founded", value: founded(s.founded) || missing, sources: s.founded ? src("founded") : undefined },
              { label: "Headquarters", value: s.headquarters || missing, sources: s.headquarters ? src("headquarters") : undefined },
              { label: "Employees", value: s.employees || missing, sources: s.employees ? src("employees") : undefined },
              { label: "Stage", value: s.stage || missing, sources: s.stage ? src("stage") : undefined },
              { label: "Industry", value: s.industry || missing, sources: s.industry ? src("industry") : undefined },
              {
                label: "Website",
                value: s.domain ? (
                  <a href={`https://${s.domain}`} target="_blank" rel="noreferrer" className="hover:text-primary hover:underline">
                    {s.domain}
                  </a>
                ) : (
                  missing
                ),
              },
            ]}
          />
        </div>
      </Panel>
      {!s.calaCompanyId && (
        <Panel title="Funding" description="Equity and grants are counted separately.">
          <EmptyState
            compact
            icon={Building2}
            title="No funding on record"
            description="When a round is reported publicly and Cala picks it up, it shows here with its sources."
          />
        </Panel>
      )}
    </div>
  );
  if (variant === "main") return main;

  return (
    <div className="grid grid-cols-3 gap-6">
      {main}
      <div className="space-y-6">
        <Panel title="Where this comes from">
          <div className="space-y-3 text-[13px] text-muted-foreground">
            <p className="flex items-center gap-2">
              <FileText className="size-3.5 shrink-0" />
              <span>
                <span className="font-medium text-foreground tabular">
                  {sourced.length} of {filled.length}
                </span>{" "}
                values have sources.
              </span>
            </p>
            <p>Values found by the lookup keep their sources. Anything you typed or changed is shown as your own entry, with no source.</p>
            {s.calaCompanyId ? (
              <p>
                Matched in Cala. Its funding, people and investors are below.{" "}
                <Link href={`/company/${s.calaCompanyId}`} className="font-medium text-primary hover:underline">
                  See the public brief
                </Link>
              </p>
            ) : (
              <p>Not matched to a company in Cala yet.</p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
