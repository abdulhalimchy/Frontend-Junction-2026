import type { Source } from "@/lib/types";

// Name matching shared by server data code and pure aggregation.

const LEGAL_SUFFIXES = new Set([
  "as", "asa", "ab", "oy", "oyj", "aps", "a/s", "ltd", "limited", "inc", "incorporated", "corp", "corporation", "co",
  "llc", "llp", "lp", "lllp", "plc", "gmbh", "ag", "se", "sa", "sas", "bv", "nv", "spa", "srl", "kk", "pte", "pty",
]);

/**
 * "GE HealthCare Inc." → "ge healthcare", "INDEX VENTURES (UK) LLP" → "index ventures",
 * "COATUE MANAGEMENT, L.L.C." → "coatue management".
 */
export function normaliseName(name: string) {
  const words = name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[.'’]/g, "")
    .replace(/[,&]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  while (words.length > 1 && LEGAL_SUFFIXES.has(words[words.length - 1])) words.pop();
  return words.join(" ");
}

export type InvestorRef = { id: string; name: string; sources: Source[]; aliases?: string[]; website?: string | null };

export type InvestorGroup = {
  id: string;
  name: string;
  /** Other names this investor is recorded under in Cala. */
  alsoKnownAs: string[];
  sources: Source[];
  members: InvestorRef[];
};

/**
 * Groups investor records that are the same firm: equal normalised name, a Cala alias that matches
 * another record's name, the same website, or names one letter apart (only for names of 10+ characters,
 * to catch typos like "Andreesen Horowitz" without merging short, different names).
 */
export function groupInvestors(list: InvestorRef[]): InvestorGroup[] {
  const parent = list.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };

  // Exact keys: names, aliases, websites.
  const owner = new Map<string, number>();
  list.forEach((inv, i) => {
    const keys = [inv.name, ...(inv.aliases ?? [])]
      .map(normaliseName)
      .filter((k) => k.length >= 3)
      .map((k) => `n:${k}`);
    const site = domain(inv.website);
    if (site) keys.push(`w:${site}`);
    for (const k of keys) {
      const j = owner.get(k);
      if (j === undefined) owner.set(k, i);
      else union(i, j);
    }
  });

  // Near-identical names (typos).
  const norm = list.map((inv) => normaliseName(inv.name));
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (find(i) === find(j) || norm[i].length < 10 || norm[j].length < 10) continue;
      if (Math.abs(norm[i].length - norm[j].length) <= 1 && editDistance(norm[i], norm[j]) <= 1) union(i, j);
    }
  }

  const groups = new Map<number, InvestorRef[]>();
  list.forEach((inv, i) => {
    const r = find(i);
    groups.set(r, [...(groups.get(r) ?? []), inv]);
  });

  return [...groups.values()].map((members) => {
    const name = displayName(members);
    const seen = new Set([name.toLowerCase()]);
    const alsoKnownAs = members
      .map((m) => m.name)
      .filter((n) => !seen.has(n.toLowerCase()) && seen.add(n.toLowerCase()));
    const sources = members
      .flatMap((m) => m.sources)
      .filter((s, i, arr) => arr.findIndex((x) => x.name === s.name && x.document === s.document) === i);
    return { id: members[0].id, name, alsoKnownAs, sources, members };
  });
}

/**
 * Picks the name to show: avoid fund vehicles ("Greylock XIV Limited Partnership") and ALL CAPS registry
 * names, then prefer the record whose Cala aliases cover the others (the main entity, e.g. "Andreessen
 * Horowitz" lists "a16z"), then the shortest name ("Index Ventures" over "Index Ventures Limited"),
 * then the most-sourced record.
 */
function displayName(members: InvestorRef[]) {
  const names = new Set(members.map((m) => normaliseName(m.name)));
  const vehicle = (n: string) => Number(/\b([IVX]{2,}|\d+)\b|\b(fund|partnership|portfolio)\b/i.test(n));
  const caps = (n: string) => Number(n === n.toUpperCase());
  const covers = (m: InvestorRef) => (m.aliases ?? []).map(normaliseName).filter((a) => a !== normaliseName(m.name) && names.has(a)).length;
  return [...members].sort(
    (a, b) =>
      vehicle(a.name) - vehicle(b.name) ||
      caps(a.name) - caps(b.name) ||
      covers(b) - covers(a) ||
      normaliseName(a.name).length - normaliseName(b.name).length ||
      a.name.length - b.name.length ||
      b.sources.length - a.sources.length,
  )[0].name;
}

function domain(url?: string | null) {
  if (!url) return null;
  return url.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || null;
}

function editDistance(a: string, b: string) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}
