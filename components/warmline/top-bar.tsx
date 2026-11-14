"use client";

import { Bell, Building2, Landmark, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";

export type PaletteItem = { type: "company" | "investor" | "person" | "page"; label: string; hint: string; href: string; remote?: boolean };

type Hit = { type: "company" | "investor" | "person"; id: string; name: string; subtitle: string; href?: string };

/** Live Cala entity search for the palette, debounced; stale responses are dropped. */
function useCalaSuggestions(q: string): PaletteItem[] {
  const [state, setState] = useState<{ q: string; items: PaletteItem[] }>({ q: "", items: [] });
  const text = q.trim();
  useEffect(() => {
    if (text.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(text)}`, { signal: ctrl.signal });
        const { hits = [] } = (await res.json()) as { hits?: Hit[] };
        const items = hits.map((h) => ({
          type: h.type,
          label: h.name,
          hint: h.subtitle,
          href: h.href ?? (h.type === "investor" ? `/investor/${h.id}` : `/company/${h.id}`),
          remote: true,
        }));
        setState({ q: text, items });
      } catch {
        // aborted or offline: keep the local palette only
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [text]);
  return state.q === text ? state.items : [];
}

const ICONS = { company: Building2, investor: Landmark, person: UserRound, page: Search };

export function TopBar({ items, unread, live }: { items: PaletteItem[]; unread: number; live?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const remote = useCalaSuggestions(open ? q : "");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  const groups = [
    { key: "page", label: "Go to" },
    { key: "company", label: "Companies" },
    { key: "investor", label: "Investors" },
    { key: "person", label: "People" },
  ] as const;

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b bg-background/85 px-8 backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-[420px] items-center gap-2 rounded-lg border bg-card px-3 text-left text-sm text-muted-foreground transition-colors hover:border-primary/30"
      >
        <Search className="size-4" />
        <span className="flex-1">Search companies, investors, people…</span>
        <kbd className="rounded border bg-muted px-1.5 font-sans text-[11px] text-muted-foreground">⌘K</kbd>
      </button>
      <div className="ml-auto flex items-center gap-2">
{!live && (
        <Link href="/alerts" className="relative flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
          <Bell className="size-4" />
          {unread > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-primary ring-2 ring-background" />}
        </Link>
        )}
      </div>

      <CommandDialog open={open} onOpenChange={setOpen} title="Search Warmline" description="Search companies, investors and people">
        <Command>
        <CommandInput placeholder="Search companies, investors, people…" value={q} onValueChange={setQ} />
        <CommandList>
          <CommandEmpty>No matches in your workspace. Press Enter to search Cala.</CommandEmpty>
          {q && (
            <CommandGroup heading="Search">
              <CommandItem
                value={`search ${q}`}
                onSelect={() =>
                  go(live ? `/market?${new URLSearchParams({ mode: "company", sector: q })}` : `/search?q=${encodeURIComponent(q)}`)
                }
              >
                <Search />
                {live ? `Find company “${q}” in Cala` : `Search all of Cala for “${q}”`}
                <CommandShortcut>↵</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          )}
          {groups.map((g) => {
            const local = items.filter((i) => i.type === g.key);
            const seen = new Set(local.map((i) => i.href));
            const list = [...local, ...remote.filter((i) => i.type === g.key && !seen.has(i.href))];
            if (!list.length) return null;
            return (
              <CommandGroup key={g.key} heading={g.label}>
                {list.map((it) => {
                  const Icon = ICONS[it.type];
                  return (
                    <CommandItem key={it.href + it.label} value={`${it.remote ? q : ""} ${it.label} ${it.hint}`} onSelect={() => go(it.href)}>
                      <Icon />
                      <span>{it.label}</span>
                      <span className="ml-auto truncate text-xs text-muted-foreground">{it.hint}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            );
          })}
        </CommandList>
        </Command>
      </CommandDialog>
    </header>
  );
}
