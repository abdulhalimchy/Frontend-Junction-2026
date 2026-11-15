import type { Link, Node, RoundRef, Tie } from "@/lib/cala/intros";
import { formatDay } from "@/lib/format";

// Plain-language wording for warm-intro ties and links. Shared by Warm intros and a startup's Connect tab.

export function askReason(t: Tie) {
  if (t.kind === "backs_you") return t.lead ? "(your lead investor)" : "(your investor)";
  if (t.kind === "you_backed") return "(you invested in them)";
  return "(your co-investor)";
}

export function companyList(companies: { name: string }[]) {
  // The same company is often on record under several entries with one name.
  const unique = [...new Set(companies.map((c) => c.name))];
  const names = unique.slice(0, 3);
  return unique.length > 3 ? `${names.join(", ")} and ${unique.length - 3} more` : names.join(" and ").replace(/ and (?=.* and )/g, ", ");
}

export function roundName(r: RoundRef | null) {
  if (!r) return "";
  const when = r.date ? ` (${formatDay(r.date).replace(/^\d+ /, "")})` : "";
  return r.company ? `${r.company}'s ${r.stage}${when}` : `a ${r.stage} round${when}`;
}

/** Short edge label between you and the contact; the full sentence is the tooltip. */
export function tieLabel(t: Tie) {
  if (t.kind === "backs_you") return `${t.lead ? "led" : "invested in"} your ${t.round ? t.round.stage : "company"}`;
  if (t.kind === "you_backed") return "you invested";
  return `co-invested${t.round ? ` in a ${t.round.stage}` : ""}`;
}

export function tieSentence(t: Tie, from: Node, other: Node) {
  const round = t.round ? ` in ${t.kind === "backs_you" ? "your" : "the same"} ${t.round.stage}` : "";
  if (t.kind === "backs_you") return `${other.name} ${t.lead ? "led" : "invested"}${round || ` in ${from.name}`}`;
  if (t.kind === "you_backed") return `${from.name} invested in ${other.name}`;
  return `co-invested${round ? ` ${round.trim()} round` : ""}`;
}

export function linkSentence(l: Link, via: Node, to: Node) {
  switch (l.kind) {
    case "invested_in_target":
      return l.round ? `invested in ${roundName(l.round)}` : `invested in ${to.name}`;
    case "target_invested":
      return l.round ? `${to.name} invested in ${roundName(l.round)}` : `${to.name} invested in ${via.name}`;
    case "same_round":
      return `both in ${roundName(l.round)}`;
    case "shared_portfolio":
      return `both backed ${l.companies.length === 1 ? l.companies[0].name : `${l.companies.length} companies`}`;
  }
}
