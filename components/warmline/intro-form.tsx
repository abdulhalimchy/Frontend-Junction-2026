"use client";

import { ArrowRight, Building2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SuggestInput, type Suggestion } from "./suggest-input";

// From / To pickers for warm intros. Both search Cala (via /api/search) and resolve to entity ids.
// "From" also lists the user's own companies (a founder's startups; an investor's fund and portfolio),
// and is remembered in a cookie so it is filled in next time.

export type Picked = { id: string; name: string } | null;

export const FROM_COOKIE = "wl_intro_from";

/** One of the user's own companies. `id` is its Cala id, or "" when it is not matched to a record yet. */
export type MyCompany = { id: string; name: string; hint: string; group: string };

export function IntroForm({ from, to, mine = [] }: { from: Picked; to: Picked; mine?: MyCompany[] }) {
  const router = useRouter();
  const [f, setF] = useState<Picked>(from);
  const [t, setT] = useState<Picked>(to);

  function submit(nextF: Picked, nextT: Picked) {
    if (nextF) document.cookie = `${FROM_COOKIE}=${encodeURIComponent(JSON.stringify(nextF))}; path=/; max-age=31536000; samesite=lax`;
    if (!nextF || !nextT) return;
    const params = new URLSearchParams({ from: nextF.id, fromName: nextF.name, to: nextT.id, toName: nextT.name });
    router.push(`/intros?${params}`);
  }

  return (
    <div className="grid grid-cols-[1fr_auto_1fr_auto] items-end gap-3">
      <Picker
        label="You (your company or fund)"
        value={f}
        onChange={(v) => { setF(v); submit(v, t); }}
        placeholder={mine.length ? "Pick one of yours, or search" : "e.g. Personio"}
        mine={mine}
      />
      <ArrowRight className="mb-3 size-4 text-muted-foreground" />
      <Picker label="Who you want to meet" value={t} onChange={(v) => { setT(v); submit(f, v); }} placeholder="e.g. Creandum" />
      <Button className="h-10" disabled={!f || !t} onClick={() => submit(f, t)}>
        Find intros
      </Button>
    </div>
  );
}

const UNMATCHED = "name:";

function Picker({
  label,
  value,
  onChange,
  placeholder,
  mine = [],
}: {
  label: string;
  value: Picked;
  onChange: (v: Picked) => void;
  placeholder: string;
  mine?: MyCompany[];
}) {
  const [q, setQ] = useState("");
  // After a clear the box takes the focus, so the user's own companies are listed again at once.
  const [cleared, setCleared] = useState(false);
  const options: Suggestion[] = mine.map((m) =>
    m.id
      ? { key: m.id, label: m.name, hint: m.hint, group: m.group }
      : { key: `${UNMATCHED}${m.name}`, label: m.name, hint: "Not matched to a record yet: pick it to search by name", group: m.group },
  );

  return (
    <div className="min-w-0">
      <span className="mb-1.5 block text-[13px] font-medium text-muted-foreground">{label}</span>
      {value ? (
        <span className="flex h-10 items-center gap-2 rounded-lg border bg-card px-3 text-sm">
          <Building2 className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{value.name}</span>
          <button
            type="button"
            aria-label={`Clear ${label}`}
            onClick={() => {
              setCleared(true);
              onChange(null);
            }}
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </span>
      ) : (
        <SuggestInput
          value={q}
          onValueChange={setQ}
          options={options}
          showOnFocus
          dropdown={mine.length ? "My companies" : undefined}
          remote="/api/search"
          remoteGroup="All companies"
          onPick={(s) => {
            // One of the user's companies without a record: search the records for its name instead.
            if (s.key.startsWith(UNMATCHED)) {
              setQ(s.label);
              return false;
            }
            setQ("");
            onChange({ id: s.key, name: s.label });
          }}
          autoFocus={cleared}
          placeholder={placeholder}
          aria-label={label}
          className="h-10 bg-card"
        />
      )}
    </div>
  );
}
