import { ArrowRight, FileCheck2, Info, Landmark, Network } from "lucide-react";
import Link from "next/link";
import type { CompetitorsAnalysis, DeckCheckResult, InvestorsAnalysis, Source } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SourceChip } from "./source-chip";

// Pieces of the My startup Overview: the key-figure tiles and the side cards summarising the other tabs.

export function FigureGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{children}</div>;
}

/** One key figure. A missing value says so rather than showing a blank or a guess. */
export function Figure({
  label,
  sources,
  hint,
  self,
  children,
}: {
  label: string;
  sources?: Source[];
  hint?: string;
  /** Typed by the founder, with no source: says so instead of a source chip. */
  self?: boolean;
  children: React.ReactNode;
}) {
  const empty = children === null || children === undefined;
  return (
    <div className="flex min-w-0 flex-col rounded-xl border bg-card p-4 shadow-panel transition-colors hover:border-foreground/20">
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      <span className={cn("mt-2 truncate text-[17px] font-semibold tracking-tight tabular", empty && "text-[15px] font-normal text-subtle italic")}>
        {empty ? "Not on record" : children}
      </span>
      <span className="mt-auto flex flex-wrap items-end justify-between gap-x-2 gap-y-1 pt-2">
        <span className="text-xs text-muted-foreground">{hint}</span>
        {!empty && sources?.length ? <SourceChip sources={sources} /> : !empty && self ? <span className="shrink-0 text-[10px] text-subtle">your entry</span> : null}
      </span>
    </div>
  );
}

function SideCard({ icon: Icon, title, href, linkLabel, children }: { icon: typeof Info; title: string; href: string; linkLabel: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-panel">
      <header className="flex items-center justify-between">
        <h2 className="text-[14px] font-semibold">{title}</h2>
        <Icon className="size-4 text-muted-foreground" />
      </header>
      <div className="mt-2 text-[13px] text-muted-foreground">{children}</div>
      <Link href={href} className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">
        {linkLabel} <ArrowRight className="size-3.5" />
      </Link>
    </section>
  );
}

export function CompetitorsCard({ data, href }: { data: CompetitorsAnalysis | null; href: string }) {
  const n = data?.companies.length ?? 0;
  if (!data)
    return (
      <SideCard icon={Network} title="Competitors" href={href} linkLabel="Find competitors">
        Not checked yet. See where you stand on money raised, stage and team.
      </SideCard>
    );
  return (
    <SideCard icon={Network} title="Competitors" href={href} linkLabel="See competitors">
      {n ? (
        <>
          {n} {n === 1 ? "competitor" : "competitors"} on record
          {data!.rank ? (
            <>
              {" "}
              · you rank <span className="font-medium text-foreground">{data!.rank} of {data!.compared}</span> by equity raised
            </>
          ) : null}
          .
        </>
      ) : (
        "No competitors on record yet."
      )}
    </SideCard>
  );
}

export function InvestorsCard({ data, atSlush = 0, href }: { data: InvestorsAnalysis | null; atSlush?: number; href: string }) {
  const list = data?.investors ?? [];
  const top = list[0];
  if (!data)
    return (
      <SideCard icon={Landmark} title="Investors" href={href} linkLabel="Find investors">
        Not checked yet. Find who funds companies like yours, scored for fit.
      </SideCard>
    );
  return (
    <SideCard icon={Landmark} title="Investors" href={href} linkLabel="See investors">
      {list.length ? (
        <>
          <p>
            {list.length} {list.length === 1 ? "investor funds" : "investors fund"} companies like yours
            {atSlush ? (
              <>
                {" "}
                · <span className="rounded bg-slush-soft px-1 font-medium text-slush-foreground">{atSlush} at Slush</span>
              </>
            ) : null}
          </p>
          {top && (
            <p className="mt-1.5">
              Best match: <span className="font-medium text-foreground">{top.name}</span> ({top.match.score}%)
              {top.conflict === "competitor" && <span className="text-warning"> · backs a competitor</span>}
            </p>
          )}
        </>
      ) : (
        "No investors in companies like yours on record yet."
      )}
    </SideCard>
  );
}

export function DeckCard({ deck, href }: { deck: DeckCheckResult | null; href: string }) {
  if (!deck || deck.status !== "completed")
    return (
      <SideCard icon={FileCheck2} title="Pitch deck" href={href} linkLabel={deck ? "See progress" : "Check your deck"}>
        {deck ? "Your deck is being checked." : "No deck checked yet. See which claims the sources back up before investors do."}
      </SideCard>
    );
  const count = (s: string) => deck.claims.filter((c) => c.status === s).length;
  const differs = count("differs");
  return (
    <SideCard icon={FileCheck2} title="Pitch deck" href={href} linkLabel={differs ? `Review ${differs} ${differs === 1 ? "difference" : "differences"}` : "See claims"}>
      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-md bg-success/10 px-2 py-0.5 text-xs font-medium text-success">{count("confirmed")} confirmed</span>
        <span className="rounded-md bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">{differs} differ</span>
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">{count("cant_verify")} can&apos;t verify</span>
      </div>
      <p className="mt-2 truncate text-xs">{deck.fileName}</p>
    </SideCard>
  );
}
