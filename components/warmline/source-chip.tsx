"use client";

import { ExternalLink, FileText } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatFuzzyDate } from "@/lib/format";
import type { Source, SourceRank } from "@/lib/types";
import { cn } from "@/lib/utils";

/** "n sources" chip. Opens a popover with each source's name, URL, date and rank. */
export function SourceChip({ sources, className }: { sources: Source[]; className?: string }) {
  if (!sources.length) {
    return (
      <span className={cn("inline-flex h-5 items-center rounded-full border border-dashed px-2 text-[11px] text-subtle", className)}>
        No source
      </span>
    );
  }
  const sorted = [...sources].sort((a, b) => rankOrder(a.source_rank) - rankOrder(b.source_rank));
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border bg-card px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary data-[state=open]:border-primary/40 data-[state=open]:text-primary",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <FileText className="size-3" />
        {sources.length} {sources.length === 1 ? "source" : "sources"}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-0 p-0" onClick={(e) => e.stopPropagation()}>
        <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">Sources, most authoritative first</div>
        <ul className="max-h-72 divide-y overflow-auto">
          {sorted.map((s, i) => (
            <li key={i} className="px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-medium leading-snug">{s.name}</span>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular">
                  {RANK_LABEL[s.source_rank ?? "null"]}
                </span>
              </div>
              {s.document ? (
              <a
                href={s.document}
                target="_blank"
                rel="noreferrer"
                className="mt-1 flex items-center gap-1 truncate text-xs text-primary hover:underline"
              >
                <ExternalLink className="size-3 shrink-0" />
                <span className="truncate">{s.document.replace(/^https?:\/\//, "")}</span>
              </a>
              ) : (
                <div className="mt-1 text-xs text-muted-foreground">Derived by Cala from other sources</div>
              )}
              <div className="mt-0.5 text-xs text-subtle">{formatSourceDate(s)}</div>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

const ORDER: SourceRank[] = ["FILING", "PRIMARY", "PRESS", "AGGREGATOR", null];
const RANK_LABEL: Record<string, string> = {
  FILING: "Filing",
  PRIMARY: "Primary",
  PRESS: "Press",
  AGGREGATOR: "Aggregator",
  null: "Derived",
};

function rankOrder(r: SourceRank) {
  return ORDER.indexOf(r);
}

/** Source dates follow Cala's stated precision. */
function formatSourceDate(s: Source) {
  const precision = s.date_precision ?? "day";
  const len = precision === "year" ? 4 : precision === "month" ? 7 : 10;
  return formatFuzzyDate({ date: s.date.slice(0, len), precision });
}
