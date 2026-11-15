"use client";

import { Bookmark, BookmarkCheck, ChevronDown, ListChecks, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { unwatchAction, updateWatchAction, watchAction } from "@/app/(app)/watchlist/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Role } from "@/lib/types";
import { WATCH_TAGS, tagLabel, type WatchEntityType, type WatchItem, type WatchTag } from "@/lib/watchlist";
import { cn } from "@/lib/utils";

type Props = {
  entityType: WatchEntityType;
  calaId: string;
  name: string;
  role: Role;
  initial: WatchItem | null;
  /** Set when the backend could not be reached; the button explains instead of failing on click. */
  unavailable?: string;
  size?: "sm" | "default";
  className?: string;
};

const NO_TAG = "none";

/** Watch / Watching button. Watching opens a menu to tag the entity or stop watching it. */
export function WatchToggle({ entityType, calaId, name, role, initial, unavailable, size = "default", className }: Props) {
  const [item, setItem] = useState(initial);
  const [pending, startTransition] = useTransition();
  // The role's own tags first, then the rest.
  const tags = [...WATCH_TAGS.filter((t) => t.roles.includes(role)), ...WATCH_TAGS.filter((t) => !t.roles.includes(role))];

  function mutate(fn: () => ReturnType<typeof watchAction>, done: (next: WatchItem | null) => string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setItem(res.item);
      toast.success(done(res.item));
    });
  }

  if (unavailable) {
    return (
      <Button variant="outline" size={size} className={cn("bg-card", className)} disabled title={unavailable}>
        <Bookmark /> Watch
      </Button>
    );
  }

  if (!item) {
    return (
      <Button
        variant="outline"
        size={size}
        className={cn("bg-card", className)}
        disabled={pending}
        onClick={() =>
          mutate(
            () => watchAction({ entityType, calaId, name }),
            (next) => (next?.inCala === false ? `Watching ${name}` : `Watching ${name}. Cala checks it now and every night; changes show up on your watch list.`),
          )
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <Bookmark />} Watch
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} className={cn("border-primary/40 bg-teal-soft text-accent-foreground hover:bg-teal-soft/70", className)} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <BookmarkCheck />}
          Watching{item.tag && <span className="font-normal text-accent-foreground/75">· {tagLabel(item.tag)}</span>}
          <ChevronDown className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Tag</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={item.tag ?? NO_TAG}
          onValueChange={(v) => {
            const tag = v === NO_TAG ? null : (v as WatchTag);
            if (tag !== item.tag) mutate(() => updateWatchAction(item.id, { tag }), () => `Tagged as ${tagLabel(tag)}`);
          }}
        >
          <DropdownMenuRadioItem value={NO_TAG}>Saved (no tag)</DropdownMenuRadioItem>
          {tags.map((t) => (
            <DropdownMenuRadioItem key={t.value} value={t.value}>
              {t.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/watchlist">
            <ListChecks /> Open watch list
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={() => mutate(() => unwatchAction(item.id), () => `Stopped watching ${name}`)}>
          <X /> Stop watching
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
