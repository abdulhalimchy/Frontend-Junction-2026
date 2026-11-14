import { OnboardingCard } from "@/components/warmline/onboarding-shell";
import { FindCompany } from "@/components/warmline/find-company";
import { searchEntity } from "@/lib/cala";

export const metadata = { title: "Find your company" };

export default async function FindCompanyPage() {
  // Phase 1 filters a fixed list in the browser; Phase 2 calls Cala as you type.
  const hits = (await searchEntity("")).filter((h) => h.type !== "person");
  return (
    <OnboardingCard title="Find your company" description="Search Cala by name or by what the company does.">
      <FindCompany options={hits.map((h) => ({ id: h.id, name: h.name, subtitle: h.subtitle, type: h.type as "company" | "investor" }))} />
    </OnboardingCard>
  );
}
