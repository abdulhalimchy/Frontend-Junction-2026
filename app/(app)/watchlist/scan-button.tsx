"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { scanAction } from "./actions";

/** Runs the nightly check now. New changes appear on the rows once the page refreshes. */
export function ScanButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      className="bg-card"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await scanAction();
          if (!res.ok) return void toast.error(res.error);
          const { entities, alerts_created: found, skipped, errors } = res.result;
          const failed = Object.keys(errors).length;
          if (!entities && !failed)
            return void toast.info(skipped ? "Only demo entries are watched. Watch a live Cala company to see changes." : "Watch a company or investor first.");
          toast.success(
            `Checked ${entities} ${entities === 1 ? "entity" : "entities"}: ${found ? `${found} new ${found === 1 ? "change" : "changes"}` : "nothing new"}.`,
            failed ? { description: `${failed} could not be checked; try again later.` } : undefined,
          );
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      {pending ? "Checking Cala…" : "Check for changes"}
    </Button>
  );
}
