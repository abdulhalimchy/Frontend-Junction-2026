"use client";

import { ChevronDown, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// One text box with suggestions as you type, used by every search in the app.
// Suggestions come from a fixed list (`options`, filtered here), a server endpoint (`remote`, asked with ?q=), or both.
// Keys: ↓ ↑ move, Enter picks the highlighted one (plain Enter still submits what was typed), Esc closes.

export type Suggestion = { key: string; label: string; hint?: string; group?: string; href?: string };

type RemoteHit = { id: string; name: string; subtitle?: string; href?: string };

type Props = Omit<React.ComponentProps<typeof Input>, "value" | "defaultValue" | "onChange"> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Fixed suggestions, matched on their label. */
  options?: Suggestion[];
  /** List `options` as soon as the box has focus, before anything is typed. */
  showOnFocus?: boolean;
  /** Adds a ▾ button that opens `options`; this is its accessible name. */
  dropdown?: string;
  /** Endpoint answering `?q=` with `{ hits: [{ id, name, subtitle?, href? }] }`, e.g. /api/search. */
  remote?: string;
  /** Heading above the remote suggestions (only shown when `options` have groups too). */
  remoteGroup?: string;
  /** Remote suggestions without an href open `${remoteHrefBase}/${id}`. */
  remoteHrefBase?: string;
  /** Called with the picked suggestion; return false to keep the list open. Default: open its href, else fill the box and submit its form. */
  onPick?: (s: Suggestion) => void | false;
  /** Show the list in the page flow below the box instead of floating (for dialogs). */
  inline?: boolean;
  wrapperClassName?: string;
};

const MAX_TYPED = 8;

