import type { EventInfo, Profile, Role } from "@/lib/types";
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
    privacy: { showInEventDirectory: true },
  },
  investor: {
    name: "Jonas Berg",
    email: "jonas@fjord.example",
    role: "investor",
    personId: "jonas-berg",
    investorId: "fjord-ventures",
    goals: ["Source seed deals", "Monitor portfolio competitors", "Meet founders at Slush"],
    privacy: { showInEventDirectory: true },
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
