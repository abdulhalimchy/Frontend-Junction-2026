import "server-only";
import type { Source } from "@/lib/types";
import { normaliseName } from "@/lib/names";
import { mapLimit, retrieveEntity, toSources, type RelationshipEdge } from "./client";
import { fetchRoundDetail } from "./rounds";
import { slushAttendeeIndex } from "./slush";

// Warm intro paths: who that `from` already has a tie with can introduce it to `to`.
//
//   from ──tie── contact ──link── to
//
// Ties (from ↔ contact): the contact invested in `from` (directly or in one of its rounds), `from` invested in
// the contact, or both were investors in the same round. Links (contact ↔ to): one invested in the other, both
// were in the same round, or both backed the same company. Every edge is a Cala relationship with its sources.
// Cost: 1 call per entity, plus one per round of `from` (capped), cached 7 days and shared with the briefs.

const MAX_ROUNDS = 6; // rounds of `from` read to find its investors / co-investors
const MAX_CONTACTS = 15; // contacts checked against the target
const MAX_PATHS = 8;
const MAX_BRIDGES = 4;

const QUERY = {
  properties: ["name"],
  relationships: {
    outgoing: { INVESTED_IN: { limit: 100 }, PARTICIPATES_IN_FUNDING_ROUND: { limit: 100 } },
    incoming: { INVESTED_IN: { limit: 50 } },
  },
};

/** `investor`: Cala has it investing (portfolio or rounds as an investor), so it links to the investor brief. */
export type Node = { id: string; name: string; atSlush: boolean; investor: boolean };

export type Tie = {
  kind: "backs_you" | "you_backed" | "co_invested";
  lead: boolean;
  /** The round the tie comes from, when it is a round (stage only; detail is loaded for shown paths). */
  round: { id: string; stage: string } | null;
  sources: Source[];
};

export type Link =
  | { kind: "invested_in_target" | "target_invested"; round: RoundRef | null; sources: Source[] }
  | { kind: "same_round"; round: RoundRef; sources: Source[] }
  | { kind: "shared_portfolio"; companies: { id: string; name: string; sources: Source[] }[]; sources: Source[] };

export type CommonGround = Extract<Link, { kind: "same_round" | "shared_portfolio" }>;

export type RoundRef = { id: string; stage: string; company: string | null; date: string | null };

export type IntroPath = { via: Node; tie: Tie; link: Link; score: number };

/** A company that one of `from`'s investors and `to` both backed: its founders know both sides. */
export type CompanyBridge = { company: { id: string; name: string }; via: Node; sources: Source[] };

export type IntroResult = {
  from: Node;
  to: Node;
  /** Set when `from` and `to` are already tied (no intro needed). */
  direct: Tie | null;
  /** A deal `from` and `to` already share (same round, or both backed a company): a natural opener. */
  common: CommonGround | null;
  paths: IntroPath[];
  /** Companies backed by both one of `from`'s investors and `to` (founder referrals), strongest investor first. */
  bridges: CompanyBridge[];
  /** How many of `from`'s contacts were checked, and how many it has on record. */
  checked: number;
  contacts: number;
};

type Ties = {
  id: string;
  name: string;
  portfolio: Map<string, RelationshipEdge>;
  backers: Map<string, RelationshipEdge>;
  rounds: Map<string, RelationshipEdge>; // round id → this entity's participation edge
};

async function loadTies(id: string): Promise<Ties> {
  const e = await retrieveEntity(id, QUERY);
  const out = e.relationships?.outgoing ?? {};
  const inc = e.relationships?.incoming ?? {};
  const byId = (list: RelationshipEdge[] | undefined) => new Map((list ?? []).map((r) => [r.id, r]));
  return { id: e.id, name: e.name, portfolio: byId(out.INVESTED_IN), backers: byId(inc.INVESTED_IN), rounds: byId(out.PARTICIPATES_IN_FUNDING_ROUND) };
}

const isIssuer = (r: RelationshipEdge) => (r.properties.role ?? "ISSUER") === "ISSUER";
const TIE_SCORE: Record<Tie["kind"], number> = { backs_you: 3, you_backed: 2.6, co_invested: 2 };
const tieScore = (t: Tie) => TIE_SCORE[t.kind] + (t.lead ? 0.3 : 0);

