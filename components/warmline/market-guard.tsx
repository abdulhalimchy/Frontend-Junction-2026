import { ArrowRight, Building2, CircleAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { GuardVerdict } from "@/lib/backend/markets";

/**
 * Shown instead of results when the typed text does not look like a market, so no Cala credit is spent.
 * Suggestions are one-click searches; "Run anyway" bypasses the check.
 */
export function MarketGuardNotice({
  text,
  verdict,
  searchHref,
  runAnywayHref,
}: {
  text: string;
  verdict: GuardVerdict;
  searchHref: (sector: string) => string;
  runAnywayHref: string;
}) {
  const company = verdict.kind === "company";
  return (
    <div className="rounded-xl border border-warning/30 bg-warning-soft/40 p-5">
      <div className="flex items-start gap-3">
        {company ? <Building2 className="mt-0.5 size-5 text-warning" /> : <CircleAlert className="mt-0.5 size-5 text-warning" />}
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold">
            {company ? `“${text}” looks like a company, not a market` : `“${text}” doesn't look like a market`}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {verdict.reason} Nothing was sent to Cala, so no credit was used.
          </p>

          {company && (
            <Button size="sm" className="mt-4" asChild>
              <Link href={`/market?${new URLSearchParams({ mode: "company", sector: text })}`}>
                Analyse {text} as a company <ArrowRight />
              </Link>
            </Button>
          )}

          {verdict.suggestions.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-xs text-muted-foreground">Did you mean</div>
              <div className="flex flex-wrap gap-2">
                {verdict.suggestions.map((s) => (
                  <Link
                    key={s}
                    href={searchHref(s)}
                    className="rounded-full border bg-card px-3 py-1 text-sm hover:border-primary/40 hover:text-primary"
                  >
                    {s}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 border-t pt-3 text-xs text-muted-foreground">
            Sure it&apos;s a market?{" "}
            <Link href={runAnywayHref} className="font-medium text-primary hover:underline">
              Run anyway
            </Link>{" "}
            (uses Cala credit).
          </div>
        </div>
      </div>
    </div>
  );
}
