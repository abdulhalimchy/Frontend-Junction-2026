"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

/**
 * Re-asks Cala for this report. The link carries the click time, and the server only honours a refresh
 * token a couple of minutes old, so reloading or bookmarking the page never re-spends credit.
 */
export function RefreshButton({ href }: { href: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="bg-card"
      disabled={pending}
      title="Re-asks Cala this report's 4 questions (uses credit)"
      onClick={() => {
        if (!window.confirm("Refresh this report from Cala? This re-asks 4 questions and uses Cala credit.")) return;
        start(() => router.push(`${href}&refresh=${Date.now()}`));
      }}
    >
      <RefreshCw className={pending ? "animate-spin" : undefined} /> Refresh from Cala
    </Button>
  );
}
