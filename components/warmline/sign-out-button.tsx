"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Signs out (app/api/auth/sign-out ends the session) and goes back to the landing page. */
export function SignOutButton({ compact, className }: { compact?: boolean; className?: string }) {
  const router = useRouter();
  async function signOut() {
    await fetch("/api/auth/sign-out", { method: "POST" }).catch(() => null);
    router.push("/");
    router.refresh();
  }
  if (compact)
    return (
      <button
        type="button"
        onClick={signOut}
        title="Sign out"
        aria-label="Sign out"
        className={cn("flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", className)}
      >
        <LogOut className="size-3.5" />
      </button>
    );
  return (
    <Button variant="outline" className={cn("w-full bg-card", className)} onClick={signOut}>
      <LogOut /> Sign out
    </Button>
  );
}
