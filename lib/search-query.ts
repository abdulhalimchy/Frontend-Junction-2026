// Reads a search box query as either a name lookup ("Wolt") or a description of what companies do
// ("seed robotics investors in the Nordics"). Descriptions are split into the parts the Market pipeline
// understands (sector, region, since) plus filters applied to the results (stage, investors wanted).
// Pure string work: no Cala calls, so it is safe to run on every keystroke or request.

export const STAGES = [
  { key: "pre-seed", label: "Pre-seed", test: /^pre[- ]?seed$/i },
  { key: "seed", label: "Seed", test: /^seed$/i },
  { key: "series-a", label: "Series A", test: /^series a$/i },
  { key: "series-b", label: "Series B+", test: /^series [b-z]$/i },
] as const;
export type StageKey = (typeof STAGES)[number]["key"];

export type ParsedQuery = {
  /** What the companies do, with region, stage and time words removed. */
  sector: string;
  region: string | null;
  since: number | null;
  stage: StageKey | null;
  /** The query asked for investors ("… investors", "VCs", "funds"). */
  wantsInvestors: boolean;
  /** True when the query reads as a description rather than a name. */
  descriptive: boolean;
};

// Longest phrases first so "united states" wins over "us".
const REGION_WORDS: [RegExp, string][] = [
  [/\b(?:nordics?|nordic countries|scandinavian?)\b/i, "nordics"],
  [/\b(?:finland|finnish|helsinki|espoo|tampere|oulu)\b/i, "finland"],
  [/\b(?:sweden|swedish|stockholm|gothenburg|malmö|malmo)\b/i, "sweden"],
  [/\b(?:norway|norwegian|oslo|bergen|trondheim)\b/i, "norway"],
  [/\b(?:denmark|danish|copenhagen|aarhus)\b/i, "denmark"],
  [/\b(?:baltics?|estonia|estonian|latvia|lithuania|tallinn|riga|vilnius)\b/i, "baltics"],
  [/\b(?:dach|germany|german|austria|switzerland|swiss|berlin|munich|zurich|vienna)\b/i, "dach"],
  [/\b(?:benelux|netherlands|dutch|belgium|amsterdam)\b/i, "benelux"],
  [/\b(?:uk|united kingdom|british|britain|ireland|irish|london|dublin)\b/i, "uki"],
  [/\b(?:united states|usa|american|silicon valley|new york|san francisco)\b/i, "us"],
  [/\b(?:europe|european|eu)\b/i, "europe"],
  [/\b(?:anywhere|global|globally|worldwide)\b/i, "anywhere"],
];

const STAGE_WORDS: [RegExp, StageKey][] = [
  [/\bpre[- ]?seed\b/i, "pre-seed"],
  [/\bseed(?:[- ]stage)?\b/i, "seed"],
  [/\bseries[- ]a\b/i, "series-a"],
  [/\b(?:series[- ][b-e]|growth[- ]stage|late[- ]stage)\b/i, "series-b"],
];

const INVESTOR_WORDS = /\b(?:investors?|vcs?|venture capital(?:ists?)?|funds?|backers?|angels?)\b/i;
// Words that only make sense in a description. Any of them means "search by what they do".
const DESCRIPTIVE_HINTS = /\b(?:startups?|companies|company|firms?|scale[- ]?ups?|that|which|who|building|making|doing|for|working on)\b/i;
const FILLER =
  /\b(?:startups?|companies|company|firms?|scale[- ]?ups?|based|located|headquartered|in|from|the|of|and|that|which|who|are|is|have|has|raised|raising|funded|funding|round|rounds|building|making|doing|working on|with|backing|backed|investing|invest|a|an|any|all|top|best|recent|recently|since|after|last|this|year|years|stage|for)\b/gi;

export function parseSearchQuery(raw: string, now = new Date()): ParsedQuery {
  let text = ` ${raw.trim().replace(/\s+/g, " ")} `;
  const take = (re: RegExp) => {
    const m = text.match(re);
    if (m) text = text.replace(re, " ");
    return m;
  };

  let region: string | null = null;
  for (const [re, key] of REGION_WORDS) {
    if (take(re) && !region) region = key;
  }

  let stage: StageKey | null = null;
  for (const [re, key] of STAGE_WORDS) {
    if (take(re) && !stage) stage = key;
  }

  const year = now.getFullYear();
  let since: number | null = null;
  const yearMatch = take(/\b(?:since|after|in|from)?\s*(20[12]\d)\b/i);
  if (yearMatch) since = Number(yearMatch[1]);
  else if (take(/\bthis year\b/i)) since = year;
  else if (take(/\b(?:last (?:12 months|year)|past year|recently|recent)\b/i)) since = year - 1;

  const wantsInvestors = !!take(INVESTOR_WORDS);
  const hinted = DESCRIPTIVE_HINTS.test(text);
  const sector = text.replace(FILLER, " ").replace(/[^\p{L}\p{N}&+\- ]/gu, " ").replace(/\s+/g, " ").trim();
  const words = raw.trim().split(/\s+/).filter(Boolean).length;

  return {
    sector,
    region,
    since,
    stage,
    wantsInvestors,
    descriptive: !!sector && (!!region || !!stage || !!since || wantsInvestors || hinted || words >= 4),
  };
}

export function stageOf(key: string | null | undefined) {
  return STAGES.find((s) => s.key === key) ?? null;
}
