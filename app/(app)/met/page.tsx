import { Handshake, QrCode } from "lucide-react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { SlushTag, TrustBadge } from "@/components/warmline/badges";
import { EntityAvatar, EmptyState, PageHeader, Panel } from "@/components/warmline/blocks";
import { DataTable, type Row } from "@/components/warmline/data-table";
import { SourceChip } from "@/components/warmline/source-chip";
import { getCompany, getInvestor, getPeople } from "@/lib/cala";
import { formatDay } from "@/lib/format";
import { getMet } from "@/lib/session";
import Link from "next/link";

export const metadata: Metadata = { title: "Met" };

export default async function MetPage() {
  const met = await getMet();
  const people = await getPeople(met.map((m) => m.personId));

  const rows: Row[] = await Promise.all(
    met.map(async (m) => {
      const p = people.find((x) => x.id === m.personId)!;
      const org = p.companyId ? (await getCompany(p.companyId))!.name : (await getInvestor(p.investorId!))!.investor.name;
      const href = p.companyId ? `/company/${p.companyId}` : `/investor/${p.investorId}`;
      return {
        id: m.id,
        href,
        cells: {
          person: {
            display: (
              <div className="flex items-center gap-2.5">
                <EntityAvatar name={p.name} kind="person" size="sm" />
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.title}, {org}
                  </div>
                </div>
              </div>
            ),
            sort: p.name,
          },
          trust: {
            display: (
              <div className="flex items-center gap-1.5">
                <TrustBadge level={p.trust} />
                <SourceChip sources={p.sources} />
              </div>
            ),
          },
          where: {
            display: (
              <div className="flex items-center gap-2">
                <span className="text-[13px]">{m.where}</span>
                {m.slush && <SlushTag label="Slush" />}
              </div>
            ),
            sort: m.where,
          },
          when: { display: <span className="text-[13px] tabular">{formatDay(m.metAt)}</span>, sort: m.metAt },
          note: { display: <span className="line-clamp-2 text-[13px] text-muted-foreground">{m.note}</span> },
        },
      };
    }),
  );

  return (
    <>
      <PageHeader
        title="Met"
        description="People you met, with the verified context from their card. Notes are private to you."
        actions={
          <Button>
            <QrCode /> Scan a card
          </Button>
        }
      />
      <Panel bodyClassName="p-0">
        <DataTable
          columns={[
            { key: "person", label: "Person", width: "28%" },
            { key: "trust", label: "Identity", sortable: false },
            { key: "where", label: "Where" },
            { key: "when", label: "When" },
            { key: "note", label: "Your note", sortable: false, width: "28%" },
          ]}
          rows={rows}
          initialSort={{ key: "when", dir: "desc" }}
          empty={
            <EmptyState
              icon={Handshake}
              title="No one yet"
              description="Scan someone's Warmline card at Slush to add them here."
              action={
                <Button asChild>
                  <Link href="/me">Show my card</Link>
                </Button>
              }
            />
          }
        />
      </Panel>
    </>
  );
}