/**
 * Mostly investing (portfolio and rounds as an investor) rather than raising. Cala sometimes records an
 * INVESTED_IN edge in both directions between a fund and a startup; this picks the plausible one.
 */
function mostlyInvests(x: Ties) {
  const rounds = [...x.rounds.values()];
  const asInvestor = rounds.filter((r) => !isIssuer(r)).length;
  return x.portfolio.size + asInvestor > x.backers.size + (rounds.length - asInvestor);
}

/** Everyone `from` has a tie with, strongest tie per contact. */
type Contact = { node: { id: string; name: string }; tie: Tie; weight: number };

async function contactsOf(f: Ties): Promise<Map<string, Contact>> {
  const investor = mostlyInvests(f);
  const found = new Map<string, Contact>();
  const add = (id: string, name: string, tie: Tie) => {
    if (id === f.id) return;
    // A startup "investing in" a fund is usually a misread edge: keep it, but try it last.
    const weight = tieScore(tie) - (tie.kind === "you_backed" && !investor ? 1.4 : 0);
    const cur = found.get(id);
    if (!cur || weight > cur.weight) found.set(id, { node: { id, name }, tie, weight });
  };

  // Where Cala has both directions, keep the one that fits `from`: a fund backed it, a startup was backed.
  for (const r of f.backers.values())
    if (!(investor && f.portfolio.has(r.id))) add(r.id, r.name, { kind: "backs_you", lead: false, round: null, sources: toSources(r.properties.sources) });
  for (const r of f.portfolio.values())
    if (!(!investor && f.backers.has(r.id))) add(r.id, r.name, { kind: "you_backed", lead: false, round: null, sources: toSources(r.properties.sources) });

  // Rounds: as the issuer, its participants are its investors; as an investor, they are co-investors.
  const rounds = [...f.rounds.values()].slice(0, MAX_ROUNDS);
  const details = await mapLimit(rounds, 4, (r) => fetchRoundDetail(r.id, r.name).catch(() => null));
  rounds.forEach((r, i) => {
    const d = details[i];
    if (!d) return;
    const kind: Tie["kind"] = isIssuer(r) ? "backs_you" : "co_invested";
    const leads = new Set(d.leads.map((p) => p.id));
    for (const p of [...d.leads, ...d.participants])
      add(p.id, p.name, { kind, lead: kind === "backs_you" && leads.has(p.id), round: { id: r.id, stage: r.name }, sources: p.sources });
  });

  // The same firm is often on record under several legal names ("Skyfall Ventures", "SKYFALL VENTURES AS").
  const seen = new Set<string>();
  for (const [id, c] of found) {
    const key = normaliseName(c.node.name);
    if (seen.has(key)) found.delete(id);
    else seen.add(key);
  }
  return found;
}

/** The strongest link between a contact and the target, or null. */
function linkBetween(a: Ties, t: Ties, skip: Set<string> = new Set()): { link: Link; score: number } | null {
  const src = (r: RelationshipEdge | undefined) => toSources(r?.properties.sources);
  // Both directions on record: trust the side that mostly invests.
  if (a.portfolio.has(t.id) && a.backers.has(t.id) && !mostlyInvests(a))
    return { link: { kind: "target_invested", round: null, sources: src(a.backers.get(t.id)) }, score: 3 };
  if (a.portfolio.has(t.id)) return { link: { kind: "invested_in_target", round: null, sources: src(a.portfolio.get(t.id)) }, score: 3 };
  if (a.backers.has(t.id)) return { link: { kind: "target_invested", round: null, sources: src(a.backers.get(t.id)) }, score: 3 };

  for (const [rid, ar] of a.rounds) {
    const tr = t.rounds.get(rid);
    if (!tr) continue;
    const round: RoundRef = { id: rid, stage: ar.name, company: null, date: null };
    const sources = [...src(ar), ...src(tr)];
    if (isIssuer(tr)) return { link: { kind: "invested_in_target", round, sources }, score: 3 };
    if (isIssuer(ar)) return { link: { kind: "target_invested", round, sources }, score: 3 };
    return { link: { kind: "same_round", round, sources }, score: 2.5 };
  }

  const shared = [...a.portfolio.keys()].filter((id) => t.portfolio.has(id) && id !== a.id && id !== t.id && !skip.has(id));
  if (shared.length) {
    const companies = shared.map((id) => ({
      id,
      name: a.portfolio.get(id)!.name,
      sources: [...src(a.portfolio.get(id)), ...src(t.portfolio.get(id))],
    }));
    return { link: { kind: "shared_portfolio", companies, sources: companies.flatMap((c) => c.sources) }, score: 1.5 + Math.min(shared.length, 5) * 0.1 };
  }
  return null;
}

