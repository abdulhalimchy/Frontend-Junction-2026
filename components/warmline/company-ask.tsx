"use client";

import { ArrowUp, CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Markdown } from "@/components/warmline/markdown";
import type { AskAnswer, AskSource } from "@/app/api/company-ask/route";
import { cn } from "@/lib/utils";

// "Ask about <company>": a card in the brief's right column opens a drawer where questions are answered by
// Cala's knowledge search, each answer with its numbered sources. Answers take up to a minute.

const SUGGESTED = ["Who led their last round?", "Who are their competitors?", "What changed in the last 6 months?"];
const CARD_TOPICS = ["Cap table breakdown", "Key customers", "Product and technology"];

type Turn = { id: number; question: string; status: "pending" | "done" | "error"; answer?: string; sources?: AskSource[]; error?: string };

export function CompanyAsk({ companyId, companyName }: { companyId: string; companyName: string }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const nextId = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);
  const busy = turns.some((t) => t.status === "pending");

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  async function ask(raw: string) {
    const question = raw.trim();
    if (!question || busy) return;
    setOpen(true);
    setDraft("");
    const id = nextId.current++;
    setTurns((t) => [...t, { id, question, status: "pending" }]);
    let patch: Partial<Turn>;
    try {
      const res = await fetch("/api/company-ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, question }),
      });
      const data = (await res.json()) as AskAnswer | { error: string };
      patch = "error" in data ? { status: "error", error: data.error } : { status: "done", answer: data.answer, sources: data.sources };
    } catch {
      patch = { status: "error", error: "Could not reach the server. Try again." };
    }
    setTurns((t) => t.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  return (
    <>
      <div className="rounded-2xl border bg-card p-5 shadow-panel">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[15px] font-semibold">Ask about {companyName}</span>
          <AiTag />
        </div>
        <AskInput
          value={draft}
          onChange={setDraft}
          onSubmit={() => ask(draft)}
          disabled={busy}
          placeholder="Ask anything about their funding, customers, product or team…"
          multiline
        />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {CARD_TOPICS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={busy}
              onClick={() => ask(q)}
              className="h-6 rounded-full bg-muted px-2.5 text-xs text-muted-foreground transition-colors hover:bg-brand-soft hover:text-accent-foreground disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" showCloseButton className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[640px]">
          <SheetHeader className="border-b px-8 pt-7 pb-5">
            <SheetTitle className="flex items-center gap-2 pr-10 text-xl font-semibold tracking-tight">
              Ask about {companyName} <AiTag />
            </SheetTitle>
            <SheetDescription>Instant verification &amp; intelligence dossier</SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-8 py-7">
            <div className="text-xs font-medium tracking-[0.08em] uppercase">Suggested questions</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTED.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={busy}
                  onClick={() => ask(q)}
                  className="rounded-full border bg-background px-4 py-2 text-sm transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>

            <div className="mt-7 space-y-7">
              {turns.map((t) => (
                <TurnView key={t.id} turn={t} />
              ))}
            </div>
            <div ref={endRef} />
          </div>

          <div className="border-t px-5 py-5">
            <AskInput value={draft} onChange={setDraft} onSubmit={() => ask(draft)} disabled={busy} placeholder="Ask anything about this company" autoFocus />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function TurnView({ turn }: { turn: Turn }) {
  return (
    <section>
      <div className="flex items-center gap-2 text-xs font-medium tracking-[0.08em] uppercase">
        {turn.status === "pending" ? (
          <Loader2 className="size-4 animate-spin text-primary" />
        ) : turn.status === "error" ? (
          <CircleAlert className="size-4 text-destructive" />
        ) : (
          <CircleCheck className="size-4 text-primary" />
        )}
        <span>Question: {turn.question}</span>
      </div>
      <div className="mt-3 rounded-xl border bg-card px-5 py-4">
        {turn.status === "pending" && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Checking sources… this can take up to a minute.</div>
            <div className="h-3 w-11/12 animate-pulse rounded bg-muted" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        )}
        {turn.status === "error" && <p className="text-sm text-destructive">{turn.error}</p>}
        {turn.status === "done" && (
          <>
            <Markdown link={(href) => citation(href, turn.sources ?? [])}>{turn.answer || "No answer on record."}</Markdown>
            <div className="mt-4 border-t pt-3 font-mono text-xs">
              {turn.sources?.length ? (
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span>Sources:</span>
                  {turn.sources.map((s, i) => (
                    <span key={s.url} className="inline-flex items-baseline gap-2">
                      {i > 0 && <span className="text-subtle">·</span>}
                      <a href={s.url} target="_blank" rel="noreferrer" title={s.url} className="max-w-56 truncate underline underline-offset-2 hover:text-primary">
                        {i + 1}. {s.name}
                      </a>
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">No sources returned. Treat this answer as unverified.</span>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/** "[n](#cite-n)" markers from the server become a small numbered chip linking to source n. */
function citation(href: string | undefined, sources: AskSource[]) {
  const n = Number(href?.match(/^#cite-(\d+)$/)?.[1]);
  const s = sources[n - 1];
  if (!s) return undefined;
  return (
    <a
      href={s.url}
      target="_blank"
      rel="noreferrer"
      title={`${n}. ${s.name}`}
      aria-label={`Source ${n}: ${s.name}`}
      className="relative -top-px ml-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded bg-muted px-1 align-middle font-mono text-[11px] leading-none font-medium text-muted-foreground no-underline transition-colors hover:bg-brand-soft hover:text-accent-foreground"
    >
      {n}
    </a>
  );
}

function AskInput({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
  multiline,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  placeholder: string;
  multiline?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className={cn("flex gap-2 rounded-xl border bg-muted/40 p-2 pl-4 focus-within:border-primary/40", multiline ? "items-end" : "items-center")}
    >
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
        }}
        rows={multiline ? 3 : 1}
        maxLength={300}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 resize-none bg-transparent py-1.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        aria-label="Ask"
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
      >
        <ArrowUp className="size-4" />
      </button>
    </form>
  );
}

function AiTag() {
  return <span className="inline-flex h-6 items-center rounded-full bg-brand-soft px-2.5 font-mono text-xs font-semibold text-accent-foreground">Warmline AI</span>;
}
