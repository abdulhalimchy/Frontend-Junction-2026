import { Suspense } from "react";
import Loading from "@/app/(app)/loading";
import { AlertTriangle, CheckCircle2, CircleDashed, Handshake } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SlushTag, TrustBadge } from "@/components/warmline/badges";
import { EntityAvatar, FactGrid, PageHeader, Panel } from "@/components/warmline/blocks";
import { SourceChip } from "@/components/warmline/source-chip";
import { CompanyTable } from "@/components/warmline/tables";
import { getCompanies, getInvestor, getPeople, getSimilarCompanies } from "@/lib/cala";
import { formatFuzzyDate, formatMoney } from "@/lib/format";
import { getProfile } from "@/lib/session";
import type { Source } from "@/lib/types";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/investor/[id]">) {
  const d = await getInvestor((await params).id);
  return { title: d?.investor.name ?? "Investor" };
}

async function InvestorPageContent({ params }: PageProps<"/investor/[id]">) {
  const { id } = await params;
  const data = await getInvestor(id);
  if (!data) notFound();
  const { investor: i, check } = data;
  const profile = await getProfile();
  const [portfolio, team] = await Promise.all([getCompanies(i.portfolioIds), getPeople(i.peopleIds)]);

  // "Backs a competitor" is relative to the viewer's own company (founders only).
  const myCompetitors = profile.companyId ? (await getSimilarCompanies(profile.companyId)).map((s) => s.company) : [];
  const competitorHits = myCompetitors.filter((c) => i.portfolioIds.includes(c.id));
  const alreadyInvested = profile.companyId ? i.portfolioIds.includes(profile.companyId) : false;

  const a = check.stillActive.value;
  const { leads, follows } = check.leadsOrFollows.value;

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/search?type=investor" className="text-xs text-muted-foreground hover:text-foreground">
            ← Investors
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            <EntityAvatar name={i.name} kind="investor" size="lg" />
            <span>
              <span className="flex items-center gap-2">
                {i.name}
                {i.attendsSlush && <SlushTag />}
              </span>
              <span className="block text-sm font-normal text-muted-foreground">
                {i.kind} · {i.hq.value}
              </span>
            </span>
          </span>
        }
        actions={
          <Button variant="outline" className="bg-card" asChild>
            <Link href="/met">
              <Handshake /> Add to Met
            </Link>
          </Button>
        }
      />

      {profile.role === "founder" && (
        <Panel className="mb-6" title="Investor check" description={`Before you pitch ${i.name}: three things to know, each with its sources.`}>
          <div className="grid grid-cols-3 gap-4">
            <CheckTile
              tone={a.active ? "good" : "warn"}
              label="Still active?"
              value={a.active ? "Yes, investing" : "Quiet"}
              detail={
                a.lastInvestment
                  ? `Last investment ${formatFuzzyDate(a.lastInvestment)} · ${a.dealsLast12m} deals in the last 12 months`
                  : "No investments on record"
              }
              sources={check.stillActive.sources}
            />
            <CheckTile
              tone="neutral"
              label="Leads or follows?"
              value={leads >= follows ? "Mostly leads" : "Mostly follows"}
              detail={`${leads} rounds led · ${follows} followed, on record`}
              sources={check.leadsOrFollows.sources}
            />
            <CheckTile
              tone={competitorHits.length ? "warn" : "good"}
              label="Backs a competitor?"
              value={competitorHits.length ? `Yes, ${competitorHits.length}` : alreadyInvested ? "Already your investor" : "None on record"}
              detail={competitorHits.length ? competitorHits.map((c) => c.name).join(", ") : "Checked against your competitors"}
              sources={check.backsCompetitor.sources}
            />
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Panel title="About">
            <p className="flex items-start gap-2 text-sm leading-relaxed">
              <span>{i.description.value}</span>
              <SourceChip sources={i.description.sources} className="mt-0.5" />
            </p>
            <div className="mt-5">
              <FactGrid
                facts={[
                  { label: "Focus", value: i.focus.value.join(", "), sources: i.focus.sources },
                  {
                    label: "Cheque size",
                    value: i.checkSize ? `${formatMoney(i.checkSize.value.min)} – ${formatMoney(i.checkSize.value.max)}` : "Not on record",
                    sources: i.checkSize?.sources,
                  },
                  { label: "Headquarters", value: i.hq.value, sources: i.hq.sources },
                  { label: "Portfolio on record", value: `${i.portfolioIds.length} companies` },
                ]}
              />
            </div>
          </Panel>
          <Panel title="Portfolio" description="Companies with a sourced investment from this investor.">
            <CompanyTable companies={portfolio} />
          </Panel>
        </div>
        <Panel title="Team" className="self-start">
          <ul className="space-y-3">
            {team.map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <EntityAvatar name={p.name} kind="person" />
                <div>
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.title}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <TrustBadge level={p.trust} />
                    <SourceChip sources={p.sources} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}

function CheckTile({
  tone,
  label,
  value,
  detail,
  sources,
}: {
  tone: "good" | "warn" | "neutral";
  label: string;
  value: string;
  detail: string;
  sources: Source[];
}) {
  const Icon = tone === "good" ? CheckCircle2 : tone === "warn" ? AlertTriangle : CircleDashed;
  return (
    <div className={cn("rounded-lg border p-4", tone === "warn" && "border-warning/30 bg-warning-soft/50", tone === "good" && "bg-success-soft/40")}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <SourceChip sources={sources} />
      </div>
      <div className="mt-2 flex items-center gap-2 text-base font-semibold">
        <Icon className={cn("size-4", tone === "good" ? "text-success" : tone === "warn" ? "text-warning" : "text-muted-foreground")} />
        {value}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

// URL data is read inside Suspense so navigation can show the shell instantly.
export default function InvestorPage(props: PageProps<"/investor/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <InvestorPageContent {...props} />
    </Suspense>
  );
}
