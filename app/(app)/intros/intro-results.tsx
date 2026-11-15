import { ArrowRight, Handshake, Route } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { SlushTag } from "@/components/warmline/badges";
import { EmptyState, EntityAvatar, Panel } from "@/components/warmline/blocks";
import { SourceChip } from "@/components/warmline/source-chip";
import { calaErrorKind } from "@/lib/cala/client";
import { findIntroPaths, type IntroPath, type Node } from "@/lib/cala/intros";
import { askReason, companyList, linkSentence, roundName, tieLabel, tieSentence } from "@/lib/intro-text";

export async function IntroResults({ fromId, toId }: { fromId: string; toId: string }) {
  let r: Awaited<ReturnType<typeof findIntroPaths>>;
  try {
    r = await findIntroPaths(fromId, toId);
  } catch (e) {
    const kind = calaErrorKind(e);
    const msg =
      kind === "no_credit"
        ? "The data credit balance is empty."
        : kind === "rate_limited"
          ? "Too many requests right now. Try again in a minute."
          : kind === "missing_key"
            ? "The data source is not configured on this server."
            : "Could not load one of these companies. Try again.";
    return <EmptyState icon={Route} title="Intro paths are unavailable" description={msg} />;
  }
  const { from, to, direct, common, paths } = r;
  const bothAtSlush = from.atSlush && to.atSlush;

  return (
    <div className="space-y-4">
      {direct && (
        <Panel>
          <div className="flex items-start gap-3">
            <Handshake className="mt-0.5 size-5 text-primary" />
            <div className="text-sm">
              <p className="font-medium">You are already connected: {tieSentence(direct, from, to)}.</p>
              <p className="mt-0.5 text-muted-foreground">No intro needed; reach out directly.</p>
            </div>
            <SourceChip sources={direct.sources} className="ml-auto" />
          </div>
        </Panel>
      )}

      {common && (
        <Panel>
          <div className="flex items-start gap-3">
            <Handshake className="mt-0.5 size-5 text-primary" />
            <div className="min-w-0 text-sm">
              <p className="font-medium">
                Common ground: {from.name} and {to.name} {common.kind === "same_round" ? `were both in ${roundName(common.round)}` : `both backed ${companyList(common.companies)}`}.
              </p>
              <p className="mt-0.5 text-muted-foreground">
                {common.kind === "same_round" ? "The company's founders know you both." : "Their founders know you both."} A shared deal is a natural opener, or a route to an intro.
              </p>
            </div>
            <SourceChip sources={common.sources} className="ml-auto" />
          </div>
        </Panel>
      )}

      {bothAtSlush && (
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <SlushTag label="Slush" /> {from.name} and {to.name} are both on the Slush 2026 attendee list.
        </p>
      )}

      {paths.length ? (
        <Panel
          title={`${paths.length} ${direct ? "other " : ""}${paths.length === 1 ? "way" : "ways"} to reach ${to.name}`}
          description={`Strongest first. Checked ${r.checked} of ${from.name}'s ${r.contacts} investors, portfolio companies and co-investors on record.`}
        >
          <ol className="space-y-3">
            {paths.map((p, i) => (
              <PathCard key={p.via.id} p={p} from={from} to={to} rank={i + 1} />
            ))}
          </ol>
        </Panel>
      ) : (
        !direct && !common && (
          <EmptyState
            icon={Route}
            title={`No intro path to ${to.name} on record`}
            description={
              r.contacts
                ? `None of the ${r.checked} investors, portfolio companies or co-investors of ${from.name} that we checked has invested with ${to.name} on record. The investment records are incomplete, so this is not proof there is none.`
                : `There are no investors, portfolio companies or co-investors on record for ${from.name}, so there is nothing to start a path from. Check that you picked the right legal entity.`
            }
          />
        )
      )}
    </div>
  );
}

function PathCard({ p, from, to, rank }: { p: IntroPath; from: Node; to: Node; rank: number }) {
  return (
    <li className="rounded-lg border bg-background/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular">{rank}</span>
        <p className="text-sm font-medium">
          Ask <EntityLink n={p.via} /> {askReason(p.tie)}
        </p>
        {p.via.atSlush && <SlushTag label="At Slush" className="ml-auto" />}
      </div>
      <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-2 text-[13px]">
        <Endpoint n={from} />
        <Edge text={tieLabel(p.tie)} title={tieSentence(p.tie, from, p.via)} sources={p.tie.sources} />
        <Endpoint n={p.via} />
        <Edge text={linkSentence(p.link, p.via, to)} title={linkSentence(p.link, p.via, to)} sources={p.link.sources} />
        <Endpoint n={to} />
      </div>
      {p.link.kind === "shared_portfolio" && (
        <p className="mt-3 text-xs text-muted-foreground">
          Both backed:{" "}
          {p.link.companies.slice(0, 4).map((c, i) => (
            <span key={c.id}>
              {i > 0 && ", "}
              <Link href={`/company/${c.id}`} className="hover:text-primary hover:underline">
                {c.name}
              </Link>
            </span>
          ))}
          {p.link.companies.length > 4 && ` and ${p.link.companies.length - 4} more`}
        </p>
      )}
    </li>
  );
}

function Endpoint({ n }: { n: Node }) {
  return (
    <span className="flex min-w-0 max-w-40 items-center gap-1.5">
      <EntityAvatar name={n.name} size="sm" />
      <EntityLink n={n} className="truncate font-medium" />
    </span>
  );
}

function EntityLink({ n, className }: { n: Node; className?: string }) {
  return (
    <Link href={`/${n.investor ? "investor" : "company"}/${n.id}`} className={className ?? "hover:text-primary"} title={n.name}>
      {n.name}
    </Link>
  );
}

function Edge({ text, title, sources }: { text: string; title: string; sources: IntroPath["tie"]["sources"] }) {
  return (
    <span className="flex min-w-0 flex-col items-center gap-1 text-center text-xs text-muted-foreground">
      <span className="flex w-full items-center gap-1">
        <span className="h-px flex-1 bg-border" />
        <ArrowRight className="size-3" />
      </span>
      <span className="line-clamp-2" title={title}>
        {text}
      </span>
      <SourceChip sources={sources} />
    </span>
  );
}

export function IntroResultsSkeleton() {
  return (
    <Panel title="Finding intro paths" description="Reading your investors and co-investors. The first search can take 10–20 seconds, then it is cached.">
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    </Panel>
  );
}
