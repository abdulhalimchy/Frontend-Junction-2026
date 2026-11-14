"use client";

import { CalendarCheck, CalendarPlus } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setGoingAction } from "./actions";

/** "I'm going" toggle. The count is anonymous: how many Warmline users said they are going. */
export function GoingButton({ id, title, going, count, unavailable }: { id: string; title: string; going: boolean; count: number; unavailable?: string }) {
  const [state, setState] = useOptimistic({ going, count });
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !state.going;
    startTransition(async () => {
      setState({ going: next, count: Math.max(0, state.count + (next ? 1 : -1)) });
      const res = await setGoingAction(id, next);
      if (!res.ok) toast.error(res.error);
      else toast.success(next ? `Added “${title}” to your week` : `Removed “${title}” from your week`);
    });
  }

  const others = state.count - (state.going ? 1 : 0);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant={state.going ? "default" : "outline"}
        className={state.going ? undefined : "bg-card"}
        onClick={toggle}
        disabled={pending || !!unavailable}
        title={unavailable}
        aria-pressed={state.going}
      >
        {state.going ? <CalendarCheck /> : <CalendarPlus />}
        {state.going ? "Going" : "I'm going"}
      </Button>
      {others > 0 && (
        <span className="text-[11px] text-subtle tabular">
          {others} other Warmline {others === 1 ? "user" : "users"}
        </span>
      )}
    </div>
  );
}
