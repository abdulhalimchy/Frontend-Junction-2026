"use client";

import { Globe, Loader2, PenLine, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Startup, StartupField, StartupSummary } from "@/lib/types";
import { DEMO_STARTUP_ID, STARTUP_COOKIE, startupHref } from "@/lib/startup-cookie";
import { cn } from "@/lib/utils";

export { DEMO_STARTUP_ID };

export function setActiveStartup(id: string) {
  document.cookie = `${STARTUP_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

// -- form -------------------------------------------------------------------

type Values = Record<StartupField | "domain", string>;

const EMPTY: Values = { name: "", domain: "", description: "", founded: "", headquarters: "", employees: "", stage: "", industry: "" };

const FIELDS: { key: StartupField | "domain"; label: string; placeholder: string; wide?: boolean; multiline?: boolean }[] = [
  { key: "name", label: "Name", placeholder: "Northlight Robotics", wide: true },
  { key: "description", label: "What it does", placeholder: "One or two sentences.", wide: true, multiline: true },
  { key: "domain", label: "Website", placeholder: "northlight.ai" },
  { key: "headquarters", label: "Headquarters", placeholder: "Helsinki, Finland" },
  { key: "founded", label: "Founded", placeholder: "2023 or 2023-05" },
  { key: "employees", label: "Employees", placeholder: "11–50" },
  { key: "stage", label: "Stage", placeholder: "Pre-seed" },
  { key: "industry", label: "Industry", placeholder: "Marine robotics" },
];

const ORIGIN_LABEL = { cala: "From Cala", website: "From website", domain: "From domain" } as const;

function valuesOf(s: Partial<Startup> | null): Values {
  const v = { ...EMPTY };
  for (const k of Object.keys(EMPTY) as (keyof Values)[]) if (typeof s?.[k] === "string") v[k] = s[k] as string;
  return v;
}

function StartupForm({
  values,
  onChange,
  suggestions,
  sources,
}: {
  values: Values;
  onChange: (v: Values) => void;
  suggestions?: Startup["suggestions"];
  sources?: Startup["sources"];
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
      {FIELDS.map((f) => {
        const s = f.key !== "domain" ? suggestions?.[f.key] : undefined;
        const sourced = f.key !== "domain" && !!sources?.[f.key]?.length;
        const kept = s && s.value === values[f.key];
        const id = `startup-${f.key}`;
        const Field = f.multiline ? Textarea : Input;
        return (
          <div key={f.key} className={cn("space-y-1.5", f.wide && "col-span-2")}>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
                {f.label}
                {f.key === "name" && <span className="text-destructive"> *</span>}
              </Label>
              {s && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-medium",
                    kept ? "bg-teal-soft text-accent-foreground" : "bg-muted text-muted-foreground",
                  )}
                  title={kept ? "Suggested by the lookup. Saved with its sources." : "Edited: saved as your own entry, without sources."}
                >
                  {kept ? (
                    <>
                      <Sparkles className="size-2.5" /> {ORIGIN_LABEL[s.origin]}
                    </>
                  ) : (
                    "Edited"
                  )}
                </span>
              )}
              {!s && sourced && <span className="text-[10px] text-subtle">Sourced; editing removes the source</span>}
            </div>
            <Field
              id={id}
              value={values[f.key]}
              placeholder={f.placeholder}
              onChange={(e) => onChange({ ...values, [f.key]: e.target.value })}
              className={cn(f.multiline && "min-h-16 resize-none")}
            />
          </div>
        );
      })}
    </div>
  );
}

function useOpenStartup() {
  const router = useRouter();
  return (id: string) => {
    setActiveStartup(id);
    router.push(startupHref(id));
    router.refresh();
  };
}

// -- add ----------------------------------------------------------------------

type Step = "domain" | "looking" | "form";

/** Add a startup: enter its domain and review what the lookup found, or fill everything in by hand. */
export function AddStartupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const openStartup = useOpenStartup();
  const [step, setStep] = useState<Step>("domain");
  const [domain, setDomain] = useState("");
  const [draft, setDraft] = useState<Startup | null>(null);
  const [values, setValues] = useState<Values>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll the draft while the background lookup runs, then fill the form with what it found.
  useEffect(() => {
    if (step !== "looking" || !draft) return;
    let stop = false;
    const tick = async () => {
      try {
        const next = await api<Startup>(`/api/startups/${draft.id}`);
        if (stop) return;
        if (next.enrichment.status === "completed" || next.enrichment.status === "failed") {
          setDraft(next);
          setValues({
            ...EMPTY,
            domain: next.domain,
            ...Object.fromEntries(Object.entries(next.suggestions).map(([k, s]) => [k, s?.value ?? ""])),
          });
          setStep("form");
          return;
        }
      } catch {
        /* keep polling; a slow lookup is normal */
      }
      if (!stop) timer = setTimeout(tick, 1500);
    };
    let timer = setTimeout(tick, 1200);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [step, draft]);

  function reset(keepDraft: boolean) {
    // A draft the user walked away from is deleted, so it never shows up anywhere.
    if (draft && !keepDraft) void api(`/api/startups/${draft.id}`, { method: "DELETE" }).catch(() => {});
    setStep("domain");
    setDomain("");
    setDraft(null);
    setValues(EMPTY);
    setError(null);
    setBusy(false);
  }

  function change(next: boolean, keepDraft = false) {
    if (!next) reset(keepDraft);
    onOpenChange(next);
  }

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const d = await api<Startup>("/api/startups/lookup", { method: "POST", body: JSON.stringify({ domain }) });
      setDraft(d);
      setStep("looking");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the lookup.");
    } finally {
      setBusy(false);
    }
  }

  function manual() {
    setError(null);
    setValues({ ...EMPTY, domain: domain.trim() });
    setStep("form");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!values.name.trim()) return setError("Give the startup a name.");
    setError(null);
    setBusy(true);
    try {
      const s = draft
        ? await api<Startup>(`/api/startups/${draft.id}`, { method: "PATCH", body: JSON.stringify({ ...values, is_draft: false }) })
        : await api<Startup>("/api/startups", { method: "POST", body: JSON.stringify(values) });
      toast.success(`${s.name} added`);
      change(false, true);
      openStartup(s.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the startup.");
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a startup</DialogTitle>
          <DialogDescription>
            {step === "form"
              ? draft
                ? "Here is what we found. Check each value, change anything that is wrong, then save."
                : "Fill in what you know. Only the name is required."
              : "Start with its website. We look it up in Cala and on the site, and fill in what we find."}
          </DialogDescription>
        </DialogHeader>

        {step === "domain" && (
          <form onSubmit={lookup} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="startup-lookup-domain" className="text-xs font-medium text-muted-foreground">
                Company domain
              </Label>
              <div className="relative">
                <Globe className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle" />
                <Input
                  id="startup-lookup-domain"
                  autoFocus
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="northlight.ai"
                  className="pl-8"
                />
              </div>
            </div>
            {error && <p className="text-[13px] text-destructive">{error}</p>}
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={manual} className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
                <PenLine className="size-3.5" /> No website yet? Enter details yourself
              </button>
              <Button type="submit" disabled={busy || !domain.trim()}>
                {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Look up
              </Button>
            </div>
          </form>
        )}

        {step === "looking" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
              <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Looking up {draft?.domain}</p>
                <p className="text-xs text-muted-foreground">Checking Cala and reading the company&apos;s website. This usually takes 5–20 seconds.</p>
              </div>
            </div>
            <div className="space-y-2">
              {[70, 100, 55].map((w) => (
                <div key={w} className="h-3 animate-pulse rounded bg-muted" style={{ width: `${w}%` }} />
              ))}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => change(false)}>
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setValues({ ...EMPTY, domain: draft?.domain ?? domain });
                  setStep("form");
                }}
              >
                Skip, fill in myself
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "form" && (
          <form onSubmit={save} className="space-y-4">
            {draft?.enrichment.note && (
              <p className="rounded-lg bg-teal-soft/60 px-3 py-2 text-[13px] text-accent-foreground">{draft.enrichment.note}</p>
            )}
            {draft?.enrichment.status === "failed" && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
                The lookup did not finish. Fill in the details yourself.
              </p>
            )}
            <StartupForm values={values} onChange={setValues} suggestions={draft?.suggestions} />
            {error && <p className="text-[13px] text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => change(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="animate-spin" />} Save startup
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// -- edit -------------------------------------------------------------------

/** Edit every field of an added startup. Kept values keep their sources; changed ones become the user's own. */
export function EditStartupDialog({ startup, open, onOpenChange }: { startup: Startup; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {startup.name}</DialogTitle>
          <DialogDescription>Values you change are saved as your own entry, without sources.</DialogDescription>
        </DialogHeader>
        <EditStartupForm startup={startup} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function EditStartupForm({ startup, onDone }: { startup: Startup; onDone: () => void }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(() => valuesOf(startup));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!values.name.trim()) return setError("Give the startup a name.");
    setBusy(true);
    try {
      await api(`/api/startups/${startup.id}`, { method: "PATCH", body: JSON.stringify(values) });
      toast.success("Startup updated");
      onDone();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <StartupForm values={values} onChange={setValues} sources={startup.sources} />
      {error && <p className="text-[13px] text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} Save changes
        </Button>
      </DialogFooter>
    </form>
  );
}

// -- rename / delete --------------------------------------------------------

export function RenameStartupDialog({
  startup,
  open,
  onOpenChange,
}: {
  startup: StartupSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename startup</DialogTitle>
        </DialogHeader>
        {startup && <RenameForm startup={startup} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function RenameForm({ startup, onDone }: { startup: StartupSummary; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(startup.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("The name cannot be empty.");
    setBusy(true);
    try {
      await api(`/api/startups/${startup.id}`, { method: "PATCH", body: JSON.stringify({ name: name.trim() }) });
      toast.success("Renamed");
      onDone();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label="Startup name" />
      {error && <p className="text-[13px] text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy || !name.trim() || name.trim() === startup.name}>
          {busy && <Loader2 className="animate-spin" />} Rename
        </Button>
      </DialogFooter>
    </form>
  );
}

export function DeleteStartupDialog({
  startup,
  active,
  open,
  onOpenChange,
}: {
  startup: StartupSummary | null;
  active: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!startup) return;
    setBusy(true);
    try {
      await api(`/api/startups/${startup.id}`, { method: "DELETE" });
      toast.success(`${startup.name} deleted`);
      onOpenChange(false);
      if (active) {
        setActiveStartup(DEMO_STARTUP_ID);
        router.push(startupHref(DEMO_STARTUP_ID));
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Delete {startup?.name}?</DialogTitle>
          <DialogDescription>
            This removes the startup and everything you entered for it. It cannot be undone. Its record in Cala is not affected.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={remove} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
