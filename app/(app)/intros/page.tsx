import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Loading from "@/app/(app)/loading";
import { PageHeader, Panel } from "@/components/warmline/blocks";
import { FROM_COOKIE, IntroForm, type Picked } from "@/components/warmline/intro-form";
import { mocksEnabled } from "@/lib/cala/client";
import { IntroResults, IntroResultsSkeleton } from "./intro-results";

export const metadata: Metadata = { title: "Warm intros" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function picked(id: unknown, name: unknown): Picked {
  return typeof id === "string" && UUID.test(id) ? { id, name: typeof name === "string" && name ? name.slice(0, 200) : "Selected" } : null;
}

async function IntrosContent({ searchParams }: PageProps<"/intros">) {
  const sp = await searchParams;
  let from = picked(sp.from, sp.fromName);
  if (!from) {
    try {
      const saved = JSON.parse(decodeURIComponent((await cookies()).get(FROM_COOKIE)?.value ?? "null"));
      from = picked(saved?.id, saved?.name);
    } catch {
      from = null;
    }
  }
  const to = picked(sp.to, sp.toName);

  return (
    <>
      <PageHeader
        title="Warm intros"
        description="Who can introduce you, from verified investment records: your investors, your portfolio and your co-investors, and how each is tied to the person you want to meet. Every link shows its sources."
      />
      <Panel className="mb-6 overflow-visible">
        {/* Remount when the URL changes so the pickers show the new selection. */}
        <IntroForm key={`${from?.id}-${to?.id}`} from={from} to={to} />
      </Panel>
      {mocksEnabled() ? (
        <p className="text-sm text-muted-foreground">Warm intros need live data (USE_MOCKS is on).</p>
      ) : from && to ? (
        from.id === to.id ? (
          <p className="text-sm text-muted-foreground">Pick two different companies.</p>
        ) : (
          <Suspense key={`${from.id}-${to.id}`} fallback={<IntroResultsSkeleton />}>
            <IntroResults fromId={from.id} toId={to.id} />
          </Suspense>
        )
      ) : (
        <p className="text-sm text-muted-foreground">Pick your company or fund, then who you want to meet.</p>
      )}
    </>
  );
}

export default function IntrosPage(props: PageProps<"/intros">) {
  return (
    <Suspense fallback={<Loading />}>
      <IntrosContent {...props} />
    </Suspense>
  );
}
