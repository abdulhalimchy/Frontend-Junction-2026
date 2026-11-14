import type { KnowBit } from "./client";

// Cala's knowledge search returns a markdown answer and the facts (KnowBits) it rests on, but does not say
// which sentence uses which fact. This attributes each sentence or list item to the facts that share the most
// of its distinctive words (names, numbers, longer words), and inserts numbered markers as markdown links
// "[n](#cite-n)" that the UI renders as citation chips. A sentence with no clear match gets no marker.

export type CitedSource = { name: string; url: string };

const STOP = new Set(
  ("about above after again also among and another any are around because been before being between both but " +
    "can could did does doing during each either even every for from further had has have having her here him his " +
    "how including into its itself just more most much must not now only other our over own same several she " +
    "should since some such than that the their them then there these they this those through under until upon " +
    "very was were what when where which while who whom whose why will with within without would year years " +
    "company companies").split(" "),
);

const MIN_COVERAGE = 0.34; // share of a sentence's distinctive words a fact must contain
const MAX_FACTS = 2; // facts cited per sentence
const MAX_MARKERS = 3; // source numbers shown per sentence

type Token = { word: string; weight: number };

function tokens(text: string, ignore: Set<string> = new Set()): Token[] {
  const clean = text.replace(/[’‘]/g, "'").replace(/(\d),(\d)/g, "$1$2");
  const out = new Map<string, number>();
  for (const m of clean.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'&-]*/gu)) {
    const raw = m[0].replace(/'s$/i, "");
    const word = raw.toLowerCase();
    const numeric = /\d/.test(raw);
    const proper = /^\p{Lu}/u.test(raw);
    if (STOP.has(word) || ignore.has(word) || (!numeric && !proper && word.length < 5) || (!numeric && word.length < 2)) continue;
    const weight = numeric ? 2 : proper ? 1.5 : 1;
    out.set(word, Math.max(out.get(word) ?? 0, weight));
  }
  return [...out].map(([word, weight]) => ({ word, weight }));
}

function wordSet(text: string, ignore: Set<string>) {
  return new Set(tokens(text, ignore).map((t) => t.word));
}

/** Facts that best support `unit`, strongest first. */
function supporting(unit: string, facts: Set<string>[], ignore: Set<string>): number[] {
  const words = tokens(unit, ignore);
  if (!words.length) return [];
  const total = words.reduce((s, t) => s + t.weight, 0);
  const scored = facts
    .map((f, i) => {
      const hit = words.filter((t) => f.has(t.word));
      return { i, score: hit.reduce((s, t) => s + t.weight, 0), count: hit.length };
    })
    // A single-word item ("**Nike**") may match on that word alone; longer units need two shared words.
    .filter((x) => x.score / total >= MIN_COVERAGE && (x.count >= 2 || words.length === 1))
    .sort((a, b) => b.score - a.score || a.i - b.i);
  if (!scored.length) return [];
  // Keep facts nearly as strong as the best one, so a weak partial match is not cited next to a full one.
  return scored.filter((x) => x.score >= scored[0].score * 0.75).slice(0, MAX_FACTS).map((x) => x.i);
}

/** Splits a paragraph into sentences without breaking on "St., 8th" or decimals. */
function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+(?=["“(]?\p{Lu})/u);
}

/** Inserts the marker before trailing punctuation: "in 2026 [1]." */
function withMarker(unit: string, marker: string) {
  const m = unit.match(/^([\s\S]*?)([.!?;:,]*)(\s*)$/)!;
  return `${m[1]}${marker}${m[2]}${m[3]}`;
}

/** `subject` (the company name) is ignored when matching: nearly every fact mentions it. */
export function cite(answer: string, bits: KnowBit[], subject = ""): { answer: string; sources: CitedSource[] } {
  const ignore = new Set(tokens(subject).map((t) => t.word));
  const facts = bits.map((b) => wordSet(b.content, ignore));
  const factUrls = bits.map((b) => [...new Set(b.origins.map((o) => o.document.url || o.source.url).filter(Boolean))]);
  const byUrl = new Map<string, CitedSource>();
  for (const b of bits) {
    for (const o of b.origins) {
      const url = o.document.url || o.source.url;
      if (url && !byUrl.has(url)) byUrl.set(url, { name: o.document.name || o.source.name || url, url });
    }
  }

  // Sources are numbered in the order they are first cited; uncited ones follow.
  const order: string[] = [];
  const number = (url: string) => {
    let n = order.indexOf(url);
    if (n < 0) n = order.push(url) - 1;
    return n + 1;
  };
  const markerFor = (unit: string) => {
    const nums = [...new Set(supporting(unit, facts, ignore).flatMap((i) => factUrls[i].map(number)))].slice(0, MAX_MARKERS).sort((a, b) => a - b);
    return nums.map((n) => ` [${n}](#cite-${n})`).join("");
  };

  let inFence = false;
  const lines = answer.split("\n").map((line) => {
    if (/^\s*```/.test(line)) inFence = !inFence;
    if (inFence || !line.trim() || /^\s*(#|\||```|---|\*\*\*)/.test(line)) return line;
    const item = line.match(/^(\s*(?:[-*+]|\d+[.)])\s+)(.*)$/);
    const prefix = item ? item[1] : "";
    const body = item ? item[2] : line;
    return prefix + sentences(body).map((s) => withMarker(s, markerFor(s))).join(" ");
  });

  for (const url of byUrl.keys()) number(url);
  return { answer: lines.join("\n"), sources: order.map((u) => byUrl.get(u)!).filter(Boolean) };
}
