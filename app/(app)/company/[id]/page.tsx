import { Suspense } from "react";
import Loading from "@/app/(app)/loading";
import { notFound } from "next/navigation";
import { fetchCompanyProfile } from "@/lib/cala/company";
import { REGIONS } from "@/lib/cala/market";
import { LiveCompany } from "./live-company";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: PageProps<"/company/[id]">) {
  const { id } = await params;
  if (UUID.test(id)) {
    const p = await fetchCompanyProfile(id).catch(() => null);
    return { title: p?.name ?? "Company" };
  }
  return { title: "Not found" };
}

async function CompanyPageContent({ params, searchParams }: PageProps<"/company/[id]">) {
  const { id } = await params;
  // Only Cala entity IDs have a page.
  if (UUID.test(id)) {
    // ?region= narrows the competitors' market; it defaults to anywhere.
    const { region } = await searchParams;
    return <LiveCompany id={id} region={typeof region === "string" && REGIONS[region] ? region : "anywhere"} />;
  }
  notFound();
}

// URL data is read inside Suspense so navigation can show the shell instantly.
export default function CompanyPage(props: PageProps<"/company/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <CompanyPageContent {...props} />
    </Suspense>
  );
}
