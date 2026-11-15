"use client";

import { Banknote, CalendarDays, ChevronDown, Eye, Landmark, Loader2, StickyNote, UserRound, Users, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pill, SlushTag } from "@/components/warmline/badges";
import { EntityAvatar } from "@/components/warmline/blocks";
import { SourceChip } from "@/components/warmline/source-chip";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDay } from "@/lib/format";
import type { Alert, AlertKind, Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { WATCH_TAGS, tagLabel, watchHref, type WatchItem, type WatchTag } from "@/lib/watchlist";
import { unwatchAction, updateWatchAction } from "./actions";

const NO_TAG = "none";
const TYPE_LABEL = { company: "Company", investor: "Investor", person: "Person" } as const;
const KIND_ICON: Record<AlertKind, typeof Banknote> = {
  competitor_round: Banknote,
  funding_round: Banknote,
  portfolio_competitor: Eye,
  investor_activity: Landmark,
  slush_attendee: CalendarDays,
  team_change: Users,
  profile: UserRound,
};

type Props = {
  item: WatchItem;
  role: Role;
  /** When the nightly scan last checked this entity, formatted on the server ("today 02:00"). */
  checked: string | null;
  /** Changes Cala has on record for it, newest first. */
  changes: Alert[];
  /** ISO day: changes on or after it are marked New. */
  recentSince: string;
};

export function WatchRow({ item, role, checked, changes, recentSince }: Props) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [latest, ...earlier] = changes;
  const [note, setNote] = useState(item.note);
  const href = watchHref(item);
  const ownTags = WATCH_TAGS.filter((t) => t.roles.includes(role));
  const otherTags = WATCH_TAGS.filter((t) => !t.roles.includes(role));

  function save(patch: { tag?: WatchTag | null; note?: string }, message: string) {
    startTransition(async () => {
      const res = await updateWatchAction(item.id, patch);
      if (res.ok) toast.success(message);
      else toast.error(res.error);
    });
  }

  return (
    <li className="flex gap-4 px-5 py-4">
      <EntityAvatar name={item.name || item.calaId} kind={item.entityType} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {href ? (
            <Link href={href} className="text-sm font-medium hover:text-primary">
              {item.name || item.calaId}
            </Link>
          ) : (
            <span className="text-sm font-medium">{item.name || item.calaId}</span>
          )}
          {item.origin === "suggested" && <Pill tone="teal">Suggested</Pill>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1 text-xs text-subtle">
          <span>
            {TYPE_LABEL[item.entityType]} · Watching since {formatDay(item.createdAt)}
          </span>
          <span>·</span>
          {!item.inCala ? (
            <span title="Demo entries are not in Cala, so the nightly check skips them.">Demo entry, not checked</span>
          ) : checked ? (
            <span>Checked {checked}</span>
          ) : (
            <span>First check in progress</span>
          )}
        </div>

        {latest && (
          <ul className="mt-2 space-y-1.5">
            <Change change={latest} recent={latest.date >= recentSince} />
            {expanded && earlier.map((c) => <Change key={c.id} change={c} recent={c.date >= recentSince} />)}
          </ul>
        )}
        {earlier.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            className="mt-1 flex items-center gap-1 text-xs text-subtle hover:text-foreground"
          >
            <ChevronDown className={cn("size-3 transition-transform", expanded && "rotate-180")} />
            {expanded ? "Show less" : `${earlier.length} earlier ${earlier.length === 1 ? "change" : "changes"}`}
          </button>
        )}

        {editing ? (
          <form
            className="mt-2 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              setEditing(false);
              if (note.trim() !== item.note) save({ note: note.trim() }, "Note saved");
            }}
          >
            <Textarea
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why you're watching, who to ask for an intro…"
              className="min-h-14 bg-card text-[13px]"
              maxLength={2000}
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                Save note
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setNote(item.note);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : item.note ? (
          <button type="button" onClick={() => setEditing(true)} className="mt-1.5 block text-left text-[13px] whitespace-pre-line text-muted-foreground hover:text-foreground">
            {item.note}
          </button>
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="mt-1.5 inline-flex items-center gap-1 text-xs text-subtle hover:text-foreground">
            <StickyNote className="size-3" /> Add a note
          </button>
        )}
      </div>

      <div className="flex shrink-0 items-start gap-2">
        {pending && <Loader2 className="mt-2 size-4 animate-spin text-muted-foreground" />}
        <Select
          value={item.tag ?? NO_TAG}
          disabled={pending}
          onValueChange={(v) => {
            const tag = v === NO_TAG ? null : (v as WatchTag);
            save({ tag }, "Tag updated");
          }}
        >
          <SelectTrigger size="sm" className="w-40 bg-card" aria-label={`Tag for ${item.name}`}>
            {/* Explicit label: Radix only fills SelectValue from the items once the menu has mounted. */}
            <SelectValue>{item.tag ? tagLabel(item.tag) : "Saved (no tag)"}</SelectValue>
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value={NO_TAG}>Saved (no tag)</SelectItem>
            {ownTags.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
            <SelectSeparator />
            {otherTags.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon"
          disabled={pending}
          aria-label={`Stop watching ${item.name}`}
          title="Stop watching"
          onClick={() =>
            startTransition(async () => {
              const res = await unwatchAction(item.id);
              if (res.ok) toast.success(`Stopped watching ${item.name}`);
              else toast.error(res.error);
            })
          }
        >
          <X />
        </Button>
      </div>
    </li>
  );
}

/** One change Cala has on record: what happened, when, and its sources. */
function Change({ change: c, recent }: { change: Alert; recent: boolean }) {
  const Icon = KIND_ICON[c.kind] ?? Banknote;
  return (
    <li className="flex items-start gap-2 text-[13px]">
      <Icon className={cn("mt-0.5 size-3.5 shrink-0", recent ? "text-primary" : "text-subtle")} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <Link href={c.href} className={cn("leading-snug hover:text-primary", recent ? "font-medium" : "text-muted-foreground")}>
            {c.title}
          </Link>
          {recent && <Pill tone="teal">New</Pill>}
          {c.slush && <SlushTag label="Slush" />}
          <span className="text-xs text-subtle">{formatDay(c.date)}</span>
          <SourceChip sources={c.sources} />
        </div>
      </div>
    </li>
  );
}
