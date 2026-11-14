import "server-only";
import type { Source } from "@/lib/types";
import { assertCalaKey, knowledgeSearch, type KnowBit } from "./client";
import { cite } from "./citations";

// Gaps in a company's Cala record, filled from Cala's knowledge search (web sources). One search per
// company covers every missing fact plus customers and business model, cached for 24 hours; it takes
// 30–60 seconds, so pages stream it in after the rest. Each answer keeps only the sources it was
// attributed to, and the UI labels these facts as coming from the web, not from Cala's records.

export type WebGap = "employees" | "totalFunding" | "lead" | "stage";
export type WebFactKey = WebGap | "customers" | "model";
export type WebFact = { key: WebFactKey; label: string; value: string; sources: Source[] };

const LABELS: Record<WebFactKey, string> = {
  employees: "Employees",
  totalFunding: "Total funding",
  lead: "Lead investor",
  stage: "Funding stage",
  customers: "Key customers",
  model: "Business model",
};

export type WebGapRequest = {
  name: string;
  place?: string | null;
  gaps: WebGap[];
  /** The round whose lead is missing, e.g. "Series G of Jun 2016". */
  leadRound?: string;
};

export async function fetchWebFacts(req: WebGapRequest): Promise<{ facts: WebFact[]; unanswered: WebGap[] }> {
  assertCalaKey();
  const items: [WebFactKey, string][] = [];
  if (req.gaps.includes("employees")) items.push(["employees", "latest total number of employees, with the date it applies to"]);
  if (req.gaps.includes("totalFunding")) items.push(["totalFunding", "total capital raised from investors to date, with currency (before any IPO for public companies)"]);
  if (req.gaps.includes("lead") && req.leadRound) items.push(["lead", `who led the ${req.leadRound} round`]);
  if (req.gaps.includes("stage")) items.push(["stage", "current funding stage (e.g. Seed, Series B, public)"]);
  items.push(["customers", "up to five named customers, or the main customer types if none are named"]);
  items.push(["model", "one sentence on how it makes money"]);

  const subject = req.place ? `${req.name} (${req.place})` : req.name;
  const question =
    `About the company ${subject}. Answer each item on its own line, exactly in the form "Label: value", ` +
    `Keep each value under 25 words, state only what a source says (no estimates or projections), ` +
    `and write "unknown" when no source says. ` +
    items.map(([k, what]) => `${LABELS[k]}: ${what}.`).join(" ");

  const res = await knowledgeSearch(question);
  // Cala's own entity summary is not a web source; its origins are unrelated pages.
  const bits = (res.context ?? []).filter((b) => !/^Entity:/.test(b.content));
  const answers = parseLines(res.content);

  const facts: WebFact[] = [];
  for (const [key] of items) {
    const value = answers.get(LABELS[key].toLowerCase());
    if (!value || /^(unknown|not (available|disclosed|found)|n\/a)\b/i.test(value)) continue;
    const sources = citedSources(value, bits, req.name);
    // An answer no fact supports is the model's guess: leave the gap open.
    if (!sources.length) continue;
    facts.push({ key, label: LABELS[key], value, sources });
  }
  const answered = new Set(facts.map((f) => f.key));
  return { facts, unanswered: req.gaps.filter((g) => !answered.has(g)) };
}

/** "**Employees:** 36,600 as of June 30, 2026." → Map("employees" → "36,600 as of June 30, 2026."). */
function parseLines(content: string) {
  const out = new Map<string, string>();
  for (const line of content.split("\n")) {
    const m = /^\s*(?:[-*+]\s+)?\**([A-Za-z][A-Za-z ]{2,30}?)\**\s*:\s*\**\s*(.+?)\s*$/.exec(line);
    if (!m) continue;
    const label = m[1].trim().toLowerCase();
    if (!out.has(label)) out.set(label, m[2].replace(/\*\*/g, "").trim());
  }
  return out;
}

function citedSources(text: string, bits: KnowBit[], subject: string): Source[] {
  const { answer, sources } = cite(text, bits, subject);
  const cited = [...new Set([...answer.matchAll(/#cite-(\d+)/g)].map((m) => Number(m[1])))];
  return cited
    .map((n) => sources[n - 1])
    .filter(Boolean)
    .map((s) => ({ name: s.name, document: s.url, date: "", date_precision: null, source_rank: null }));
}
