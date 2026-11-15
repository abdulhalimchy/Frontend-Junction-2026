import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/warmline/blocks";
import { DeckCheck } from "@/components/warmline/deck-check";
import { demoDataEnabled } from "@/lib/demo";
import { getDeckChecks, getRole } from "@/lib/session";

export const metadata: Metadata = { title: "Deck check" };

export default async function DeckCheckPage({ searchParams }: PageProps<"/deck-check">) {
  // Demo mode has roles (founders check their own deck under My startup); live mode has no roles yet.
  if (demoDataEnabled() && (await getRole()) !== "investor") redirect("/startup/deck");
  const wanted = (await searchParams).check;
  const { history, result, error } = await getDeckChecks(undefined, typeof wanted === "string" ? wanted : undefined);
  return (
    <>
      <PageHeader
        title="Deck check"
        description="Upload a founder's deck. Every factual claim is checked against verified sources: confirmed, differs from the record, or can't verify."
      />
      <DeckCheck initial={result} history={history} loadError={error} />
    </>
  );
}

// Role-guarded: redirects when the role does not match, so skip instant-navigation validation.
export const instant = false;
