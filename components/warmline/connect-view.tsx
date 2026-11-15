"use client";

import { ArrowRight, Building2, CalendarDays, ExternalLink, Globe, Handshake, Landmark, Send } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { ConnectData, EventLink, InvestorRoute } from "@/lib/cala/connect";
import type { CompanyBridge, IntroPath, IntroResult, Node } from "@/lib/cala/intros";
import { askReason, companyList, linkSentence, roundName, tieSentence } from "@/lib/intro-text";
import type { Source } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SlushTag } from "./badges";
import { EntityAvatar, Panel } from "./blocks";
import { SourceChip } from "./source-chip";

// Connect tab (and the map on the Connect page): who can connect the founder to each best-matched investor. Three kinds of connector:
// investors (your investors and co-investors), companies (founders backed by one of your investors and by
// the target) and events (Slush 2026 and side events). One graph, a compact list on phones, and one card per
// investor. Hovering a node or a card highlights that investor's routes.

type Kind = "investor" | "company" | "event";
type Status = "direct" | Kind | "common" | "cold";

const STATUS: Record<Status, { label: string; color: string; dot: string; pill: string }> = {
  direct: { label: "Already connected", color: "var(--success)", dot: "bg-success", pill: "bg-success-soft text-success" },
  investor: { label: "Intro via investor", color: "var(--primary)", dot: "bg-primary", pill: "bg-brand-soft text-accent-foreground" },
  company: { label: "Founder referral", color: "#8792e8", dot: "bg-[#8792e8]", pill: "bg-[#1b1e36] text-[#aab3f2]" },
  event: { label: "Meet at an event", color: "var(--slush)", dot: "bg-slush", pill: "bg-slush-soft text-slush-foreground" },
  common: { label: "Common ground", color: "var(--subtle)", dot: "bg-subtle", pill: "bg-muted text-muted-foreground" },
  cold: { label: "Reach out directly", color: "var(--subtle)", dot: "bg-border", pill: "bg-muted text-muted-foreground" },
};
const ORDER: Status[] = ["direct", "investor", "company", "event", "common", "cold"];
const KIND_LABEL: Record<Kind, string> = { investor: "Investors", company: "Companies", event: "Events" };

/** Everything that can connect you to one investor, best first. */
type Route = InvestorRoute & { status: Status; kinds: Set<Status> };

function enrich(r: InvestorRoute): Route {
  const kinds = new Set<Status>();
  if (r.result?.direct) kinds.add("direct");
  if (r.result?.paths.length) kinds.add("investor");
  if (r.result?.bridges.length) kinds.add("company");
  if (r.events.length) kinds.add("event");
  if (r.result?.common) kinds.add("common");
  return { ...r, kinds, status: ORDER.find((s) => kinds.has(s)) ?? "cold" };
}

export function ConnectView({ data, you }: { data: ConnectData; you: Node }) {
  const [focus, setFocus] = useState<string | null>(null);
  const routes = useMemo(
    () =>
      data.routes
        .map(enrich)
        // Most ways in first, then the best kind, then the match.
        .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || b.kinds.size - a.kinds.size || b.investor.score - a.investor.score),
    [data.routes],
  );
  const graph = useMemo(() => buildGraph(routes), [routes]);
  const reachable = routes.filter((r) => r.status !== "cold").length;

  return (
    <div className="space-y-6">
      <Panel
        title="Your network map"
        description={`${reachable} of your ${routes.length} best-matched investors can be reached through someone you know or an event. Hover or tap to follow a route.`}
        bodyClassName="pt-2"
      >
        <MapBody graph={graph} routes={routes} you={you} focus={focus} setFocus={setFocus} />
      </Panel>

      <div>
        <h2 className="mb-1 text-[15px] font-semibold tracking-tight">How to reach each investor</h2>
        <p className="mb-4 text-[13px] text-muted-foreground">Easiest first. Every link shows its sources.</p>
        <ol className="grid gap-3 lg:grid-cols-2">
          {routes.map((r) => (
            <RouteCard key={r.investor.id} r={r} you={you} youAtSlush={data.youAtSlush} focused={focus === r.investor.id} setFocus={setFocus} />
          ))}
        </ol>
      </div>
    </div>
  );
}

