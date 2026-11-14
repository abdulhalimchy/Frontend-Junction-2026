import type { Investor, InvestorCheck, Person } from "@/lib/types";
import { S } from "./sources";

export const investors: Investor[] = [
  {
    id: "fjord-ventures",
    name: "Fjord Ventures",
    kind: "VC",
    hq: { value: "Oslo, Norway", sources: [S.registryNO("fjord-ventures")] },
    description: {
      value: "Seed and Series A fund backing Nordic deep tech, with a focus on ocean and industrial robotics.",
      sources: [S.site("Fjord Ventures")],
    },
    focus: { value: ["Ocean tech", "Robotics", "Industrial software"], sources: [S.site("Fjord Ventures", "thesis")] },
    checkSize: {
      value: { min: { amount: 500_000, currency: "EUR" }, max: { amount: 4_000_000, currency: "EUR" } },
      sources: [S.site("Fjord Ventures", "faq")],
    },
    portfolioIds: ["portbotics", "tidewise", "ostra-sensing", "brightwake-marine", "kelpie-health"],
    peopleIds: ["jonas-berg"],
    attendsSlush: true,
  },
  {
    id: "northbound-capital",
    name: "Northbound Capital",
    kind: "VC",
    hq: { value: "Stockholm, Sweden", sources: [S.registrySE("northbound-capital")] },
    description: {
      value: "Multi-stage fund that mostly co-invests alongside lead investors in Nordic health and climate companies.",
      sources: [S.site("Northbound Capital")],
    },
    focus: { value: ["Health tech", "Climate", "Marine"], sources: [S.site("Northbound Capital", "focus")] },
    checkSize: {
      value: { min: { amount: 5_000_000, currency: "SEK" }, max: { amount: 40_000_000, currency: "SEK" } },
      sources: [S.site("Northbound Capital", "faq")],
    },
    portfolioIds: ["kelpie-health", "tidewise", "ostra-sensing"],
    peopleIds: ["elin-strand"],
    attendsSlush: true,
  },
  {
    id: "harbour-seed",
    name: "Harbour Seed",
    kind: "Angel network",
    hq: { value: "Helsinki, Finland", sources: [S.registryFI("harbour-seed")] },
    description: {
      value: "Angel syndicate of former shipping and port executives writing first cheques into maritime startups.",
      sources: [S.site("Harbour Seed")],
    },
    focus: { value: ["Maritime", "Logistics"], sources: [S.site("Harbour Seed")] },
    checkSize: null,
    portfolioIds: ["northlight-robotics", "portbotics"],
    peopleIds: ["pekka-harju"],
    attendsSlush: true,
  },
];

export const investorChecks: Record<string, InvestorCheck> = {
  "fjord-ventures": {
    stillActive: {
      value: { active: true, lastInvestment: { date: "2026-10-30", precision: "day" }, dealsLast12m: 3 },
      sources: [S.press("PortBotics extends seed", "2026-10-30")],
    },
    leadsOrFollows: { value: { leads: 5, follows: 1 }, sources: [S.news("Nordic Tech Weekly", "fjord-ventures-deals", "2026-08-01")] },
    backsCompetitor: {
      value: { competitorIds: ["portbotics", "tidewise"] },
      sources: [S.press("PortBotics seed round", "2023-02-14"), S.news("Nordic Tech Weekly", "tidewise-series-a", "2024-04-18")],
    },
  },
  "northbound-capital": {
    stillActive: {
      value: { active: false, lastInvestment: { date: "2024-09", precision: "month" }, dealsLast12m: 0 },
      sources: [S.news("Shifter", "kelpie-health-seed", "2024-09-10")],
    },
    leadsOrFollows: { value: { leads: 1, follows: 3 }, sources: [S.news("Nordic Tech Weekly", "northbound-deals", "2026-07-15")] },
    backsCompetitor: {
      value: { competitorIds: ["tidewise"] },
      sources: [S.news("Nordic Tech Weekly", "tidewise-series-a", "2024-04-18")],
    },
  },
  "harbour-seed": {
    stillActive: {
      value: { active: true, lastInvestment: { date: "2025-08", precision: "month" }, dealsLast12m: 2 },
      sources: [S.site("Harbour Seed", "portfolio")],
    },
    leadsOrFollows: { value: { leads: 2, follows: 2 }, sources: [S.site("Harbour Seed", "portfolio")] },
    backsCompetitor: {
      value: { competitorIds: ["portbotics"] },
      sources: [S.press("PortBotics seed round", "2023-02-14")],
    },
  },
};

export const people: Person[] = [
  { id: "anna-virtanen", name: "Anna Virtanen", title: "CEO & Co-founder", companyId: "northlight-robotics", trust: "verified", sources: [S.registryFI("northlight-robotics/board"), S.linkedin("Anna Virtanen")] },
  { id: "mikko-laine", name: "Mikko Laine", title: "CTO & Co-founder", companyId: "northlight-robotics", trust: "verified_at_company", sources: [S.site("Northlight Robotics", "team")] },
  { id: "jonas-berg", name: "Jonas Berg", title: "Partner", investorId: "fjord-ventures", trust: "verified", sources: [S.site("Fjord Ventures", "team"), S.linkedin("Jonas Berg")] },
  { id: "elin-strand", name: "Elin Strand", title: "Partner", investorId: "northbound-capital", trust: "verified_at_company", sources: [S.site("Northbound Capital", "team")] },
  { id: "pekka-harju", name: "Pekka Harju", title: "Managing Partner", investorId: "harbour-seed", trust: "self_described", sources: [S.linkedin("Pekka Harju")] },
  { id: "ingrid-solberg", name: "Ingrid Solberg", title: "CEO", companyId: "tidewise", trust: "verified", sources: [S.registryNO("tidewise/board")] },
  { id: "sofie-dekker", name: "Sofie Dekker", title: "CEO & Founder", companyId: "portbotics", trust: "verified", sources: [S.registryNL("portbotics/board")] },
  { id: "maren-aas", name: "Maren Aas", title: "CEO", companyId: "kelpie-health", trust: "verified_at_company", sources: [S.site("Kelpie Health", "team")] },
];
