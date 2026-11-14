// Shared domain types. Every fact coming from Cala is wrapped in Sourced<T>.

/** Cala's source categories, most authoritative first. null = derived by Cala itself. */
export type SourceRank = "FILING" | "PRIMARY" | "PRESS" | "AGGREGATOR" | null;

/** Mirrors the source objects Cala returns on every property and relationship. */
export type Source = {
  name: string;
  document: string; // URL of the source document; "" when Cala derived the value
  date: string; // ISO date of the source
  date_precision?: "year" | "month" | "day" | null;
  source_rank: SourceRank;
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

/** Cala round instruments: EQUITY → equity, GRANT → grant, everything else (debt, loans, …) → other. */
export type RoundKind = "equity" | "grant" | "other";

export type FundingRound = {
  id: string;
  kind: RoundKind;
  stage: string; // "Pre-seed", "Seed", "Series A", "Grant"
  instrument?: string | null; // Cala's raw instrument, e.g. "EQUITY", "GRANT", "DEBT"
  date: FuzzyDate | null; // null = no dated source
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

/** A company in a market view, built only from sourced Cala properties. */
export type MarketCompany = {
  id: string;
  name: string;
  description: Sourced<string> | null;
  hq: Sourced<string> | null;
  founded: Sourced<FuzzyDate> | null;
  rounds: FundingRound[];
  /** aliases and website come from Cala and are used to merge records of the same investor. */
  investors: { id: string; name: string; sources: Source[]; aliases?: string[]; website?: string | null }[];
};

/** since: only companies that raised in this year or later (null = any time). */
export type MarketQuery = { sector: string; region: string; since?: number | null };

/** A company entity found by name in Cala. */
export type CompanyMatch = { id: string; name: string; entityType: string; description: string | null };

/** Everything the company analysis shows about one company, each value with its sources. */
export type CompanyProfile = MarketCompany & {
  legalName: Sourced<string> | null;
  website: Sourced<string> | null;
  employees: Sourced<string> | null;
  status: Sourced<string> | null;
  fundingStage: Sourced<string> | null;
  /** As Cala reports it (all instruments), not summed from rounds. */
  totalFunding: Sourced<Money> | null;
  totalFundingExDebt: Sourced<Money> | null;
  industries: { name: string; label: string | null; sources: Source[] }[];
  countries: string[];
};

/** Raw market data. Totals and charts are derived in lib/market.ts so mocks and Cala share one code path. */
export type MarketData = {
  query: MarketQuery;
  companies: MarketCompany[];
  /** The knowledge_query input we sent, shown so users can see how the market was defined. */
  definition: string;
  /** Candidates dropped because their location on record is outside the region. */
  outsideRegion: { name: string; country: string }[];
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
