import "server-only";
import type { CardData } from "@/components/warmline/profile-card";
import { getCompany, getInvestor, getPerson } from "@/lib/cala";
import { formatFuzzyDate, formatTotals, totalsByCurrency } from "@/lib/format";
import type { Profile } from "@/lib/types";

/** Builds the verified profile card from Cala facts. Only sourced facts make it onto the card. */
export async function buildCard(profile: Profile): Promise<CardData> {
  const person = (await getPerson(profile.personId))!;
  if (profile.companyId) {
    const c = (await getCompany(profile.companyId))!;
    const equity = c.rounds.filter((r) => r.kind === "equity");
    return {
      personId: person.id,
      name: person.name,
      title: person.title,
      org: c.name,
      trust: person.trust,
      oneLiner: c.description.value,
      oneLinerSources: c.description.sources,
      facts: [
        { label: "Founded", value: formatFuzzyDate(c.founded.value), sources: c.founded.sources },
        { label: "Equity raised", value: formatTotals(totalsByCurrency(c.rounds, "equity")), sources: equity.flatMap((r) => r.sources) },
        { label: "Team", value: c.employees?.value ?? "Not on record", sources: c.employees?.sources ?? [] },
      ],
      slush: c.attendsSlush,
    };
  }
  const { investor: i, check } = (await getInvestor(profile.investorId!))!;
  return {
    personId: person.id,
    name: person.name,
    title: person.title,
    org: i.name,
    trust: person.trust,
    oneLiner: i.description.value,
    oneLinerSources: i.description.sources,
    facts: [
      { label: "Focus", value: i.focus.value.slice(0, 2).join(", "), sources: i.focus.sources },
      { label: "Deals, last 12m", value: String(check.stillActive.value.dealsLast12m), sources: check.stillActive.sources },
      {
        label: "Style",
        value: check.leadsOrFollows.value.leads >= check.leadsOrFollows.value.follows ? "Leads" : "Follows",
        sources: check.leadsOrFollows.sources,
      },
    ],
    slush: i.attendsSlush,
  };
}
