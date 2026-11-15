import { Suspense } from "react";
import Loading from "@/app/(onboarding)/loading";
import { OnboardingCard } from "@/components/warmline/onboarding-shell";
import { RoleForm } from "@/components/warmline/onboarding-forms";
import { getMe } from "@/lib/backend/account";
import { getRole } from "@/lib/session";

export const metadata = { title: "Your role" };

// The account and role are per request, so they are read inside Suspense.
export default function RolePage() {
  return (
    <Suspense fallback={<Loading />}>
      <RoleStep />
    </Suspense>
  );
}

async function RoleStep() {
  const [me, role] = await Promise.all([getMe().catch(() => null), getRole()]);
  const firstName = me?.full_name.split(" ")[0];
  return (
    <OnboardingCard
      title={firstName ? `Welcome, ${firstName}. Which side are you on?` : "Which side are you on?"}
      description="Warmline shows founders and investors different things. You can switch any time from the menu."
      wide
    >
      <RoleForm initial={me?.profile.role || role} />
    </OnboardingCard>
  );
}