/**
 * The same map for the Connect page, where there is one target: you, everyone on record who can connect you,
 * and who you want to meet.
 */
export function IntroMap({ result, events }: { result: IntroResult; events: EventLink[] }) {
  const [focus, setFocus] = useState<string | null>(null);
  const { from, to } = result;
  const routes = useMemo(
    () => [enrich({ investor: { id: to.id, name: to.name, country: null, why: "", website: null, sources: [], score: 0 }, result, events, error: null })],
    [to.id, to.name, result, events],
  );
  // One target, so every connector the caps allow is drawn, not just the best two.
  const graph = useMemo(() => buildGraph(routes, Infinity), [routes]);
  const n = graph.connectors.length;
  return (
    <Panel
      title="Your network map"
      description={
        n
          ? `${n} ${n === 1 ? "connection" : "connections"} on record between ${from.name} and ${to.name}. Hover or tap to follow a route.`
          : `How ${from.name} is tied to ${to.name} on record.`
      }
      bodyClassName="pt-2"
    >
      <MapBody graph={graph} routes={routes} you={from} focus={focus} setFocus={setFocus} targetHeading="Who you want to meet" showScore={false} />
    </Panel>
  );
}

type MapProps = {
  graph: Graph;
  routes: Route[];
  you: Node;
  focus: string | null;
  setFocus: (id: string | null) => void;
  /** Heading of the right-hand column. */
  targetHeading?: string;
  /** The match score beside each target; off where the target is not a matched investor. */
  showScore?: boolean;
};

/** The legend, the graph (md and up) and the compact list (phones). */
function MapBody(props: MapProps) {
  const { graph, routes } = props;
  const counts = (["investor", "company", "event"] as Kind[]).map((k) => ({ k, n: graph.connectors.filter((c) => c.kind === k).length }));
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
        {counts.map(({ k, n }) => (
          <span key={k} className="flex items-center gap-1.5">
            <Marker kind={k} />
            {KIND_LABEL[k]}
            <span className="font-semibold text-foreground tabular">{n}</span>
          </span>
        ))}
        {routes.some((r) => r.kinds.has("direct")) && (
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-success" /> Already connected
          </span>
        )}
      </div>
      <div className="hidden md:block">
        <NetworkGraph {...props} />
      </div>
      <CompactMap {...props} />
    </>
  );
}

// ---- Connectors shared by the graph and the compact map ----

type Connector = { id: string; name: string; kind: Kind; title: string; investors: Set<string> };

const CAP: Record<Kind, number> = { investor: 5, company: 4, event: 3 };
const PER_INVESTOR = 2;

function buildGraph(routes: Route[], perInvestor = PER_INVESTOR) {
  const map = new Map<string, Connector>();
  const add = (id: string, name: string, kind: Kind, title: string, investor: string) => {
    const c = map.get(id);
    if (c) return void c.investors.add(investor);
    if ([...map.values()].filter((x) => x.kind === kind).length >= CAP[kind]) return;
    map.set(id, { id, name, kind, title, investors: new Set([investor]) });
  };
  for (const r of routes) {
    const inv = r.investor.id;
    for (const p of r.result?.paths.slice(0, perInvestor) ?? [])
      add(p.via.id, p.via.name, p.via.investor ? "investor" : "company", `${p.via.name} ${askReason(p.tie)}`, inv);
    for (const b of r.result?.bridges.slice(0, perInvestor) ?? [])
      add(b.company.id, b.company.name, "company", `${b.company.name}: backed by your investor ${b.via.name}`, inv);
    for (const e of r.events) add(e.id, e.name, "event", e.name, inv);
  }
  const order: Kind[] = ["investor", "company", "event"];
  const connectors = [...map.values()].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  return { connectors };
}

