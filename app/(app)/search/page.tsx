import { Suspense } from "react";
import Loading from "@/app/(app)/loading";
import { Building2, Landmark, Search as SearchIcon, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { SlushTag } from "@/components/warmline/badges";
import { EmptyState, EntityAvatar, PageHeader, Panel } from "@/components/warmline/blocks";
import { searchEntity } from "@/lib/cala";
import { calaErrorKind, mocksEnabled } from "@/lib/cala/client";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Search" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "company", label: "Companies", icon: Building2 },
  { key: "investor", label: "Investors", icon: Landmark },
  { key: "person", label: "People", icon: UserRound },
] as const;

async function SearchPageContent({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const type = typeof sp.type === "string" ? sp.type : "all";
  const live = !mocksEnabled();
  let all: Awaited<ReturnType<typeof searchEntity>> = [];
  let problem: string | null = null;
  try {
    all = await searchEntity(q);
  } catch (e) {
    const kind = calaErrorKind(e);
    problem =
      kind === "missing_key" ? "Cala is not configured on this server." : kind === "no_credit" ? "The Cala credit balance is empty." : "Could not reach Cala. Try again.";
  }
  const hits = type === "all" ? all : all.filter((h) => h.type === type);

  return (
    <>
      <PageHeader
        title="Search"
        description={
          live
            ? "Companies and organisations in Cala's knowledge graph, matched on name. Investor firms are companies too; their page shows their deals."
            : "Companies, investors and people from Cala's knowledge graph. Matching uses descriptions, not just industry codes."
        }
      />
      <form action="/search" className="relative mb-4">
        <SearchIcon className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" defaultValue={q} placeholder={live ? "Try “Planhat”, “Creandum” or “Wolt”" : "Try “hull inspection”, “Fjord” or “Bergen”"} className="h-11 rounded-xl bg-card pl-10 text-[15px]" />
        {type !== "all" && <input type="hidden" name="type" value={type} />}
      </form>
      <div className="mb-5 flex gap-2">
        {FILTERS.map((f) => {
          const count = f.key === "all" ? all.length : all.filter((h) => h.type === f.key).length;
          if (live && f.key !== "all" && !count && type !== f.key) return null; // hide types live search never returns
          const params = new URLSearchParams({ ...(q && { q }), ...(f.key !== "all" && { type: f.key }) });
          return (
            <Link
              key={f.key}
              href={`/search?${params}`}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium",
                type === f.key ? "border-primary/30 bg-teal-soft text-accent-foreground" : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
              <span className="text-xs tabular opacity-70">{count}</span>
            </Link>
          );
        })}
      </div>
      <Panel bodyClassName="p-2">
        {hits.length ? (
          <ul className="divide-y">
            {hits.map((h) => {
              const href = h.type === "company" ? `/company/${h.id}` : h.type === "investor" ? `/investor/${h.id}` : h.href;
              return (
                <li key={`${h.type}-${h.id}`}>
                  <Link href={href} className="flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-muted/50">
                    <EntityAvatar name={h.name} kind={h.type} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{h.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{h.subtitle}</div>
                    </div>
                    {"attendsSlush" in h && h.attendsSlush && <SlushTag label="Slush" />}
                    <span className="w-20 text-right text-xs capitalize text-subtle">{h.type}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : problem ? (
          <EmptyState icon={SearchIcon} title="Search is unavailable" description={problem} />
        ) : live && q.trim().length < 2 ? (
          <EmptyState icon={SearchIcon} title="Search Cala" description="Type a company or investor name. Results come from Cala's knowledge graph." />
        ) : (
          <EmptyState
            icon={SearchIcon}
            title={`Nothing on record for “${q}”`}
            description={live ? "Live search matches names. To find companies by what they do, use Market." : "Try describing what the company does instead of its name."}
          />
        )}
      </Panel>
    </>
  );
}

// URL data is read inside Suspense so navigation can show the shell instantly.
export default function SearchPage(props: PageProps<"/search">) {
  return (
    <Suspense fallback={<Loading />}>
      <SearchPageContent {...props} />
    </Suspense>
  );
}
