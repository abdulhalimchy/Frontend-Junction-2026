"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { clearAccount } from "@/lib/account";
import { cn } from "@/lib/utils";

/** Mock sign out: forgets the account cookie and goes back to the landing page. */
export function SignOutButton({ compact, className }: { compact?: boolean; className?: string }) {
  const router = useRouter();
  function signOut() {
    clearAccount();
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
