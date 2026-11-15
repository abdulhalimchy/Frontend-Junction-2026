"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import type { Profile } from "@/lib/types";

const ITEMS: { key: keyof Profile["privacy"]; label: string; hint: string }[] = [
  { key: "showInEventDirectory", label: "Show me in event attendee lists", hint: "Other attendees can find you in the Slush 2026 space." },
];

// Phase 2 persists these to Supabase.
export function PrivacySettings({ initial }: { initial: Profile["privacy"] }) {
  const [state, setState] = useState(initial);
  return (
    <ul className="divide-y">
      {ITEMS.map((it) => (
        <li key={it.key} className="flex items-center justify-between gap-6 py-3 first:pt-0 last:pb-0">
          <div>
            <div className="text-sm font-medium">{it.label}</div>
            <div className="text-xs text-muted-foreground">{it.hint}</div>
          </div>
          <Switch
            checked={state[it.key]}
            onCheckedChange={(v) => {
              setState((s) => ({ ...s, [it.key]: v }));
              toast.success("Setting updated");
            }}
          />
        </li>
      ))}
    </ul>
  );
}
