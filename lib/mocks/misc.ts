import type { Alert, EventInfo, MetEntry, Profile, Role } from "@/lib/types";
import { S } from "./sources";

export const SLUSH_EVENT_ID = "bc844d56-6ab4-452b-96bf-2661e86e592b";

export const profiles: Record<Role, Profile> = {
  founder: {
    name: "Anna Virtanen",
    email: "anna@northlight.example",
    role: "founder",
    personId: "anna-virtanen",
    companyId: "northlight-robotics",
    goals: ["Raise a seed round", "Meet maritime investors at Slush", "Track competitors"],
    privacy: { showInEventDirectory: true, showCardInSearch: true, shareMetList: false, allowAlertsEmail: true },
  },
  investor: {
    name: "Jonas Berg",
    email: "jonas@fjord.example",
    role: "investor",
    personId: "jonas-berg",
    investorId: "fjord-ventures",
    goals: ["Source seed deals", "Monitor portfolio competitors", "Meet founders at Slush"],
    privacy: { showInEventDirectory: true, showCardInSearch: true, shareMetList: false, allowAlertsEmail: false },
  },
};

export const slushEvent: EventInfo = {
  id: SLUSH_EVENT_ID,
  name: "Slush 2026",
  city: { value: "Helsinki, Finland", sources: [S.slush("event")] },
  dates: { value: { start: "2026-11-18", end: "2026-11-19" }, sources: [S.slush("event")] },
  attendeeCompanies: { value: 3412, sources: [S.slush("companies")] },
  attendeeInvestors: { value: 1268, sources: [S.slush("investors")] },
  newThisWeek: 184,
};

export const alerts: Alert[] = [
  {
    id: "a1",
    kind: "competitor_round",
    title: "PortBotics extended its seed by €2.0M",
    body: "Led by Fjord Ventures. PortBotics is your closest competitor by description.",
    date: "2026-10-30",
    read: false,
    href: "/company/portbotics",
    roles: ["founder"],
    sources: [S.press("PortBotics extends seed", "2026-10-30")],
  },
  {
    id: "a2",
    kind: "slush_attendee",
    title: "Tidewise is now attending Slush 2026",
    body: "A competitor joined the attendee list this week.",
    date: "2026-11-11",
    read: false,
    href: "/company/tidewise",
    roles: ["founder", "investor"],
    slush: true,
    sources: [S.slush("companies/tidewise", "2026-11-11")],
  },
  {
    id: "a3",
    kind: "investor_activity",
    title: "Fjord Ventures made a new investment",
    body: "Seed extension in PortBotics (€2.0M). Fjord is on your Slush shortlist.",
    date: "2026-10-30",
    read: true,
    href: "/investor/fjord-ventures",
    roles: ["founder"],
    sources: [S.press("PortBotics extends seed", "2026-10-30")],
  },
  {
    id: "a4",
    kind: "portfolio_competitor",
    title: "Saltline Systems overlaps with PortBotics",
    body: "New company on record, matched on description: hull-cleaning planning for fleets. No funding on record.",
    date: "2026-11-09",
    read: false,
    href: "/company/saltline-systems",
    roles: ["investor"],
    sources: [S.site("Saltline Systems")],
  },
  {
    id: "a5",
    kind: "portfolio_competitor",
    title: "Northlight Robotics is attending Slush",
    body: "Competes with your portfolio company PortBotics. Raising seed, per their profile.",
    date: "2026-10-28",
    read: true,
    href: "/company/northlight-robotics",
    roles: ["investor"],
    slush: true,
    sources: [S.slush("companies/northlight-robotics", "2026-10-28")],
  },
  {
    id: "a6",
    kind: "profile",
    title: "Your employee count was updated",
    body: "Cala now lists Northlight Robotics as 11–50 employees.",
    date: "2026-10-12",
    read: true,
    href: "/startup/overview",
    roles: ["founder"],
    sources: [S.linkedin("Northlight Robotics")],
  },
];

export const metByRole: Record<Role, MetEntry[]> = {
  founder: [
    { id: "m1", personId: "jonas-berg", metAt: "2026-11-12", where: "Slush pre-event, Helsinki", note: "Interested in hull data; asked for deck after Slush.", slush: true },
    { id: "m2", personId: "pekka-harju", metAt: "2026-10-03", where: "Coffee, Helsinki", note: "Existing investor. Can intro to port operators.", slush: false },
    { id: "m3", personId: "elin-strand", metAt: "2026-09-18", where: "Nordic Ocean Week", note: "Mostly follows; ask who they co-invest with.", slush: false },
  ],
  investor: [
    { id: "m4", personId: "anna-virtanen", metAt: "2026-11-12", where: "Slush pre-event, Helsinki", note: "Hull inspection robots, raising seed. Check overlap with PortBotics.", slush: true },
    { id: "m5", personId: "maren-aas", metAt: "2026-10-21", where: "Portfolio day", note: "Trial readout in Q1.", slush: false },
  ],
};
