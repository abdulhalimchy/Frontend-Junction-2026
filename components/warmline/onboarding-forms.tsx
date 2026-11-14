"use client";

import { Check, Landmark, Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Role, Source, TrustLevel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TrustBadge } from "./badges";
import { setRoleCookie } from "./role-switch";
import { SourceChip } from "./source-chip";

export function AboutYouForm({
  role: initialRole,
  person,
}: {
  role: Role;
  person: { name: string; title: string; trust: TrustLevel; sources: Source[] } | null;
}) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(initialRole);

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        setRoleCookie(role);
        router.push("/onboarding/goals");
      }}
    >
      {person && (
        <div className="flex items-center justify-between rounded-lg bg-teal-soft/50 px-3 py-2.5 text-[13px]">
          <span>
            Found on record: <span className="font-medium">{person.name}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <TrustBadge level={person.trust} />
            <SourceChip sources={person.sources} />
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" defaultValue={person?.name} className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" defaultValue={person?.title} className="h-10" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>I am a</Label>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { key: "founder", label: "Founder", hint: "Building a company", icon: Rocket },
              { key: "investor", label: "Investor", hint: "VC, angel or fund", icon: Landmark },
            ] as const
          ).map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setRole(o.key)}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                role === o.key ? "border-primary bg-teal-soft/50" : "hover:bg-muted",
              )}
            >
              <o.icon className={cn("mt-0.5 size-4", role === o.key ? "text-primary" : "text-muted-foreground")} />
              <span>
                <span className="block text-sm font-medium">{o.label}</span>
                <span className="block text-xs text-muted-foreground">{o.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
      <Button type="submit" className="h-10 w-full">
        Continue
      </Button>
    </form>
  );
}

const GOALS: Record<Role, string[]> = {
  founder: ["Raise a round", "Meet investors at Slush", "Track competitors", "Check my deck", "Understand my market", "Find partners or customers"],
  investor: ["Source new deals", "Monitor portfolio competitors", "Meet founders at Slush", "Check founder decks", "Map a market", "Find co-investors"],
};

export function GoalsForm({ role, initial }: { role: Role; initial: string[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>(initial.filter((g) => GOALS[role].includes(g)));
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {GOALS[role].map((g) => {
          const on = picked.includes(g);
          return (
            <button
              key={g}
              type="button"
              onClick={() => setPicked((p) => (on ? p.filter((x) => x !== g) : [...p, g]))}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors",
                on ? "border-primary bg-teal-soft text-accent-foreground" : "bg-card hover:bg-muted",
              )}
            >
              {on && <Check className="size-3.5" />}
              {g}
            </button>
          );
        })}
      </div>
      <Button className="mt-8 h-10 w-full" disabled={!picked.length} onClick={() => router.push("/home")}>
        Continue
      </Button>
    </div>
  );
}
