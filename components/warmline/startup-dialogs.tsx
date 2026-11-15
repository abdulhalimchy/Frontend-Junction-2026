"use client";

import { ArrowLeft, Building2, Loader2, PenLine, Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SuggestInput } from "./suggest-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CalaCandidate, Startup, StartupField, StartupSummary } from "@/lib/types";
import { STARTUP_COOKIE, startupHref } from "@/lib/startup-cookie";
import { cn } from "@/lib/utils";


export function setActiveStartup(id: string) {
  document.cookie = `${STARTUP_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

// -- form -------------------------------------------------------------------

export type Values = Record<StartupField | "domain", string>;

export const EMPTY: Values = { name: "", domain: "", description: "", founded: "", headquarters: "", employees: "", stage: "", industry: "" };

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

const ORIGIN_LABEL = { cala: "From records", website: "From website", domain: "From domain" } as const;

export function valuesOf(s: Partial<Startup> | null): Values {
  const v = { ...EMPTY };
  for (const k of Object.keys(EMPTY) as (keyof Values)[]) if (typeof s?.[k] === "string") v[k] = s[k] as string;
  return v;
}

export function StartupForm({
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
                    kept ? "bg-brand-soft text-accent-foreground" : "bg-muted text-muted-foreground",
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

type Step = "domain" | "pick" | "looking" | "form";

/** "discord.com" or "https://www.discord.com/app" is a website; "Discord" or "Oura Health" is a name. */
function looksLikeDomain(text: string) {
  return /^(https?:\/\/)?[^\s/]+\.[a-z]{2,}(\/\S*)?$/i.test(text.trim());
}

/** Add a startup: search Cala by name and pick the company, or enter its website; then review what the lookup
 * found. Or fill everything in by hand. */
export function AddStartupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const openStartup = useOpenStartup();
  return (
    <CompanyLookupDialog
      open={open}
      onOpenChange={onOpenChange}
      endpoint="/api/startups"
      title="Add a startup"
      noun="startup"
      onSaved={(s) => openStartup(s.id)}
    />
  );
}

export type LookupDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Collection route: GET/PATCH/DELETE {endpoint}/:id, POST {endpoint} and {endpoint}/lookup. */
  endpoint: string;
  title: string;
  /** "startup" or "company", used in messages. */
  noun: string;
  onSaved: (s: Startup) => void;
  /** More fields under the profile form (e.g. a portfolio company's deal terms), sent with the save. */
  extra?: React.ReactNode;
  extraBody?: Record<string, unknown>;
  /** Check the extra fields before saving; return an error message to block the save. */
  validateExtra?: () => string | null;
  /** Start right away from this Cala company (e.g. a suggestion), skipping the search. */
  initial?: CalaCandidate | null;
  /** Called when the dialog resets (closed or cancelled), so the owner can clear its extra fields. */
  onReset?: () => void;
};

/** The add flow shared by founders' startups and investors' portfolio companies. */
export function CompanyLookupDialog({
  open,
  onOpenChange,
  endpoint,
  title,
  noun,
  onSaved,
  extra,
  extraBody,
  validateExtra,
  initial,
  onReset,
}: LookupDialogProps) {
  const [step, setStep] = useState<Step>("domain");
  const [domain, setDomain] = useState("");
  const [candidates, setCandidates] = useState<CalaCandidate[]>([]);
  const [searched, setSearched] = useState("");
  const [picked, setPicked] = useState<CalaCandidate | null>(null);
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
        const next = await api<Startup>(`${endpoint}/${draft.id}`);
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
  }, [step, draft, endpoint]);

  function reset(keepDraft: boolean) {
    // A draft the user walked away from is deleted, so it never shows up anywhere.
    if (draft && !keepDraft) void api(`${endpoint}/${draft.id}`, { method: "DELETE" }).catch(() => {});
    setStep("domain");
    setDomain("");
    setCandidates([]);
    setSearched("");
    setPicked(null);
    setDraft(null);
    setValues(EMPTY);
    setError(null);
    setBusy(false);
    onReset?.();
  }

  function change(next: boolean, keepDraft = false) {
    if (!next) reset(keepDraft);
    onOpenChange(next);
  }

  async function start(body: { domain?: string; calaId?: string }) {
    setError(null);
    setBusy(true);
    try {
      const d = await api<Startup>(`${endpoint}/lookup`, { method: "POST", body: JSON.stringify(body) });
      setDraft(d);
      setStep("looking");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the lookup.");
    } finally {
      setBusy(false);
    }
  }

  // A website goes straight to the lookup; a name is searched in Cala first, so the user picks the company
  // (Cala's name search also returns namesakes such as ETFs and shell companies).
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = domain.trim();
    if (looksLikeDomain(text)) return start({ domain: text });
    setError(null);
    setBusy(true);
    try {
      const { results } = await api<{ results: CalaCandidate[] }>(`/api/startups/search?${new URLSearchParams({ q: text })}`);
      setCandidates(results);
      setSearched(text);
      setStep("pick");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not search companies.");
    } finally {
      setBusy(false);
    }
  }

  function pick(c: CalaCandidate) {
    setPicked(c);
    void start({ calaId: c.id });
  }

  // Opened from a suggestion: skip the search and look the picked company up straight away.
  useEffect(() => {
    if (!open || !initial || step !== "domain" || draft) return;
    // Deferred so the cleanup cancels it when the effect re-runs (Strict Mode) and only one lookup starts.
    const t = setTimeout(() => pick(initial), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  function manual() {
    setError(null);
    setValues({ ...EMPTY, ...(looksLikeDomain(domain) ? { domain: domain.trim() } : { name: domain.trim() }) });
    setStep("form");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!values.name.trim()) return setError(`Give the ${noun} a name.`);
    const extraError = validateExtra?.();
    if (extraError) return setError(extraError);
    setError(null);
    setBusy(true);
    try {
      const s = draft
        ? await api<Startup>(`${endpoint}/${draft.id}`, { method: "PATCH", body: JSON.stringify({ ...values, ...extraBody, is_draft: false }) })
        : await api<Startup>(endpoint, { method: "POST", body: JSON.stringify({ ...values, ...extraBody }) });
      toast.success(`${s.name} added`);
      change(false, true);
      onSaved(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not save the ${noun}.`);
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      {/* minmax(0,1fr): long lines (a full street address) truncate instead of widening the dialog past its edge. */}
      <DialogContent className="max-h-[90vh] grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {step === "form"
              ? draft
                ? "Here is what we found. Check each value, change anything that is wrong, then save."
                : "Fill in what you know. Only the name is required."
              : step === "pick"
                ? "Pick the company. We fill in what the verified records hold on it, and read its website on record."
                : "Search by name or enter its website. We look it up in verified records and on the site, and fill in what we find."}
          </DialogDescription>
        </DialogHeader>

        {step === "domain" && (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="startup-lookup-domain" className="text-xs font-medium text-muted-foreground">
                Company name or website
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute top-4 left-2.5 z-10 size-4 -translate-y-1/2 text-subtle" />
                <SuggestInput
                  id="startup-lookup-domain"
                  autoFocus
                  inline
                  value={domain}
                  onValueChange={setDomain}
                  // Names are suggested from the records as you type; a website is looked up as it is.
                  remote={looksLikeDomain(domain) || busy ? undefined : "/api/search"}
                  onPick={(s) => pick({ id: s.key, name: s.label, description: s.hint ?? "", domain: "", headquarters: "", founded: "" })}
                  placeholder="Northlight Robotics or northlight.ai"
                  className="pl-8"
                />
              </div>
            </div>
            {error && <p className="text-[13px] text-destructive">{error}</p>}
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={manual} className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
                <PenLine className="size-3.5" /> Enter details yourself
              </button>
              <Button type="submit" disabled={busy || domain.trim().length < 2}>
                {busy ? <Loader2 className="animate-spin" /> : looksLikeDomain(domain) ? <Sparkles /> : <Search />}
                {looksLikeDomain(domain) ? "Look up" : "Search"}
              </Button>
            </div>
          </form>
        )}

        {step === "pick" && (
          <div className="space-y-4">
            {candidates.length ? (
              <ul className="max-h-80 space-y-1.5 overflow-y-auto">
                {candidates.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => pick(c)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 disabled:opacity-60",
                        picked?.id === c.id && "border-primary/60",
                      )}
                    >
                      <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{c.name}</span>
                          {busy && picked?.id === c.id && <Loader2 className="size-3.5 animate-spin text-primary" />}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[c.domain || "No website on record", c.headquarters, c.founded && `Founded ${c.founded}`].filter(Boolean).join(" · ")}
                        </span>
                        {c.description && <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{c.description}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                No company on record is named “{searched}”. Try its website instead, or enter the details yourself.
              </p>
            )}
            {error && <p className="text-[13px] text-destructive">{error}</p>}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep("domain");
                }}
                className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" /> Not listed? Search again or enter its website
              </button>
              <Button type="button" variant="outline" onClick={manual}>
                <PenLine /> Enter details yourself
              </Button>
            </div>
          </div>
        )}

        {step === "looking" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
              <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Looking up {picked?.name ?? draft?.domain}</p>
                <p className="text-xs text-muted-foreground">Checking verified records and reading the company&apos;s website. This usually takes 5–20 seconds.</p>
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
                  setValues({ ...EMPTY, ...(picked ? { name: picked.name, domain: picked.domain } : { domain: draft?.domain ?? domain }) });
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
              <p className="rounded-lg bg-brand-soft/60 px-3 py-2 text-[13px] text-accent-foreground">{draft.enrichment.note}</p>
            )}
            {draft?.enrichment.status === "failed" && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
                The lookup did not finish. Fill in the details yourself.
              </p>
            )}
            <StartupForm values={values} onChange={setValues} suggestions={draft?.suggestions} />
            {extra}
            {error && <p className="text-[13px] text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => change(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="animate-spin" />} Save {noun}
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
        // The page then opens another of the founder's startups, or offers to add one.
        setActiveStartup("");
        router.push(startupHref(null));
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
            This removes the startup and everything you entered for it. It cannot be undone. Its public record is not affected.
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
