// Shared domain types. Every fact coming from Cala is wrapped in Sourced<T>.

export type Source = {
  name: string;
  document: string; // URL of the source document
  date: string; // ISO date the source was published or retrieved
  source_rank: number; // lower is more authoritative
};

export type Sourced<T> = {
  value: T;
  sources: Source[];
};

export type Role = "founder" | "investor";

/** Money always carries its currency. Never assume EUR or USD. */
export type Money = {
  amount: number;
  currency: string; // ISO 4217, e.g. "EUR"
};

/** Dates from Cala can be year-, month- or day-precise. */
export type FuzzyDate = {
  date: string; // "2024", "2024-03" or "2024-03-12"
  precision: "year" | "month" | "day";
};

export type RoundKind = "equity" | "grant";

export type FundingRound = {
  id: string;
  kind: RoundKind;
  stage: string; // "Pre-seed", "Seed", "Series A", "Grant"
  date: FuzzyDate;
  amount: Money | null; // null = undisclosed
  leadInvestorIds: string[];
  participantIds: string[];
  grantor?: string; // for grants
  sources: Source[];
};

export type Person = {
  id: string;
  name: string;
  title: string;
  companyId?: string;
  investorId?: string;
  trust: TrustLevel;
  sources: Source[];
};

export type TrustLevel = "verified" | "verified_at_company" | "self_described";

export type Company = {
  id: string;
  name: string;
  domain: string;
  description: Sourced<string>;
  founded: Sourced<FuzzyDate>;
  hq: Sourced<string>;
  employees: Sourced<string> | null; // range, e.g. "11–50"
  industryCode: Sourced<string>; // coarse, sometimes wrong: rough filter only
  sector: string; // our description-based grouping
  stage: string;
  rounds: FundingRound[];
  peopleIds: string[];
  attendsSlush: boolean;
  slushJoined?: string; // ISO date the attendance relation appeared
};

export type Investor = {
  id: string;
  name: string;
  kind: "VC" | "Angel network" | "Corporate VC" | "Public agency";
  hq: Sourced<string>;
  description: Sourced<string>;
  focus: Sourced<string[]>;
  checkSize: Sourced<{ min: Money; max: Money }> | null;
  portfolioIds: string[];
  peopleIds: string[];
  attendsSlush: boolean;
};

export type InvestorCheck = {
  stillActive: Sourced<{ active: boolean; lastInvestment: FuzzyDate | null; dealsLast12m: number }>;
  leadsOrFollows: Sourced<{ leads: number; follows: number }>;
  backsCompetitor: Sourced<{ competitorIds: string[] }>;
};

export type AlertKind = "competitor_round" | "portfolio_competitor" | "investor_activity" | "slush_attendee" | "profile";

export type Alert = {
  id: string;
  kind: AlertKind;
  title: string;
  body: string;
  date: string;
  read: boolean;
  href: string;
  roles: Role[];
  slush?: boolean;
  sources: Source[];
};

export type MetEntry = {
  id: string;
  personId: string;
  metAt: string; // ISO date
  where: string;
  note: string;
  slush: boolean;
};

export type ClaimStatus = "confirmed" | "differs" | "cant_verify";

export type DeckClaim = {
  id: string;
  slide: number;
  claim: string;
  category: "funding" | "team" | "traction" | "market" | "company";
  status: ClaimStatus;
  onRecord?: string; // what Cala holds, when it differs or confirms
  sources: Source[];
};

export type DeckCheckResult = {
  fileName: string;
  companyId: string;
  pages: number;
  checkedAt: string;
  claims: DeckClaim[];
};

export type MarketSnapshot = {
  sector: string;
  region: string;
  companyCount: Sourced<number>;
  equityTotal: Sourced<Money>;
  grantTotal: Sourced<Money>;
  medianSeed: Sourced<Money>;
  byYear: { year: number; equity: number; grants: number; currency: string; rounds: number }[];
  topCompanyIds: string[];
  topInvestorIds: string[];
  companiesWithoutFunding: number;
  /** Totals and chart only sum rounds in the snapshot currency; the rest are counted here, not converted. */
  otherCurrencyRounds: { count: number; currencies: string[] };
};

export type EventInfo = {
  id: string;
  name: string;
  city: Sourced<string>;
  dates: Sourced<{ start: string; end: string }>;
  attendeeCompanies: Sourced<number>;
  attendeeInvestors: Sourced<number>;
  newThisWeek: number;
};

export type Profile = {
  name: string;
  email: string;
  role: Role;
  personId: string;
  companyId?: string;
  investorId?: string;
  goals: string[];
  privacy: {
    showInEventDirectory: boolean;
    showCardInSearch: boolean;
    shareMetList: boolean;
    allowAlertsEmail: boolean;
  };
};
