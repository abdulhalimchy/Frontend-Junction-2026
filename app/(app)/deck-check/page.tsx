import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/warmline/blocks";
import { DeckCheck } from "@/components/warmline/deck-check";
import { getDeckCheck, getRole } from "@/lib/session";

export const metadata: Metadata = { title: "Deck check" };

export default async function DeckCheckPage() {
  if ((await getRole()) !== "investor") redirect("/startup/deck");
  const { result, error } = await getDeckCheck();
  return (
    <>
      <PageHeader
        title="Deck check"
        description="Upload a founder's deck. Every factual claim is checked against Cala: confirmed, differs from the record, or can't verify."
      />
      <DeckCheck initial={result} loadError={error} />
    </>
  );
}

// Role-guarded: redirects when the role does not match, so skip instant-navigation validation.
export const instant = false;
