import "server-only";
import { normaliseName } from "@/lib/names";
import { SIDE_EVENTS, eventOrgs } from "@/lib/slush/side-events";
import type { InvestorMatch, Source } from "@/lib/types";
import { calaErrorKind, mapLimit } from "./client";
import { findIntroPaths, type IntroResult } from "./intros";
import { fetchSlush } from "./slush";

// Connect tab: for a startup's best-matched investors, every way the founder can reach each one.
//   investors  your investors and co-investors who know them (warm intro search)
//   companies  companies one of your investors and they both backed (founder referral)
//   events     Slush 2026 (verified attendee list) and Slush Week side events they host or speak at
// The startup's own ties and its contacts' ties are cached, so each extra investor costs about one call.

export const MAX_TARGETS = 6;
const MAX_EVENTS = 3;

export type InvestorTarget = Pick<InvestorMatch, "id" | "name" | "country" | "why" | "website" | "sources"> & { score: number };

/** An event where the founder can meet the investor in person. */
export type EventLink = {
  id: string;
  name: string;
  date: string | null; // YYYY-MM-DD
  href: string;
  role: "attendee" | "host" | "speaker";
  sources: Source[];
};

export type InvestorRoute = {
  investor: InvestorTarget;
  /** null when the lookup failed for this investor (`error` says why). */
  result: IntroResult | null;
  events: EventLink[];
  error: string | null;
};

export type ConnectData = { routes: InvestorRoute[]; youAtSlush: boolean };

const SLUSH = { id: "slush-2026", name: "Slush 2026", date: "2026-11-18", href: "/events/slush-2026/overview" };

export async function findInvestorRoutes(fromId: string, investors: InvestorMatch[]): Promise<ConnectData> {
  const targets = investors.filter((i) => !i.existing && i.id !== fromId).slice(0, MAX_TARGETS);
  const slush = await fetchSlush().catch(() => null);
  const attendees = new Map<string, Source[]>();
  for (const a of slush?.attendees ?? []) {
    attendees.set(a.id, a.sources);
    attendees.set(normaliseName(a.name), a.sources);
  }
  const slushSources = (id: string, name: string) => attendees.get(id) ?? attendees.get(normaliseName(name)) ?? null;

  const routes = await mapLimit(targets, 2, async (i): Promise<InvestorRoute> => {
    const investor: InvestorTarget = {
      id: i.id,
      name: i.name,
      country: i.country,
      why: i.why,
      website: i.website,
      sources: i.sources,
      score: i.match.score,
    };
    const events = eventsFor(i.name, slushSources(i.id, i.name));
    try {
      return { investor, result: await findIntroPaths(fromId, i.id), events, error: null };
    } catch (e) {
      const kind = calaErrorKind(e);
      const error = kind === "no_credit" ? "Data credit is used up." : kind === "rate_limited" ? "Too many requests; try again shortly." : "Could not load this investor.";
      return { investor, result: null, events, error };
    }
  });
  return { routes, youAtSlush: routes.some((r) => r.result?.from.atSlush) };
}

/** The events where one company or investor can be met: for the Connect page, which has a single target. */
export async function eventLinksFor(id: string, name: string): Promise<EventLink[]> {
  const slush = await fetchSlush().catch(() => null);
  const key = normaliseName(name);
  const hit = slush?.attendees.find((a) => a.id === id || normaliseName(a.name) === key);
  return eventsFor(name, hit?.sources ?? null);
}

/** Slush itself when the investor is on the attendee list, then side events where it hosts or speaks (exact name match). */
function eventsFor(name: string, slushSrc: Source[] | null): EventLink[] {
  const key = normaliseName(name);
  const out: EventLink[] = [];
  if (slushSrc) out.push({ ...SLUSH, role: "attendee", sources: slushSrc });
  for (const e of SIDE_EVENTS) {
    const org = eventOrgs(e).find((o) => normaliseName(o.name) === key);
    if (!org) continue;
    out.push({
      id: e.id,
      name: e.title,
      date: e.date,
      href: `/events/slush-2026/side-events#${e.id}`,
      role: org.role,
      sources: [{ name: e.sourceName, document: e.url, date: e.checkedOn, date_precision: "day", source_rank: "PRIMARY" }],
    });
  }
  return out.slice(0, MAX_EVENTS);
}