export async function findIntroPaths(fromId: string, toId: string): Promise<IntroResult> {
  const [f, t, slush] = await Promise.all([loadTies(fromId), loadTies(toId), slushAttendeeIndex().catch(() => null)]);
  const node = (x: Ties): Node => ({
    id: x.id,
    name: x.name,
    atSlush: !!slush && (slush.ids.has(x.id) || slush.names.has(normaliseName(x.name))),
    investor: x.portfolio.size > 0 || [...x.rounds.values()].some((r) => !isIssuer(r)),
  });

  const contacts = await contactsOf(f);
  // The target, or the same firm under another legal name ("Index Ventures Limited" for "INDEX VENTURES (UK) LLP").
  const targetKey = normaliseName(t.name);
  let direct: Tie | null = contacts.get(t.id)?.tie ?? null;
  for (const [id, c] of contacts)
    if (id === t.id || normaliseName(c.node.name) === targetKey) {
      if (!direct || c.weight > tieScore(direct)) direct = c.tie;
      contacts.delete(id);
    }

  // Check the strongest ties first: investors in `from` (leads first), then its portfolio, then co-investors.
  const ranked = [...contacts.values()]
    .sort((x, y) => y.weight - x.weight)
    .slice(0, MAX_CONTACTS);
  const checked = await mapLimit(ranked, 4, async (c) => {
    const a = await loadTies(c.node.id).catch(() => null);
    if (!a) return { path: null, bridges: [] as CompanyBridge[] };
    const hit = linkBetween(a, t, new Set([f.id]));
    // Founder referrals: companies this investor of `from` backed that `to` backed too.
    const bridges: CompanyBridge[] =
      c.tie.kind === "backs_you"
        ? [...a.portfolio.values()]
            .filter((r) => r.id !== f.id && r.id !== t.id && t.portfolio.has(r.id))
            .map((r) => ({ company: { id: r.id, name: r.name }, via: node(a), sources: [...toSources(r.properties.sources), ...toSources(t.portfolio.get(r.id)!.properties.sources)] }))
        : [];
    return { path: hit ? { via: node(a), tie: c.tie, link: hit.link, score: c.weight + hit.score } : null, bridges };
  });
  const seenCompanies = new Set<string>();
  const bridges = checked
    .flatMap((c) => c.bridges)
    .filter((b) => {
      const key = normaliseName(b.company.name);
      if (seenCompanies.has(key)) return false;
      seenCompanies.add(key);
      return true;
    })
    .slice(0, MAX_BRIDGES);
  const paths = checked
    .map((c) => c.path)
    .filter((p): p is IntroPath => !!p)
    .sort((x, y) => y.score - x.score)
    .slice(0, MAX_PATHS);

  // Common ground between the two sides themselves (only shown when they are not already tied).
  const shared = direct ? null : linkBetween(f, t);
  const common: CommonGround | null =
    shared && (shared.link.kind === "same_round" || shared.link.kind === "shared_portfolio") ? shared.link : null;

  // Name the rounds on shown links (which company raised it, and when): one cached call per round.
  const links = [...paths.map((p) => p.link), ...(common ? [common] : [])];
  await mapLimit(links, 4, async (l) => {
    const r = l.kind !== "shared_portfolio" ? l.round : null;
    if (!r) return;
    const d = await fetchRoundDetail(r.id, r.stage).catch(() => null);
    if (d) Object.assign(r, { company: d.issuer?.name ?? null, date: d.round.date?.date ?? null, stage: d.round.stage || r.stage });
  });

  return { from: node(f), to: node(t), direct, common, paths, bridges, checked: ranked.length, contacts: contacts.size };
}
