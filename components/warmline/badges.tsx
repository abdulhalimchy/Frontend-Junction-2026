import { BadgeCheck, Building2, UserRound } from "lucide-react";
import type { ClaimStatus, TrustLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

const TRUST = {
  verified: { label: "Verified", icon: BadgeCheck, cls: "bg-brand-soft text-accent-foreground" },
  verified_at_company: { label: "Verified at company", icon: Building2, cls: "bg-brand-soft/70 text-accent-foreground" },
  self_described: { label: "Self-described", icon: UserRound, cls: "bg-muted text-muted-foreground" },
} as const;

export function TrustBadge({ level, className }: { level: TrustLevel; className?: string }) {
  const t = TRUST[level];
  return (
    <span className={cn("inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-medium", t.cls, className)}>
      <t.icon className="size-3" />
      {t.label}
    </span>
  );
}

/** Amber is reserved for Slush. */
export function SlushTag({ label = "Slush 2026", className }: { label?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-full bg-slush-soft px-2 text-[11px] font-medium text-slush-foreground",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-slush" />
      {label}
    </span>
  );
}

const CLAIM = {
  confirmed: { label: "Confirmed", cls: "bg-success-soft text-success" },
  differs: { label: "Differs from record", cls: "bg-warning-soft text-warning" },
  cant_verify: { label: "Can't verify", cls: "bg-muted text-muted-foreground" },
} as const;

/** A claim Cala cannot confirm is "Can't verify", never "false". */
export function ClaimBadge({ status }: { status: ClaimStatus }) {
  const c = CLAIM[status];
  return <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium whitespace-nowrap", c.cls)}>{c.label}</span>;
}

export function Pill({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: "neutral" | "brand" | "warning" | "success"; className?: string }) {
  const tones = {
    neutral: "bg-muted text-muted-foreground",
    brand: "bg-brand-soft text-accent-foreground",
    warning: "bg-warning-soft text-warning",
    success: "bg-success-soft text-success",
  };
  return <span className={cn("inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-medium whitespace-nowrap", tones[tone], className)}>{children}</span>;
}
