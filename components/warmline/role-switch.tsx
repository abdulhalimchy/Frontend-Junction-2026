"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ROLE_HOME } from "@/lib/account";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

export { ROLE_HOME };

/** Saves profile fields on the backend (app/api/profile). A role also updates the role cookie. */
export async function saveProfile(patch: { role?: Role; goals?: string[]; onboarding_completed?: boolean }) {
  const res = await fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Could not save your profile.");
  }
}

/** Segmented control for switching between the founder and investor views. The choice is saved to the profile. */
export function RoleSwitch({ role, className }: { role: Role; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function choose(next: Role) {
    if (next === role || busy) return;
    setBusy(true);
    try {
      await saveProfile({ role: next });
      router.push(ROLE_HOME[next]);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not switch.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div role="radiogroup" aria-label="View as" className={cn("grid grid-cols-2 rounded-lg bg-muted p-0.5 text-xs font-medium", busy && "opacity-60", className)}>
      {(["founder", "investor"] as const).map((r) => (
        <button
          key={r}
          type="button"
          role="radio"
          aria-checked={r === role}
          disabled={busy}
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
