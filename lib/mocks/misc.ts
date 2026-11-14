import type { Alert, DeckCheckResult, EventInfo, MarketSnapshot, MetEntry, Profile, Role } from "@/lib/types";
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

export const market: MarketSnapshot = {
  sector: "Maritime robotics",
  region: "Nordics and Benelux",
  companyCount: { value: 46, sources: [S.news("Cala knowledge graph query", "maritime-robotics", "2026-11-13")] },
  equityTotal: { value: { amount: 61_400_000, currency: "EUR" }, sources: [S.news("Cala knowledge graph query", "maritime-robotics-rounds", "2026-11-13")] },
  grantTotal: { value: { amount: 7_900_000, currency: "EUR" }, sources: [S.news("Cala knowledge graph query", "maritime-robotics-grants", "2026-11-13")] },
  medianSeed: { value: { amount: 2_100_000, currency: "EUR" }, sources: [S.news("Cala knowledge graph query", "maritime-robotics-seed", "2026-11-13")] },
  byYear: [
    { year: 2021, equity: 4.2, grants: 0.8, currency: "EUR", rounds: 5 },
    { year: 2022, equity: 7.9, grants: 1.1, currency: "EUR", rounds: 8 },
    { year: 2023, equity: 11.6, grants: 1.6, currency: "EUR", rounds: 11 },
    { year: 2024, equity: 17.3, grants: 2.2, currency: "EUR", rounds: 13 },
    { year: 2025, equity: 12.4, grants: 1.4, currency: "EUR", rounds: 9 },
    { year: 2026, equity: 8.0, grants: 0.8, currency: "EUR", rounds: 6 },
  ],
  topCompanyIds: ["tidewise", "portbotics", "ostra-sensing", "northlight-robotics", "brightwake-marine", "saltline-systems"],
  topInvestorIds: ["fjord-ventures", "northbound-capital", "harbour-seed"],
  companiesWithoutFunding: 17,
  otherCurrencyRounds: { count: 9, currencies: ["NOK", "SEK", "DKK"] },
};

export const deckChecks: Record<string, DeckCheckResult> = {
  "northlight-robotics": {
    fileName: "Northlight_Seed_Deck_Nov2026.pdf",
    companyId: "northlight-robotics",
    pages: 14,
    checkedAt: "2026-11-13",
    claims: [
      { id: "c1", slide: 1, claim: "Founded in Helsinki in 2023", category: "company", status: "confirmed", onRecord: "Founded May 2023, Helsinki", sources: [S.registryFI("northlight-robotics")] },
      { id: "c2", slide: 9, claim: "€850k raised to date", category: "funding", status: "differs", onRecord: "€500k equity (Pre-seed, Nov 2023) and €350k grant (Business Finland, Mar 2024). The deck counts the grant as raised capital.", sources: [S.press("Northlight Robotics raises pre-seed", "2023-11-21"), S.grant("Business Finland funding decisions", "bf-2024-0312", "2024-03-12")] },
      { id: "c3", slide: 9, claim: "Backed by Harbour Seed", category: "funding", status: "confirmed", onRecord: "Harbour Seed led the pre-seed round", sources: [S.press("Northlight Robotics raises pre-seed", "2023-11-21")] },
      { id: "c4", slide: 11, claim: "Team of 14", category: "team", status: "confirmed", onRecord: "11–50 employees", sources: [S.linkedin("Northlight Robotics")] },
      { id: "c5", slide: 6, claim: "3 paying shipping customers", category: "traction", status: "cant_verify", sources: [] },
      { id: "c6", slide: 4, claim: "Hull inspection market worth €4.2B by 2030", category: "market", status: "cant_verify", sources: [] },
      { id: "c7", slide: 7, claim: "The only autonomous hull inspection company in the Nordics", category: "market", status: "differs", onRecord: "Tidewise (Trondheim) and Saltline Systems (Turku) work on underwater or hull inspection.", sources: [S.site("Tidewise"), S.site("Saltline Systems")] },
    ],
  },
  tidewise: {
    fileName: "Tidewise_SeriesB_teaser.pdf",
    companyId: "tidewise",
    pages: 18,
    checkedAt: "2026-11-12",
    claims: [
      { id: "t1", slide: 2, claim: "Founded in 2021", category: "company", status: "confirmed", onRecord: "Founded 2021 (year only on record)", sources: [S.registryNO("tidewise")] },
      { id: "t2", slide: 12, claim: "Raised €8M Series A led by Fjord Ventures", category: "funding", status: "confirmed", onRecord: "€8.0M Series A, 18 Apr 2024, lead Fjord Ventures", sources: [S.news("Nordic Tech Weekly", "tidewise-series-a", "2024-04-18")] },
      { id: "t3", slide: 12, claim: "€10M total equity raised", category: "funding", status: "differs", onRecord: "NOK 12M Seed (2022) and €8.0M Series A (2024). The NOK round cannot be summed in EUR without a stated rate.", sources: [S.registryNO("tidewise/shares", "2022-12-01"), S.news("Nordic Tech Weekly", "tidewise-series-a", "2024-04-18")] },
      { id: "t4", slide: 5, claim: "Deployed at 120 fish farms", category: "traction", status: "cant_verify", sources: [] },
      { id: "t5", slide: 14, claim: "Team of 80", category: "team", status: "confirmed", onRecord: "51–200 employees", sources: [S.linkedin("Tidewise")] },
    ],
  },
};
