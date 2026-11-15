import { Suspense } from "react";
import Loading from "@/app/(onboarding)/loading";
import { OnboardingCard } from "@/components/warmline/onboarding-shell";
import { GoalsForm } from "@/components/warmline/onboarding-forms";
import { getMe } from "@/lib/backend/account";
import { getRole } from "@/lib/session";

export const metadata = { title: "Your goals" };

export default function GoalsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <GoalsStep />
    </Suspense>
  );
}

async function GoalsStep() {
  const [me, role] = await Promise.all([getMe().catch(() => null), getRole()]);
  return (
    <OnboardingCard title="What do you want from Warmline?" description="Pick at least one. You can change these later." wide>
      <GoalsForm role={me?.profile.role || role} initial={me?.profile.goals ?? []} />
    </OnboardingCard>
  );
}
