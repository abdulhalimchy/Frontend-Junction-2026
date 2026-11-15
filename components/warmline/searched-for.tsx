import { Search } from "lucide-react";
import type { AnalysisSearch } from "@/lib/types";

/** The searches that found the companies in a "peers" analysis, each with how many companies it added. */
export function SearchedFor({
  searches,
  leftOut,
}: {
  searches?: AnalysisSearch[];
  leftOut?: string[];
}) {
  if (!searches?.length) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span className="mr-0.5 flex items-center gap-1.5">
          <Search className="size-3.5" /> Found by searching for
        </span>
        {searches.map((s) => (
          <span
            key={s.query}
            title={s.query}
            className="inline-flex h-6 items-center gap-1.5 rounded-full border bg-card px-2.5 text-foreground"
          >
            {s.label}
            <span className="text-subtle tabular">{s.found}</span>
          </span>
        ))}
      </div>
      {!!leftOut?.length && (
        <p className="text-xs text-subtle" title={leftOut.join(", ")}>
          Left out {leftOut.length}{" "}
          {leftOut.length === 1 ? "company" : "companies"} that only share your
          customers&apos; industry
          {leftOut.length <= 4
            ? `: ${leftOut.join(", ")}`
            : `, such as ${leftOut.slice(0, 3).join(", ")}`}
          .
        </p>
      )}
    </div>
  );
}
