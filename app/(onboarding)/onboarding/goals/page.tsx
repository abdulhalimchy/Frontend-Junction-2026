import { OnboardingCard } from "@/components/warmline/onboarding-shell";
import { GoalsForm } from "@/components/warmline/onboarding-forms";
import { getProfile } from "@/lib/session";

export const metadata = { title: "Your goals" };

export default async function GoalsPage() {
  const profile = await getProfile();
  return (
    <OnboardingCard title="What do you want from Warmline?" description="Pick a few. We use these to order your home page." wide>
      <GoalsForm role={profile.role} initial={profile.goals} />
    </OnboardingCard>
  );
}
