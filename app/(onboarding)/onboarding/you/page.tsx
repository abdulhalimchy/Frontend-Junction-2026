import { OnboardingCard } from "@/components/warmline/onboarding-shell";
import { AboutYouForm } from "@/components/warmline/onboarding-forms";
import { getPerson } from "@/lib/cala";
import { getProfile } from "@/lib/session";

export const metadata = { title: "About you" };

export default async function AboutYouPage() {
  const profile = await getProfile();
  const person = await getPerson(profile.personId);
  return (
    <OnboardingCard title="About you" description="We prefilled this from verified records. A match on record makes your profile Verified.">
      <AboutYouForm
        role={profile.role}
        person={person ? { name: person.name, title: person.title, trust: person.trust, sources: person.sources } : null}
      />
    </OnboardingCard>
  );
}
