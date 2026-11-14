import { OnboardingShell } from "@/components/warmline/onboarding-shell";

export default function OnboardingLayout({ children }: LayoutProps<"/">) {
  return <OnboardingShell>{children}</OnboardingShell>;
}
