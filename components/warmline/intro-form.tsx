"use client";

import { ArrowRight, Building2, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// From / To pickers for warm intros. Both search Cala (via /api/search) and resolve to entity ids.
// "From" is remembered in a cookie so it is filled in next time.

export type Picked = { id: string; name: string } | null;

export const FROM_COOKIE = "wl_intro_from";

type Hit = { id: string; name: string; subtitle: string; type: string };

export function IntroForm({ from, to }: { from: Picked; to: Picked }) {
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
      <Picker label="You (your company or fund)" value={f} onChange={(v) => { setF(v); submit(v, t); }} placeholder="e.g. Personio" />
      <ArrowRight className="mb-3 size-4 text-muted-foreground" />
      <Picker label="Who you want to meet" value={t} onChange={(v) => { setT(v); submit(f, v); }} placeholder="e.g. Creandum" />
      <Button className="h-10" disabled={!f || !t} onClick={() => submit(f, t)}>
        Find intros
      </Button>
    </div>
  );
}

function Picker({ label, value, onChange, placeholder }: { label: string; value: Picked; onChange: (v: Picked) => void; placeholder: string }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ q: string; list: Hit[] }>({ q: "", list: [] });
  const [loading, setLoading] = useState(false);
  const text = q.trim();

  useEffect(() => {
    if (text.length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(text)}`, { signal: ctrl.signal });
        const { hits: list = [] } = (await res.json()) as { hits?: Hit[] };
        setHits({ q: text, list });
      } catch {
        // aborted or offline
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [text]);

  const list = hits.q === text ? hits.list : [];

  return (
    <label className="relative block min-w-0">
      <span className="mb-1.5 block text-[13px] font-medium text-muted-foreground">{label}</span>
      {value ? (
        <span className="flex h-10 items-center gap-2 rounded-lg border bg-card px-3 text-sm">
          <Building2 className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{value.name}</span>
          <button type="button" aria-label={`Clear ${label}`} onClick={() => onChange(null)} className="ml-auto text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </span>
      ) : (
        <>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="h-10 bg-card" autoComplete="off" />
          {loading && <Loader2 className="absolute right-3 bottom-3 size-4 animate-spin text-muted-foreground" />}
          {text.length >= 2 && list.length > 0 && (
            <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
              {list.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setQ("");
                      onChange({ id: h.id, name: h.name });
                    }}
                    className="flex w-full flex-col items-start rounded-md px-2.5 py-2 text-left hover:bg-muted"
                  >
                    <span className="text-sm font-medium">{h.name}</span>
                    <span className="line-clamp-1 text-xs text-muted-foreground">{h.subtitle}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </label>
  );
}