/** Debounced `remote` lookup; answers for text that is no longer in the box are dropped. */
function useRemote(url: string | undefined, text: string) {
  const [state, setState] = useState<{ q: string; hits: RemoteHit[] }>({ q: "", hits: [] });
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!url || text.length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}q=${encodeURIComponent(text)}`, { signal: ctrl.signal });
        const { hits = [] } = (await res.json()) as { hits?: RemoteHit[] };
        setState({ q: text, hits });
      } catch {
        // aborted or offline: keep the fixed suggestions only
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [url, text]);
  return { hits: url && state.q === text ? state.hits : [], loading: loading && text.length >= 2 };
}

/** Labels starting with the text first, then labels containing it. */
function matchOptions(options: Suggestion[], text: string) {
  const needle = text.toLowerCase();
  const starts: Suggestion[] = [];
  const contains: Suggestion[] = [];
  for (const o of options) {
    const at = o.label.toLowerCase().indexOf(needle);
    if (at === 0) starts.push(o);
    else if (at > 0) contains.push(o);
  }
  return [...starts, ...contains].slice(0, MAX_TYPED);
}

export function SuggestInput({
  value,
  defaultValue = "",
  onValueChange,
  options,
  showOnFocus,
  dropdown,
  remote,
  remoteGroup,
  remoteHrefBase,
  onPick,
  inline,
  wrapperClassName,
  className,
  onKeyDown,
  onFocus,
  onBlur,
  ...props
}: Props) {
  const router = useRouter();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [own, setOwn] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const current = value ?? own;
  const text = current.trim();
  const { hits, loading } = useRemote(remote, text);

  const items = useMemo(() => {
    const local = !options ? [] : text ? matchOptions(options, text) : showOnFocus ? options : [];
    const seen = new Set(local.map((o) => o.key));
    const fetched = hits
      .filter((h) => !seen.has(h.id))
      .map((h): Suggestion => ({
        key: h.id,
        label: h.name,
        hint: h.subtitle,
        group: remoteGroup,
        href: h.href ?? (remoteHrefBase ? `${remoteHrefBase}/${h.id}` : undefined),
      }));
    return [...local, ...fetched];
  }, [options, text, showOnFocus, hits, remoteGroup, remoteHrefBase]);

  const shown = open && items.length > 0;
  const index = active < items.length ? active : -1;
  const grouped = !!options?.some((o) => o.group);

  useEffect(() => {
    if (shown && index >= 0) document.getElementById(`${listId}-${index}`)?.scrollIntoView({ block: "nearest" });
  }, [shown, index, listId]);

  function change(next: string) {
    if (value === undefined) setOwn(next);
    onValueChange?.(next);
  }

  function pick(s: Suggestion) {
    setOpen(false);
    setActive(-1);
    if (onPick) {
      if (onPick(s) === false) setOpen(true);
      return;
    }
    if (s.href) return router.push(s.href);
    flushSync(() => change(s.label));
    input.current?.form?.requestSubmit();
  }

  const list = shown && (
    <ul id={listId} role="listbox" className="space-y-px">
      {items.map((s, i) => (
        <li key={s.key} role="presentation">
          {grouped && s.group && s.group !== items[i - 1]?.group && (
            <div className="px-2.5 pt-2 pb-1 text-[11px] font-medium text-subtle">{s.group}</div>
          )}
          <div
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === index}
            onMouseEnter={() => setActive(i)}
            onClick={() => pick(s)}
            className={cn("flex cursor-pointer flex-col rounded-md px-2.5 py-1.5 text-left", i === index && "bg-muted")}
          >
            <span className="truncate text-sm font-medium">{s.label}</span>
            {s.hint && <span className="line-clamp-1 text-xs text-muted-foreground">{s.hint}</span>}
          </div>
        </li>
      ))}
    </ul>
  );

  const field = (
    <Input
      {...props}
      ref={input}
      value={current}
      role="combobox"
      aria-expanded={shown}
      aria-controls={shown ? listId : undefined}
      aria-autocomplete="list"
      aria-activedescendant={shown && index >= 0 ? `${listId}-${index}` : undefined}
      autoComplete="off"
      className={cn(dropdown && "pr-9", className)}
      onChange={(e) => {
        change(e.target.value);
        setOpen(true);
        setActive(-1);
      }}
      onFocus={(e) => {
        setOpen(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setOpen(false);
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented || e.nativeEvent.isComposing) return;
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          if (!items.length) return;
          e.preventDefault();
          if (!shown) return setOpen(true);
          const step = e.key === "ArrowDown" ? 1 : -1;
          setActive(index < 0 ? (step > 0 ? 0 : items.length - 1) : (index + step + items.length) % items.length);
        } else if (e.key === "Enter" && shown && index >= 0) {
          e.preventDefault();
          pick(items[index]);
        } else if (e.key === "Escape" && shown && inline) {
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
        }
      }}
    />
  );

  return (
    <div className={cn("relative w-full min-w-0", wrapperClassName)}>
      {inline ? (
        field
      ) : (
        <Popover open={shown} onOpenChange={setOpen}>
          <PopoverAnchor asChild>{field}</PopoverAnchor>
          <PopoverContent
            align="start"
            className="max-h-72 w-(--radix-popover-trigger-width) min-w-56 gap-0 overflow-y-auto p-1"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={(e) => {
              // A click in the box itself is not "outside": it keeps typing.
              if (e.target instanceof Node && input.current?.parentElement?.contains(e.target)) e.preventDefault();
            }}
            // Keep the focus in the box while the list is clicked or scrolled.
            onMouseDown={(e) => e.preventDefault()}
          >
            {list}
          </PopoverContent>
        </Popover>
      )}
      {loading && <Loader2 className={cn("pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground", dropdown ? "right-9" : "right-3")} />}
      {dropdown && !!options?.length && (
        <button
          type="button"
          aria-label={dropdown}
          title={dropdown}
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            input.current?.focus();
            setOpen(!shown);
          }}
          className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronDown className={cn("size-4 transition-transform", shown && "rotate-180")} />
        </button>
      )}
      {inline && list && (
        <div className="mt-1.5 max-h-64 overflow-y-auto rounded-lg border bg-card p-1" onMouseDown={(e) => e.preventDefault()}>
          {list}
        </div>
      )}
    </div>
  );
}
