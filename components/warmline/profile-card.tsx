"use client";

import { QRCodeSVG } from "qrcode.react";
import type { Source, TrustLevel } from "@/lib/types";
import { SlushTag, TrustBadge } from "./badges";
import { SourceChip } from "./source-chip";

export type CardData = {
  personId: string;
  name: string;
  title: string;
  org: string;
  trust: TrustLevel;
  oneLiner: string;
  oneLinerSources: Source[];
  facts: { label: string; value: string; sources: Source[] }[];
  slush: boolean;
};

// Placeholder share URL until we decide on the public card route.
const CARD_BASE = "https://warmline.example/c/";

/** Verified profile card with QR. Scanning it adds the person to the scanner's Met list. */
export function ProfileCard({ data, size = "md" }: { data: CardData; size?: "md" | "lg" }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-[0_8px_30px_rgba(22,24,26,0.06)]">
      <div className="h-1.5 bg-primary" />
      <div className="flex gap-6 p-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <TrustBadge level={data.trust} />
            {data.slush && <SlushTag />}
          </div>
          <h3 className={size === "lg" ? "mt-3 text-2xl font-semibold tracking-tight" : "mt-3 text-xl font-semibold tracking-tight"}>{data.name}</h3>
          <p className="text-sm text-muted-foreground">
            {data.title}, {data.org}
          </p>
          <p className="mt-3 flex items-start gap-2 text-[13px] leading-relaxed">
            <span>{data.oneLiner}</span>
            <SourceChip sources={data.oneLinerSources} className="mt-0.5" />
          </p>
          <dl className="mt-4 grid grid-cols-3 gap-3">
            {data.facts.map((f) => (
              <div key={f.label} className="rounded-lg bg-muted/60 px-3 py-2">
                <dt className="text-[11px] text-muted-foreground">{f.label}</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold tabular">
                  {f.value}
                </dd>
                <div className="mt-1">
                  <SourceChip sources={f.sources} />
                </div>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-2">
          <div className="rounded-xl border bg-white p-2.5">
            <QRCodeSVG value={CARD_BASE + data.personId} size={size === "lg" ? 132 : 112} fgColor="#16181a" level="M" />
          </div>
          <span className="text-[11px] text-subtle">Scan to add to Met</span>
        </div>
      </div>
    </div>
  );
}
