import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { Source } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SourceChip } from "./source-chip";

export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card shadow-panel", className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 px-5 pt-4">
          <div>
            {title && <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn("p-5", title && "pt-3", bodyClassName)}>{children}</div>
    </section>
  );
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      {eyebrow && <div className="mb-2">{eyebrow}</div>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight sm:text-[26px]">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  sources,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  sources?: Source[];
  icon?: LucideIcon;
  tone?: "default" | "slush";
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow-panel transition-colors hover:border-foreground/20", tone === "slush" && "border-slush/30 bg-slush-soft/40 hover:border-slush/50")}>
      {/* In a narrow card the source chip drops under the label instead of squeezing it. */}
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
        <span className="flex min-w-0 flex-1 basis-24 items-start gap-1.5 text-[13px] text-muted-foreground">
          {Icon && <Icon className="mt-0.5 size-3.5 shrink-0" />}
          <span className="min-w-0">{label}</span>
        </span>
        {sources && <SourceChip sources={sources} />}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export type Fact = { label: string; value: React.ReactNode; sources?: Source[]; note?: string };

/** Label / value grid where every value carries its source chip. */
export function FactGrid({ facts, columns = 2 }: { facts: Fact[]; columns?: 2 | 3 }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-8 gap-y-4", columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
      {facts.map((f) => (
        <div key={f.label} className="min-w-0 border-b border-dashed pb-3 last:border-0">
          <dt className="text-xs text-muted-foreground">{f.label}</dt>
          <dd className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium">
            <span>{f.value}</span>
            {f.sources && <SourceChip sources={f.sources} />}
          </dd>
          {f.note && <p className="mt-1 text-xs text-subtle">{f.note}</p>}
        </div>
      ))}
    </dl>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed bg-background/40 text-center", compact ? "px-4 py-6" : "px-6 py-12")}>
      {Icon && (
        <div className="mb-3 flex size-9 items-center justify-center rounded-full bg-muted">
          <Icon className="size-4 text-muted-foreground" />
        </div>
      )}
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Route-based tabs (each tab is its own URL). */
export function TabNav({ tabs, active }: { tabs: { href: string; label: string; key: string; count?: number }[]; active: string }) {
  return (
    // Scrolls sideways when the tabs don't fit; on phones they are tighter (and drop their counts) so most fit.
    <nav className="mb-6 flex gap-0 overflow-x-auto border-b [scrollbar-width:none] sm:gap-1 [&::-webkit-scrollbar]:hidden">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 pb-2.5 text-[13px] font-medium whitespace-nowrap transition-colors sm:px-3 sm:text-sm",
            t.key === active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="hidden rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground tabular sm:inline">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function EntityAvatar({ name, kind = "company", size = "md" }: { name: string; kind?: "company" | "investor" | "person"; size?: "sm" | "md" | "lg" }) {
  const letters = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  const sizes = { sm: "size-7 text-[11px]", md: "size-9 text-xs", lg: "size-14 text-lg" };
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center font-semibold",
        kind === "person" ? "rounded-full" : "rounded-lg",
        kind === "investor" ? "bg-linear-to-br from-brand to-brand-2 text-brand-ink" : kind === "person" ? "bg-brand-soft text-accent-foreground" : "bg-muted text-foreground",
        sizes[size],
      )}
    >
      {letters}
    </div>
  );
}
