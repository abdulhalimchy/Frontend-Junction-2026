import { OnboardingCard } from "@/components/warmline/onboarding-shell";
import { RoleForm } from "@/components/warmline/onboarding-forms";
import { getProfile } from "@/lib/session";

export const metadata = { title: "Your role" };

export default async function RolePage() {
  const profile = await getProfile();
  const firstName = profile.name.split(" ")[0];
  return (
    <OnboardingCard
      title={`Welcome, ${firstName}. Which side are you on?`}
      description="Warmline shows founders and investors different things. You can switch later."
      wide
    >
      <RoleForm initial={profile.role} />
    </OnboardingCard>
  );
}
