import { Suspense } from "react";
import Loading from "@/app/(onboarding)/loading";
import { FundStep, StartupStep } from "@/components/warmline/onboarding-forms";
import { OnboardingCard } from "@/components/warmline/onboarding-shell";
import { getPortfolioSuggestions } from "@/lib/backend/portfolio";
import { getRole, getStartups } from "@/lib/session";

export const metadata = { title: "Your company" };

// Step 2 uses the app's own flows: a founder adds their startup (My startup), an investor links their fund
// (Portfolio). Both are saved on the backend, so what is set up here is already there when the app opens.
// The role (cookie) and the backend are per request, so they are read inside Suspense, like Home.
export default function CompanyPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CompanyStep />
    </Suspense>
  );
}

async function CompanyStep() {
  if ((await getRole()) === "investor") {
    const { data, error } = await getPortfolioSuggestions().then(
      (data) => ({ data, error: null }),
      (e: unknown) => ({ data: null, error: e instanceof Error ? e.message : "Could not reach your portfolio." }),
    );
    return (
      <OnboardingCard
        title="Link your fund"
        description="Search for your fund by name. We list the companies with a sourced investment from it on record, and you confirm the ones that are yours."
      >
        <FundStep linked={data?.fund ?? null} onRecord={data?.results.length ?? 0} error={error} />
      </OnboardingCard>
    );
  }

  const { items, error } = await getStartups();
  return (
    <OnboardingCard
      title="Add your startup"
      description="Search by name or enter its website. We look it up in verified records and on the site, and you check what we found before it is saved."
    >
      <StartupStep existing={items} error={error} />
    </OnboardingCard>
  );
}
