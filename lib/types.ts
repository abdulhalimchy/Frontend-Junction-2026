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

export type AlertKind =
  | "competitor_round"
  | "funding_round"
  | "portfolio_competitor"
  | "investor_activity"
  | "slush_attendee"
  | "team_change"
  | "profile";

export type Alert = {
  id: string;
  kind: AlertKind;
  title: string;
  body: string;
  /** Why this user sees it, e.g. "One of your competitors". */
  reason?: string;
  date: string;
  read: boolean;
  href: string;
  /** Mock fixtures only: which demo persona sees it. */
  roles?: Role[];
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

export type DeckCheckStatus = "pending" | "processing" | "completed" | "failed";

export type DeckCheckResult = {
  id: string;
  status: DeckCheckStatus;
  error: string | null; // set when status is "failed"
  fileName: string;
  companyName: string;
  pages: number | null;
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
  /** Acquisitions and similar corporate deals the company took part in. */
  deals: { id: string; kind: string; role: string | null; date: string | null; sources: Source[] }[];
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

/** Profile fields of a startup the founder added. Each can carry sources from the background lookup. */
export type StartupField = "name" | "description" | "founded" | "headquarters" | "employees" | "stage" | "industry";

export type StartupSuggestion = { value: string; origin: "cala" | "website" | "domain"; sources: Source[] };

/** A startup the founder added (by domain, auto-filled, or by hand). Stored in the backend. */
export type Startup = {
  id: string;
  name: string;
  domain: string;
  description: string;
  founded: string; // "2023", "2023-05" or "2023-05-12"; "" when unknown
  headquarters: string;
  employees: string;
  stage: string;
  industry: string;
  calaCompanyId: string;
  /** Sources survive only for values saved exactly as suggested. */
  sources: Partial<Record<StartupField, Source[]>>;
  isDraft: boolean;
  enrichment: { status: "none" | "pending" | "processing" | "completed" | "failed"; error: string; note: string };
  suggestions: Partial<Record<StartupField, StartupSuggestion>>;
};

/** One row in the sidebar's startup list. The demo persona's company is listed with demo: true. */
export type StartupSummary = { id: string; name: string; domain: string; demo?: boolean };

// ---- On-demand analyses for an added startup (Competitors and Find investors tabs) ----

/** A company in the competitors analysis. `self_reported`: the startup's own row, from what the founder entered. */
export type StandingRow = {
  id: string;
  name: string;
  you?: boolean;
  self_reported: boolean;
  description: Sourced<string> | null;
  headquarters: Sourced<string> | null;
  website: Sourced<string> | null;
  founded: Sourced<string> | null; // "2014", "2014-10" or "2014-10-07"
  employees: Sourced<string> | null;
  stage: Sourced<string> | null;
  /** Equity rounds summed in one currency, else the total Cala reports. `basis` says which. */
  raised: (Sourced<Money> & { basis: string }) | null;
  last_round: { stage: string; kind: RoundKind; date: string | null; amount: Money | null; leads: { id: string; name: string }[]; sources: Source[] } | null;
  rounds: number;
  investors: { id: string; name: string }[];
};

/** mode "competitors": Cala's competitors of the matched company. "peers": companies matching the industry. */
export type CompetitorsAnalysis = {
  mode: "competitors" | "peers" | "none";
  query: string;
  unresolved: number;
  you: StandingRow;
  companies: StandingRow[];
  currency: string | null;
  median_raised: Money | null;
  rank: number | null;
  compared: number;
};

export type MatchPart = { label: string; points: number; max: number; detail: string };

export type InvestorMatch = {
  id: string;
  name: string;
  entity_type: string;
  description: Sourced<string> | null;
  website: Sourced<string> | null;
  headquarters: Sourced<string> | null;
  country: string | null;
  existing: boolean;
  backs: string[];
  /** "competitor": backs a direct competitor. "space": backs a company in the same space (not matched in Cala). */
  conflict: "competitor" | "space" | null;
  rounds_total: number;
  rounds_led: number;
  stages: { stage: string; count: number }[];
  /** basis "round": a round date. "reported": the date a source reported a new investment. */
  last_deal: { date: string; basis: "round" | "reported" } | null;
  portfolio_size: number;
  sources: Source[];
  match: { score: number; parts: MatchPart[] };
  why: string;
};

export type InvestorsAnalysis = {
  mode: "competitors" | "peers" | "none";
  query: string;
  unresolved: number;
  peers: { id: string; name: string }[];
  your_stage: string | null;
  your_country: string | null;
  existing: InvestorMatch[];
  investors: InvestorMatch[];
  candidates_total: number;
};

export type AnalysisKind = "competitors" | "investors";

/** A stored analysis. status "none": never run. While "loading" (a refresh), `data` still holds the last result. */
export type Analysis<T> = {
  kind: AnalysisKind;
  status: "none" | "loading" | "ready" | "failed";
  data: T | Record<string, never>;
  error: string;
  finished_at: string | null;
};
