import { Suspense } from "react";
import Loading from "@/app/(app)/loading";
import { notFound } from "next/navigation";
import { fetchInvestorProfile } from "@/lib/cala/investor";
import { LiveInvestor } from "./live-investor";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: PageProps<"/investor/[id]">) {
  const { id } = await params;
  if (UUID.test(id)) {
    const p = await fetchInvestorProfile(id).catch(() => null);
    return { title: p?.name ?? "Investor" };
  }
  return { title: "Not found" };
}

async function InvestorPageContent({ params, searchParams }: PageProps<"/investor/[id]">) {
  const { id } = await params;
  const { deals } = await searchParams;
  // Only Cala entity IDs have a page.
  if (UUID.test(id)) return <LiveInvestor id={id} showDeals={deals === "1"} />;
  notFound();
}

// URL data is read inside Suspense so navigation can show the shell instantly.
export default function InvestorPage(props: PageProps<"/investor/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <InvestorPageContent {...props} />
    </Suspense>
  );
}
