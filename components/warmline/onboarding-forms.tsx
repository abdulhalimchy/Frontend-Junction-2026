"use client";

import { ArrowRight, Check, CircleAlert, Landmark, Link2, Plus, Rocket } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Role, StartupSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EntityAvatar } from "./blocks";
import { FundPicker } from "./portfolio";
import { ROLE_HOME, saveProfile } from "./role-switch";
import { CompanyLookupDialog, setActiveStartup } from "./startup-dialogs";

// -- step 1: role -----------------------------------------------------------------

const ROLES = [
  {
    key: "founder",
    label: "Founder",
    hint: "I am building a company",
    icon: Rocket,
    gets: ["Your startup as investors see it", "Investors that fit, and your competitors", "A check of your deck against the record"],
  },
  {
    key: "investor",
    label: "Investor",
    hint: "VC, angel or fund",
    icon: Landmark,
    gets: ["Your portfolio, filled in from the record", "Funding and competitors since you invested", "Checks of the decks founders send you"],
  },
] as const;

export function RoleForm({ initial }: { initial: Role }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(initial);
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          // Saved on the profile now, so the founder/investor switch starts on this side.
          await saveProfile({ role });
          router.push("/onboarding/company");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not save your role.");
          setBusy(false);
        }
      }}
    >
      <div role="radiogroup" aria-label="Your role" className="grid gap-3 sm:grid-cols-2">
        {ROLES.map((o) => {
          const on = role === o.key;
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setRole(o.key)}
              className={cn("rounded-xl border p-4 text-left transition-colors", on ? "border-primary bg-brand-soft/50" : "hover:bg-muted")}
            >
              <span className="flex items-center gap-3">
                <span className={cn("flex size-9 items-center justify-center rounded-lg", on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                  <o.icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{o.label}</span>
                  <span className="block text-xs text-muted-foreground">{o.hint}</span>
                </span>
              </span>
              <ul className="mt-4 space-y-1.5 text-[13px] text-muted-foreground">
                {o.gets.map((g) => (
                  <li key={g} className="flex items-start gap-2">
                    <Check className={cn("mt-0.5 size-3.5 shrink-0", on ? "text-primary" : "text-subtle")} />
                    {g}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
      <Button type="submit" className="mt-6 h-10 w-full" disabled={busy}>
        Continue <ArrowRight />
      </Button>
    </form>
  );
}

// -- step 2: your startup (founder) or your fund (investor) ---------------------------

function StepActions({ ready }: { ready: boolean }) {
  return (
    <div className="mt-6 space-y-2">
      {ready ? (
        <Button className="h-10 w-full" asChild>
          <Link href="/onboarding/goals">
            Continue <ArrowRight />
          </Link>
        </Button>
      ) : (
        <Button variant="ghost" className="h-10 w-full" asChild>
          <Link href="/onboarding/goals">Skip for now</Link>
        </Button>
      )}
    </div>
  );
}

function LoadNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="mb-4 flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-warning">
      <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
      <span>{error} You can skip this step and do it later from the app.</span>
    </p>
  );
}

/** The founder adds their startup with the same lookup the app uses (records and website, then review). */
export function StartupStep({ existing, error }: { existing: StartupSummary[]; error: string | null }) {
  const [startups, setStartups] = useState(existing);
  const [open, setOpen] = useState(false);

  return (
    <div>
      <LoadNote error={error} />
      {startups.length > 0 && (
        <ul className="mb-3 space-y-2">
          {startups.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-xl border p-3">
              <EntityAvatar name={s.name} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{s.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{s.domain || "No website entered"}</span>
              </span>
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-3" />
              </span>
            </li>
          ))}
        </ul>
      )}
      <Button variant={startups.length ? "outline" : "default"} className={cn("h-10 w-full", startups.length > 0 && "bg-card")} onClick={() => setOpen(true)}>
        <Plus /> {startups.length ? "Add another startup" : "Find my startup"}
      </Button>
      {!startups.length && (
        <p className="mt-3 text-center text-xs text-subtle">Not on record yet? You can enter it by hand in the same step.</p>
      )}
      <StepActions ready={startups.length > 0} />
      <CompanyLookupDialog
        open={open}
        onOpenChange={setOpen}
        endpoint="/api/startups"
        title="Add your startup"
        noun="startup"
        onSaved={(s) => {
          // The one just added is the one My startup and Home open on.
          setActiveStartup(s.id);
          setStartups((list) => [{ id: s.id, name: s.name, domain: s.domain }, ...list.filter((x) => x.id !== s.id)]);
        }}
      />
    </div>
  );
}

/** The investor links their fund; Portfolio then lists the companies on record for it, to confirm one by one. */
export function FundStep({ linked, onRecord, error }: { linked: { id: string; name: string } | null; onRecord: number; error: string | null }) {
  const [fund, setFund] = useState(linked);
  const [count, setCount] = useState(onRecord);
  const [changing, setChanging] = useState(false);

  return (
    <div>
      <LoadNote error={error} />
      {fund && !changing ? (
        <div className="flex items-center gap-3 rounded-xl border p-3">
          <EntityAvatar name={fund.name} kind="investor" size="md" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{fund.name}</span>
            <span className="block text-xs text-muted-foreground">
              {count > 0
                ? `${count} ${count === 1 ? "company" : "companies"} on record to review in Portfolio`
                : "Linked. No investments on record for it yet."}
            </span>
          </span>
          <Button variant="ghost" size="sm" onClick={() => setChanging(true)}>
            <Link2 /> Change
          </Button>
        </div>
      ) : (
        <FundPicker
          onLinked={(s) => {
            setFund(s.fund);
            setCount(s.results.length);
            setChanging(false);
          }}
          onCancel={fund ? () => setChanging(false) : undefined}
        />
      )}
      <StepActions ready={!!fund && !changing} />
    </div>
  );
}

// -- step 3: goals ------------------------------------------------------------------

const GOALS: Record<Role, string[]> = {
  founder: ["Raise a round", "Meet investors at Slush", "Track competitors", "Check my deck", "Understand my market", "Get a warm intro"],
  investor: ["Source new deals", "Monitor portfolio competitors", "Meet founders at Slush", "Check founder decks", "Map a market", "Find co-investors"],
};

export function GoalsForm({ role, initial }: { role: Role; initial: string[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>(initial.filter((g) => GOALS[role].includes(g)));

  const [busy, setBusy] = useState(false);

  async function finish() {
    setBusy(true);
    try {
      await saveProfile({ goals: picked, onboarding_completed: true });
      router.push(ROLE_HOME[role]);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save your goals.");
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {GOALS[role].map((g) => {
          const on = picked.includes(g);
          return (
            <button
              key={g}
              type="button"
              aria-pressed={on}
              onClick={() => setPicked((p) => (on ? p.filter((x) => x !== g) : [...p, g]))}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors",
                on ? "border-primary bg-brand-soft text-accent-foreground" : "bg-card hover:bg-muted",
              )}
            >
              {on && <Check className="size-3.5" />}
              {g}
            </button>
          );
        })}
      </div>
      <Button className="mt-8 h-10 w-full" disabled={!picked.length || busy} onClick={finish}>
        Open Warmline <ArrowRight />
      </Button>
    </div>
  );
}