type Graph = ReturnType<typeof buildGraph>;

function Marker({ kind, className }: { kind: Kind; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block size-2 shrink-0",
        kind === "investor" && "rounded-full bg-primary",
        kind === "company" && "rounded-[2px] bg-[#8792e8]",
        kind === "event" && "rotate-45 rounded-[1px] bg-slush",
        className,
      )}
    />
  );
}

function short(name: string, max: number) {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

// ---- Graph (md and up) ----

const W = 768;
const COL = { you: 2, mid: 300, inv: 598 };
const PILL_W = 168;
const PILL_H = 32;
const ROW = 44;
const GAP = 18; // between connector groups
const TOP = 34;

function NetworkGraph({ graph, routes, you, focus, setFocus, targetHeading = "Investors to reach", showScore = true }: MapProps) {
  const layout = useMemo(() => {
    // Middle column: connectors in groups (investors, companies, events) with a small gap between groups.
    const midY = new Map<string, number>();
    let y = 0;
    graph.connectors.forEach((c, i) => {
      if (i > 0 && graph.connectors[i - 1].kind !== c.kind) y += GAP;
      midY.set(c.id, y);
      y += ROW;
    });
    const midH = Math.max(y, ROW);
    const invH = Math.max(routes.length, 1) * ROW;
    const inner = Math.max(midH, invH);
    const center = (h: number) => TOP + (inner - h) / 2 + ROW / 2;
    for (const [id, v] of midY) midY.set(id, v + center(midH));
    const invY = new Map(routes.map((r, i) => [r.investor.id, center(invH) + i * ROW]));
    const youY = TOP + inner / 2;

    type Edge = { key: string; d: string; color: string; dashed: boolean; investors: Set<string>; via?: string };
    const curve = (x1: number, y1: number, x2: number, y2: number) => {
      const dx = (x2 - x1) / 2;
      return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
    };
    const edges: Edge[] = [];
    for (const c of graph.connectors)
      edges.push({ key: `you>${c.id}`, d: curve(COL.you + PILL_W, youY, COL.mid, midY.get(c.id)!), color: STATUS[c.kind].color, dashed: false, investors: c.investors, via: c.id });
    for (const c of graph.connectors)
      for (const inv of c.investors)
        edges.push({ key: `${c.id}>${inv}`, d: curve(COL.mid + PILL_W, midY.get(c.id)!, COL.inv, invY.get(inv)!), color: STATUS[c.kind].color, dashed: false, investors: new Set([inv]), via: c.id });
    for (const r of routes)
      if (r.kinds.has("direct") || (r.kinds.has("common") && r.status === "common"))
        edges.push({
          key: `you>>${r.investor.id}`,
          d: curve(COL.you + PILL_W, youY, COL.inv, invY.get(r.investor.id)!),
          color: STATUS[r.kinds.has("direct") ? "direct" : "common"].color,
          dashed: !r.kinds.has("direct"),
          investors: new Set([r.investor.id]),
        });
    return { midY, invY, youY, height: TOP + inner + 6, edges };
  }, [graph, routes]);

  const lit = (e: { investors: Set<string>; via?: string }) => !focus || e.investors.has(focus) || e.via === focus;
  const midLit = (c: Connector) => !focus || c.id === focus || c.investors.has(focus);
  const invLit = (id: string) => !focus || id === focus || !!graph.connectors.find((c) => c.id === focus)?.investors.has(id);

  return (
    <svg viewBox={`0 0 ${W} ${layout.height}`} className="w-full" role="img" aria-label={showScore ? `Network map from ${you.name} to its investors` : `Network map from ${you.name} to ${routes[0]?.investor.name}`}>
      {[
        { x: COL.you, t: "You" },
        { x: COL.mid, t: "Who can connect you" },
        { x: COL.inv, t: targetHeading },
      ].map((h) => (
        <text key={h.t} x={h.x + 4} y={14} className="fill-muted-foreground text-[11px] font-medium tracking-wide uppercase">
          {h.t}
        </text>
      ))}

      {layout.edges.map((e) => (
        <path
          key={e.key}
          d={e.d}
          fill="none"
          stroke={e.color}
          strokeWidth={focus && lit(e) ? 2.25 : 1.5}
          strokeDasharray={e.dashed ? "5 4" : undefined}
          opacity={lit(e) ? (focus ? 0.95 : 0.5) : 0.07}
          className="transition-opacity duration-150"
        />
      ))}

      {graph.connectors.length === 0 && (
        <text x={COL.mid + PILL_W / 2} y={layout.youY + 4} textAnchor="middle" className="fill-subtle text-[12px]">
          No shared connections on record
        </text>
      )}

      <rect x={COL.you} y={layout.youY - PILL_H / 2} width={PILL_W} height={PILL_H} rx={9} className="fill-primary" />
      <text x={COL.you + 14} y={layout.youY + 4.5} className="fill-primary-foreground text-[13px] font-semibold">
        {short(you.name, 20)}
        <title>{you.name}</title>
      </text>

      {graph.connectors.map((c) => {
        const y = layout.midY.get(c.id)!;
        const mx = COL.mid + 14;
        return (
          <g
            key={c.id}
            onMouseEnter={() => setFocus(c.id)}
            onMouseLeave={() => setFocus(null)}
            opacity={midLit(c) ? 1 : 0.35}
            className="transition-opacity duration-150"
          >
            <title>{`${c.title}. Connects you to ${c.investors.size} ${c.investors.size === 1 ? "investor" : "investors"}.`}</title>
            <rect x={COL.mid} y={y - PILL_H / 2} width={PILL_W} height={PILL_H} rx={9} className={cn("fill-card", focus === c.id ? "stroke-primary" : "stroke-border")} />
            {c.kind === "investor" && <circle cx={mx} cy={y} r={3.5} fill={STATUS.investor.color} />}
            {c.kind === "company" && <rect x={mx - 3.5} y={y - 3.5} width={7} height={7} rx={1.5} fill={STATUS.company.color} />}
            {c.kind === "event" && <rect x={mx - 3.2} y={y - 3.2} width={6.4} height={6.4} rx={1} fill={STATUS.event.color} transform={`rotate(45 ${mx} ${y})`} />}
            <text x={COL.mid + 26} y={y + 4.5} className="fill-foreground text-[12.5px] font-medium">
              {short(c.name, 19)}
            </text>
          </g>
        );
      })}

      {routes.map((r) => {
        const y = layout.invY.get(r.investor.id)!;
        const cold = r.status === "cold";
        return (
          <g
            key={r.investor.id}
            onMouseEnter={() => setFocus(r.investor.id)}
            onMouseLeave={() => setFocus(null)}
            opacity={invLit(r.investor.id) ? 1 : 0.35}
            className="transition-opacity duration-150"
          >
            <title>{`${r.investor.name}: ${STATUS[r.status].label}${showScore ? `, ${r.investor.score}% match` : ""}`}</title>
            <rect
              x={COL.inv}
              y={y - PILL_H / 2}
              width={PILL_W}
              height={PILL_H}
              rx={9}
              className={cn("fill-card", focus === r.investor.id ? "stroke-primary" : "stroke-border")}
              strokeWidth={focus === r.investor.id ? 1.5 : 1}
              strokeDasharray={cold ? "4 3" : undefined}
            />
            <text x={COL.inv + 12} y={y + 4.5} className={cn("text-[12.5px] font-medium", cold ? "fill-muted-foreground" : "fill-foreground")}>
              {short(r.investor.name, showScore ? 16 : 20)}
            </text>
            {showScore && (
              <text x={COL.inv + PILL_W - 10} y={y + 4.5} textAnchor="end" className="fill-subtle text-[11px] tabular">
                {r.investor.score}%
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ---- Compact map (phones): one row per investor with the connectors that reach it ----

function CompactMap({ graph, routes, focus, setFocus, showScore = true }: MapProps) {
  return (
    <ul className="divide-y rounded-lg border md:hidden">
      {routes.map((r) => {
        const via = graph.connectors.filter((c) => c.investors.has(r.investor.id));
        const on = focus === r.investor.id;
        return (
          <li key={r.investor.id}>
            <button
              type="button"
              onClick={() => setFocus(on ? null : r.investor.id)}
              className={cn("w-full px-3 py-2.5 text-left transition-colors", on && "bg-brand-soft/50")}
            >
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{r.investor.name}</span>
                {showScore && <span className="text-[11px] text-subtle tabular">{r.investor.score}%</span>}
              </span>
              <span className="mt-1.5 flex flex-wrap gap-1.5">
                {r.kinds.has("direct") && (
                  <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-success-soft px-2 text-[11.5px] text-success">
                    <Handshake className="size-3" /> Already connected
                  </span>
                )}
                {via.map((c) => (
                  <span key={c.id} className="inline-flex h-6 max-w-full items-center gap-1.5 rounded-full border bg-card px-2 text-[11.5px]">
                    <Marker kind={c.kind} />
                    <span className="truncate">{c.name}</span>
                  </span>
                ))}
                {!via.length && !r.kinds.has("direct") && (
                  <span className="inline-flex h-6 items-center rounded-full border border-dashed px-2 text-[11.5px] text-muted-foreground">
                    {r.kinds.has("common") ? "Common ground only" : "No one on record yet"}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ---- Cards ----

type Step = { kind: Status; text: React.ReactNode; sources?: Source[] };

const STEP_ICON: Record<Status, typeof Landmark> = {
  direct: Handshake,
  investor: Landmark,
  company: Building2,
  event: CalendarDays,
  common: Handshake,
  cold: Send,
};

function RouteCard({
  r,
  you,
  youAtSlush,
  focused,
  setFocus,
}: {
  r: Route;
  you: Node;
  youAtSlush: boolean;
  focused: boolean;
  setFocus: (id: string | null) => void;
}) {
  const { investor: inv, result } = r;
  const to: Node = result?.to ?? { id: inv.id, name: inv.name, atSlush: false, investor: true };
  const intros = result?.paths.length ?? 0;

  const steps: Step[] = [];
  if (result?.direct) steps.push({ kind: "direct", text: <>You are already connected: {tieSentence(result.direct, you, to)}. Reach out directly.</>, sources: result.direct.sources });
  if (result?.paths[0]) steps.push(introStep(result.paths[0], to));
  if (result?.bridges[0]) steps.push(bridgeStep(result.bridges[0], to));
  for (const e of r.events.slice(0, 2)) steps.push(eventStep(e, youAtSlush));
  if (result?.common && !result.paths.length) {
    const c = result.common;
    steps.push({
      kind: "common",
      text: <>Open with common ground: you {c.kind === "same_round" ? `were both in ${roundName(c.round)}` : `both backed ${companyList(c.companies)}`}.</>,
      sources: c.sources,
    });
  }
  if (!steps.length)
    steps.push({ kind: "cold", text: r.error ? <>Could not check routes: {r.error}</> : <>No one on record connects you yet. Reach out directly, leading with why they fit.</> });

  return (
    <li
      onMouseEnter={() => setFocus(inv.id)}
      onMouseLeave={() => setFocus(null)}
      className={cn("flex min-w-0 flex-col rounded-xl border bg-card p-4 transition-colors", focused && "border-primary/50 ring-1 ring-primary/20")}
    >
      <div className="flex items-start gap-3">
        <EntityAvatar name={inv.name} kind="investor" size="sm" />
        <div className="min-w-0 flex-1">
          <Link href={`/investor/${inv.id}`} className="block truncate text-sm font-semibold hover:text-primary hover:underline" title={inv.name}>
            {inv.name}
          </Link>
          <span className="text-xs text-muted-foreground">{[inv.country, `${inv.score}% match`].filter(Boolean).join(" · ")}</span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={cn("inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-[11px] font-medium", STATUS[r.status].pill)}>
            <span className={cn("size-1.5 rounded-full", STATUS[r.status].dot)} />
            {STATUS[r.status].label}
          </span>
          {to.atSlush && <SlushTag label="At Slush" />}
        </div>
      </div>

      <p className="mt-3 mb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Ways in</p>
      <ul className="flex-1 space-y-2">
        {steps.map((s, i) => {
          const Icon = STEP_ICON[s.kind];
          return (
            <li key={i} className="flex gap-2.5 text-[13px] leading-snug">
              <span className={cn("mt-px flex size-[22px] shrink-0 items-center justify-center rounded-md", STATUS[s.kind].pill)}>
                <Icon className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1 pt-0.5">{s.text}</span>
              {s.sources && <SourceChip sources={s.sources} className="mt-0.5" />}
            </li>
          );
        })}
      </ul>

      <p className="mt-3 flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        <span className="min-w-0 flex-1">
          <span className="font-medium text-foreground">Why they fit you: </span>
          {inv.why}
        </span>
        <SourceChip sources={inv.sources} />
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
        {result && intros > 0 && (
          <Link href={introsHref(you, inv)} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            {intros > 1 ? `All ${intros} intro routes` : "Intro route details"} <ArrowRight className="size-3.5" />
          </Link>
        )}
        <Link href={`/investor/${inv.id}`} className="text-muted-foreground hover:text-foreground">
          Investor brief
        </Link>
        {inv.website?.value && (
          <a
            href={inv.website.value.startsWith("http") ? inv.website.value : `https://${inv.website.value}`}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <Globe className="size-3.5" /> Website <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    </li>
  );
}

function introStep(p: IntroPath, to: Node): Step {
  const both = `${p.via.name} and ${to.name}`;
  const how =
    p.link.kind === "same_round"
      ? `${both} were both investors in ${roundName(p.link.round)}`
      : p.link.kind === "shared_portfolio"
        ? `${both} both backed ${companyList(p.link.companies)}`
        : linkSentence(p.link, p.via, to).replace(/^invested/, `${p.via.name} invested`);
  return {
    kind: p.via.investor ? "investor" : "company",
    text: (
      <>
        Ask <EntityLink id={p.via.id} name={p.via.name} investor={p.via.investor} /> {askReason(p.tie)} for an intro. {how.replace(/\.$/, "")}.
      </>
    ),
    sources: [...p.tie.sources, ...p.link.sources],
  };
}

function bridgeStep(b: CompanyBridge, to: Node): Step {
  return {
    kind: "company",
    text: (
      <>
        Ask the founders of <EntityLink id={b.company.id} name={b.company.name} /> for a referral. Your investor {b.via.name} and {to.name} both backed them.
      </>
    ),
    sources: b.sources,
  };
}

function eventStep(e: EventLink, youAtSlush: boolean): Step {
  const day = e.date ? new Date(`${e.date}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : null;
  const link = (
    <Link href={e.href} className="font-medium hover:text-primary hover:underline">
      {e.role === "attendee" ? e.name : short(e.name, 70)}
    </Link>
  );
  return {
    kind: "event",
    text:
      e.role === "attendee" ? (
        <>
          Meet them at {link} (18–19 Nov). They are on the attendee list{youAtSlush ? ", and so are you" : ""}.
        </>
      ) : (
        <>
          Meet them at {link}
          {day ? ` on ${day}` : ""}, where they {e.role === "host" ? "are a host" : "are speaking"}.
        </>
      ),
    sources: e.sources,
  };
}

function introsHref(from: Node, to: { id: string; name: string }) {
  return `/intros?${new URLSearchParams({ from: from.id, fromName: from.name, to: to.id, toName: to.name })}`;
}

function EntityLink({ id, name, investor }: { id: string; name: string; investor?: boolean }) {
  return (
    <Link href={`/${investor ? "investor" : "company"}/${id}`} className="font-medium hover:text-primary hover:underline">
      {name}
    </Link>
  );
}
