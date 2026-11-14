import { Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SlushTag } from "@/components/warmline/badges";
import { EntityAvatar } from "@/components/warmline/blocks";
import { OnboardingCard } from "@/components/warmline/onboarding-shell";
import { SourceChip } from "@/components/warmline/source-chip";
import { getCompany, getInvestor } from "@/lib/cala";
import { formatFuzzyDate } from "@/lib/format";
import { getProfile } from "@/lib/session";

export const metadata = { title: "Your company" };

// Phase 2: match the signed-in email domain against Cala (entity_search on the domain).
export default async function CompanyMatchPage() {
  const profile = await getProfile();
  const domain = profile.email.split("@")[1];
  const company = profile.companyId ? await getCompany(profile.companyId) : null;
  const investor = profile.investorId ? (await getInvestor(profile.investorId))?.investor : null;
  const name = company?.name ?? investor?.name ?? "";
  const description = company?.description ?? investor?.description;
  const facts = company
    ? [
        { label: "Founded", value: formatFuzzyDate(company.founded.value), sources: company.founded.sources },
        { label: "HQ", value: company.hq.value, sources: company.hq.sources },
      ]
    : investor
      ? [
          { label: "Type", value: investor.kind, sources: investor.description.sources },
          { label: "HQ", value: investor.hq.value, sources: investor.hq.sources },
        ]
      : [];

  return (
    <OnboardingCard title="Is this your company?" description={`We matched your email domain, ${domain}, to this entity in Cala.`}>
      <div className="rounded-xl border p-4">
        <div className="flex items-center gap-3">
          <EntityAvatar name={name} kind={investor ? "investor" : "company"} size="lg" />
          <div>
            <div className="flex items-center gap-2 font-semibold">
              {name}
              {(company?.attendsSlush || investor?.attendsSlush) && <SlushTag label="Slush" />}
            </div>
            <div className="text-xs text-muted-foreground">{company?.domain ?? domain}</div>
          </div>
        </div>
        {description && (
          <p className="mt-3 flex items-start gap-2 text-[13px] text-muted-foreground">
            <span>{description.value}</span>
            <SourceChip sources={description.sources} className="mt-0.5" />
          </p>
        )}
        <dl className="mt-3 grid grid-cols-2 gap-3">
          {facts.map((f) => (
            <div key={f.label} className="rounded-lg bg-muted/60 px-3 py-2">
              <dt className="text-[11px] text-muted-foreground">{f.label}</dt>
              <dd className="mt-0.5 flex items-center gap-2 text-sm font-medium">
                {f.value} <SourceChip sources={f.sources} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="mt-6 space-y-2">
        <Button className="h-10 w-full" asChild>
          <Link href="/onboarding/you">
            <Check /> Yes, this is my company
          </Link>
        </Button>
        <Button variant="ghost" className="h-10 w-full" asChild>
          <Link href="/onboarding/find-company">No, search for it</Link>
        </Button>
      </div>
    </OnboardingCard>
  );
}
