"use client";

import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { clearHistoryAction, deleteAnalysisAction, refreshAnalysisAction } from "./actions";

/** Re-renders the page every few seconds while the backend is still answering, so sections appear as they land. */
export function PollWhileLoading({ active, everyMs = 4000 }: { active: boolean; everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(t);
  }, [active, everyMs, router]);
  return null;
}

export function RefreshAnalysisButton({ id, running }: { id: string; running: boolean }) {
  const [pending, start] = useTransition();
  const busy = pending || running;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="bg-card"
      disabled={busy}
      title="Re-asks Cala this report's 4 questions (uses credit) and updates the saved report"
      onClick={() => {
        if (!window.confirm("Refresh this report from Cala? This re-asks 4 questions, uses Cala credit, and updates the saved report.")) return;
        start(async () => {
          const res = await refreshAnalysisAction(id);
          if (!res.ok) toast.error(res.error);
        });
      }}
    >
      <RefreshCw className={busy ? "animate-spin" : undefined} /> {running ? "Updating…" : "Refresh from Cala"}
    </Button>
  );
}

export function DeleteAnalysisButton({ id, name, afterDelete }: { id: string; name: string; afterDelete?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={`Delete ${name} from history`}
      title="Delete from history"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`Delete the analysis of “${name}” from your history?`)) return;
        start(async () => {
          const res = await deleteAnalysisAction(id);
          if (!res.ok) return void toast.error(res.error);
          toast.success("Deleted from history.");
          if (afterDelete) router.push(afterDelete);
        });
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
    </Button>
  );
}

export function ClearHistoryButton({ count }: { count: number }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      className="bg-card text-destructive hover:text-destructive"
      disabled={pending || !count}
      onClick={() => {
        if (!window.confirm(`Clear your whole market analysis history (${count} ${count === 1 ? "report" : "reports"})? They are deleted from the database and cannot be restored.`)) return;
        start(async () => {
          const res = await clearHistoryAction();
          if (!res.ok) return void toast.error(res.error);
          toast.success(`Cleared ${res.count ?? count} ${res.count === 1 ? "report" : "reports"}.`);
        });
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : <Trash2 />} Clear history
    </Button>
  );
}
