"use client";

import { Check } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

const STEPS = [
  { label: "Role", match: ["/onboarding/role"] },
  { label: "Company", match: ["/onboarding/company"] },
  { label: "Goals", match: ["/onboarding/goals"] },
];

export function OnboardingShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const current = STEPS.findIndex((s) => s.match.includes(pathname));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between gap-4 px-5 sm:px-10">
        <Logo href="/" />
        {current >= 0 && (
          <ol className="hidden items-center gap-2 md:flex">
            {STEPS.map((s, i) => {
              const done = i < current;
              const active = i === current;
              return (
                <li key={s.label} className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-xs font-medium",
                      active ? "bg-card text-foreground shadow-sm ring-1 ring-border" : done ? "text-foreground" : "text-subtle",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-5 items-center justify-center rounded-full text-[10px] tabular",
                        done ? "bg-primary text-primary-foreground" : active ? "bg-teal-soft text-accent-foreground" : "bg-muted",
                      )}
                    >
                      {done ? <Check className="size-3" /> : i + 1}
                    </span>
                    {s.label}
                  </span>
                  {i < STEPS.length - 1 && <span className={cn("h-px w-6", done ? "bg-primary" : "bg-border")} />}
                </li>
              );
            })}
          </ol>
        )}
        <span className="w-24 text-right text-xs text-subtle">{current >= 0 ? `Step ${current + 1} of ${STEPS.length}` : ""}</span>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:px-6 sm:pt-10">{children}</main>
    </div>
  );
}

export function OnboardingCard({ title, description, children, wide }: { title: string; description?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cn("w-full rounded-2xl border bg-card p-6 sm:p-8 shadow-[0_8px_30px_rgba(22,24,26,0.05)]", wide ? "max-w-2xl" : "max-w-md")}>
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}
