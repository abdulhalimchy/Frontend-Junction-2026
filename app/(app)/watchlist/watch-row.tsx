"use client";

import { Bell, Loader2, StickyNote, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pill } from "@/components/warmline/badges";
import { EntityAvatar } from "@/components/warmline/blocks";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDay } from "@/lib/format";
import type { Role } from "@/lib/types";
import { WATCH_TAGS, alertsHref, tagLabel, watchHref, type WatchItem, type WatchTag } from "@/lib/watchlist";
import { unwatchAction, updateWatchAction } from "./actions";

const NO_TAG = "none";
const TYPE_LABEL = { company: "Company", investor: "Investor", person: "Person" } as const;

/** `checked`: when the alert scan last checked this entity, formatted on the server ("today 02:00"). */
export function WatchRow({ item, role, checked }: { item: WatchItem; role: Role; checked: string | null }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
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
          {item.unreadAlerts > 0 && (
            <Link
              href={alertsHref(item)}
              className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Bell className="size-3" />
              {item.unreadAlerts} new {item.unreadAlerts === 1 ? "alert" : "alerts"}
            </Link>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1 text-xs text-subtle">
          <span>
            {TYPE_LABEL[item.entityType]} · Watching since {formatDay(item.createdAt)}
          </span>
          <span>·</span>
          {!item.inCala ? (
            <span title="Demo entries are not in Cala, so the nightly check skips them.">Demo entry, no alerts</span>
          ) : checked ? (
            <>
              <span>Checked {checked}</span>
              <span>·</span>
              <Link href={alertsHref(item)} className="hover:text-primary">
                Alerts
              </Link>
            </>
          ) : (
            <span>First check in progress</span>
          )}
        </div>

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
