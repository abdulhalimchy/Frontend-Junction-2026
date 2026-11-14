"use client";

import { useRouter } from "next/navigation";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

export function setRoleCookie(role: Role) {
  document.cookie = `wl_role=${role}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
}

/** Segmented control for switching between the founder and investor views. */
export function RoleSwitch({ role, className }: { role: Role; className?: string }) {
  const router = useRouter();
  function choose(next: Role) {
    if (next === role) return;
    setRoleCookie(next);
    router.push("/home");
    router.refresh();
  }
  return (
    <div className={cn("grid grid-cols-2 rounded-lg bg-muted p-0.5 text-xs font-medium", className)}>
      {(["founder", "investor"] as const).map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => choose(r)}
          className={cn(
            "rounded-md px-2 py-1 capitalize transition-colors",
            r === role ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
