import { Suspense } from "react";
import Loading from "@/app/(app)/loading";
import { Bookmark, FileSearch } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SlushTag } from "@/components/warmline/badges";
import { EntityAvatar, PageHeader, Panel } from "@/components/warmline/blocks";
import { CompanyOverview } from "@/components/warmline/company-overview";
import { CompanyTable } from "@/components/warmline/tables";
import { getCompany, getSimilarCompanies } from "@/lib/cala";
import { getRole } from "@/lib/session";
import { fetchCompanyProfile } from "@/lib/cala/company";
import { LiveCompany } from "./live-company";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: PageProps<"/company/[id]">) {
  const { id } = await params;
  if (UUID.test(id)) {
    const p = await fetchCompanyProfile(id).catch(() => null);
    return { title: p?.name ?? "Company" };
  }
  const c = await getCompany(id);
  return { title: c?.name ?? "Company" };
}

async function CompanyPageContent({ params }: PageProps<"/company/[id]">) {
  const { id } = await params;
  // Cala entity IDs show the live overview; the demo personas (e.g. northlight-robotics) keep their mock page.
  if (UUID.test(id)) return <LiveCompany id={id} />;
  const [c, similar, role] = await Promise.all([getCompany(id), getSimilarCompanies(id), getRole()]);
  if (!c) notFound();

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/search" className="text-xs text-muted-foreground hover:text-foreground">
            ← Search
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            <EntityAvatar name={c.name} size="lg" />
            <span>
              <span className="flex items-center gap-2">
                {c.name}
                {c.attendsSlush && <SlushTag />}
              </span>
              <span className="block text-sm font-normal text-muted-foreground">
                {c.sector} · {c.hq.value}
              </span>
            </span>
          </span>
        }
        actions={
          <>
            <Button variant="outline" className="bg-card">
              <Bookmark /> Watch
            </Button>
            {role === "investor" && (
              <Button asChild>
                <Link href="/deck-check">
                  <FileSearch /> Check their deck
                </Link>
              </Button>
            )}
          </>
        }
      />
      <CompanyOverview company={c} />
      <Panel className="mt-6" title="Similar companies" description="Matched on description. The reason is shown for each match.">
        <CompanyTable companies={similar.map((s) => s.company)} reasons={Object.fromEntries(similar.map((s) => [s.id, s.reason]))} />
      </Panel>
    </>
  );
}

// URL data is read inside Suspense so navigation can show the shell instantly.
export default function CompanyPage(props: PageProps<"/company/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <CompanyPageContent {...props} />
    </Suspense>
  );
}
