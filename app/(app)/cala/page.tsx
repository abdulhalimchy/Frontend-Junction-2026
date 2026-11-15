import { ArrowRight, ArrowUpRight, Bookmark, Building2, CalendarDays, FileText, LineChart, Route, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ClaimBadge } from "@/components/warmline/badges";
import { PageHeader, Panel } from "@/components/warmline/blocks";

export const metadata: Metadata = { title: "Powered by Cala" };

// Explains where Warmline's data comes from: what Cala is, the kinds of source behind a fact, how to judge one,
// and where Cala is used in the app. Static: it makes no Cala call. The source ranks are the ones the source chip
// shows (components/warmline/source-chip.tsx), in the same order.

const CALA_URL = "https://www.cala.ai/";
const CALA_DOCS_URL = "https://docs.cala.ai/";

const STEPS = [
  {
    title: "Cala reads the public record",
    text: "Company filings, official registers, press and other published documents.",
  },
  {
    title: "It turns them into connected facts",
    text: "Companies, people, investors and funding rounds become entries in one knowledge graph, linked to each other. Every fact keeps the document it came from.",
  },
  {
    title: "Warmline asks Cala",
    text: "When you look up a company, a market or an investor, we query that graph instead of scraping search results, and show the answer with its sources attached.",
  },
];

const RANKS = [
  { label: "Filing", text: "Official registers and regulatory filings. The strongest evidence for dates, amounts and ownership." },
  { label: "Primary", text: "Published by the company or investor itself, such as its own website or announcement." },
  { label: "Press", text: "News articles and press releases. Good for what happened and when; check amounts against a filing if there is one." },
  { label: "Aggregator", text: "Databases that collect from other sources. Useful as a pointer, weakest as proof." },
  { label: "Unranked", text: "A linked document that has no rank yet. Open it and judge it yourself." },
  { label: "Derived", text: "Worked out from other sourced facts, so it has no document of its own." },
];

const CHECKS = [
  { title: "Open the chip", text: "Every value has a sources chip. It lists the documents behind the value, strongest first, each with a link." },
  { title: "Look at the kind of source", text: "A filing outweighs a press article, and a press article outweighs an aggregator." },
  { title: "Look at the date", text: "Dates are as precise as the source states: a year, a month or a day. An old source can describe a company that has since changed." },
  { title: "Count the sources", text: "Two independent documents that agree are stronger than one. When they disagree, we show the difference instead of picking one quietly." },
];

const USES: { icon: LucideIcon; title: string; text: string; href: string }[] = [
  { icon: LineChart, title: "Market analysis", text: "Size, players, funding and deals for a market you describe.", href: "/market" },
  { icon: Building2, title: "Company analysis", text: "A company's profile, funding history, people and competitors.", href: "/market" },
  { icon: Route, title: "Connect", text: "Who can introduce you, traced through investment records.", href: "/intros" },
  { icon: Bookmark, title: "Watch list", text: "What changed on record for the companies and investors you follow.", href: "/watchlist" },
  { icon: CalendarDays, title: "Slush 2026", text: "Attendees and the companies behind the side events.", href: "/events/slush-2026/overview" },
];

function ExternalButton({ href, children, primary }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={
        primary
          ? "flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          : "flex h-9 items-center gap-1.5 rounded-lg border bg-card px-3 text-sm hover:bg-muted"
      }
    >
      {children} <ArrowUpRight className="size-4" />
    </a>
  );
}

export default function CalaPage() {
  return (
    <>
      <PageHeader
        eyebrow={
          <span className="inline-flex h-5 items-center gap-1 rounded-full border border-primary/30 bg-brand-soft px-2 text-[11px] font-medium text-primary dark:text-brand-2">
            <Sparkles className="size-3" /> Powered by Cala
          </span>
        }
        title="Where Warmline's data comes from"
        description="Cala is the public data layer behind Warmline: a knowledge graph of companies, people, investors and funding rounds in which every fact is linked to its source."
        actions={
          <>
            <ExternalButton href={CALA_DOCS_URL}>Cala docs</ExternalButton>
            <ExternalButton href={CALA_URL} primary>
              Visit cala.ai
            </ExternalButton>
          </>
        }
      />

      <div className="space-y-6">
        <Panel title="How it works">
          <ol className="grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="border-t pt-4">
                <span className="tabular flex size-6 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-accent-foreground">{i + 1}</span>
                <h3 className="mt-3 text-sm font-semibold">{s.title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </Panel>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel title="The kinds of source" description="Each source carries one of these labels. Chips list them in this order, strongest first.">
            <ul className="divide-y">
              {RANKS.map((r) => (
                <li key={r.label} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="mt-0.5 w-20 shrink-0">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{r.label}</span>
                  </span>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">{r.text}</p>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            title="How to check a fact"
            description={
              <span className="inline-flex flex-wrap items-center gap-1.5">
                Start from the chip next to any value:
                <span className="inline-flex h-5 items-center gap-1 rounded-full border bg-card px-2 text-[11px] font-medium text-muted-foreground">
                  <FileText className="size-3" /> 2 sources
                </span>
              </span>
            }
          >
            <ul className="space-y-4">
              {CHECKS.map((c) => (
                <li key={c.title}>
                  <h3 className="text-sm font-semibold">{c.title}</h3>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{c.text}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <Panel title="What the data can't tell you" description="Cala covers what has been published. Keep these limits in mind before you rely on a result.">
          <ul className="grid gap-x-8 gap-y-5 md:grid-cols-3">
            <li>
              <span className="inline-flex h-5 items-center rounded-full border border-dashed px-2 text-[11px] text-subtle">No funding on record</span>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                Nothing on record means nothing was published, not that nothing happened. Unannounced rounds and private terms are not here.
              </p>
            </li>
            <li>
              <ClaimBadge status="cant_verify" />
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                A claim no public source covers is marked as unverifiable. That is different from the record contradicting it.
              </p>
            </li>
            <li>
              <span className="tabular text-sm font-medium">€4.2M · $1.1M</span>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                Amounts stay in the currency the source reported, and grants are kept apart from equity, so totals are never rounded into one number.
              </p>
            </li>
          </ul>
        </Panel>

        <Panel title="Where you use it in Warmline">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {USES.map((u) => (
              <li key={u.title}>
                <Link href={u.href} className="group flex h-full items-start gap-3 rounded-lg border p-3.5 transition-colors hover:border-primary/40 hover:bg-muted/50">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft">
                    <u.icon className="size-4 text-primary" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 text-sm font-semibold">
                      {u.title} <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground">{u.text}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <section className="flex flex-col gap-4 rounded-xl border border-primary/25 bg-linear-to-b from-brand-soft to-card p-5 shadow-panel sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">Want to go to the source?</h2>
            <p className="mt-0.5 max-w-xl text-[13px] text-muted-foreground">
              Cala is an independent product. Its site explains the knowledge graph, and its docs cover the API and MCP server that Warmline is built on.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <ExternalButton href={CALA_DOCS_URL}>Cala docs</ExternalButton>
            <ExternalButton href={CALA_URL} primary>
              Visit cala.ai
            </ExternalButton>
          </div>
        </section>
      </div>
    </>
  );
}
