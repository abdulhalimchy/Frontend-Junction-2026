"use client";

import { MoreHorizontal, Pencil, Plus, Rocket, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { startupHref } from "@/lib/startup-cookie";
import type { StartupSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AddStartupDialog, DeleteStartupDialog, RenameStartupDialog, setActiveStartup } from "./startup-dialogs";

const TABS = ["overview", "competitors", "investors", "connect", "deck"] as const;

/**
 * "My startup" in the sidebar: the founder's startups, a + to add one, and a menu (or right-click) per startup.
 * `activeId` is the startup shown now (from the URL on My startup pages); each one links to its own URL, so
 * one startup's pages are never served for another.
 */
export function StartupNav({
  startups,
  activeId,
  onChoose,
  loadError,
}: {
  startups: StartupSummary[];
  activeId: string;
  onChoose: (id: string) => void;
  loadError?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const onStartup = pathname.startsWith("/startup");
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<StartupSummary | null>(null);
  const [deleting, setDeleting] = useState<StartupSummary | null>(null);
  // Switching startups keeps the tab you are on.
  const tab = TABS.find((t) => pathname === `/startup/${t}`) ?? "overview";

  function open(id: string) {
    setActiveStartup(id);
    onChoose(id);
    router.push(startupHref(id, tab));
  }

  return (
    <div>
      <div
        className={cn(
          "group flex h-8 items-center rounded-lg pr-1 text-[13px] font-medium transition-colors",
          onStartup ? "bg-brand-soft text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Link href={startupHref(activeId)} className="flex h-full flex-1 items-center gap-2.5 px-2">
          <Rocket className="size-4" />
          <span className="flex-1">My startup</span>
        </Link>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setAdding(true)}
              aria-label="Add a startup"
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
            >
              <Plus className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Add a startup</TooltipContent>
        </Tooltip>
      </div>

      <ul className="mt-0.5 ml-[17px] max-h-48 space-y-px overflow-y-auto border-l pl-2">
        {startups.map((s) => {
          const active = s.id === activeId;
          return (
            <li key={s.id}>
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <div
                    className={cn(
                      "group/item flex h-7 items-center rounded-md pr-0.5 text-[12.5px] transition-colors data-[state=open]:bg-muted",
                      active && onStartup ? "font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      active && "bg-muted/70",
                    )}
                  >
                    <button type="button" onClick={() => open(s.id)} className="flex h-full min-w-0 flex-1 items-center gap-1.5 px-2 text-left">
                      <span className={cn("size-1.5 shrink-0 rounded-full", active ? "bg-primary" : "bg-border")} />
                      <span className="truncate">{s.name}</span>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Options for ${s.name}`}
                          className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 group-hover/item:opacity-100 hover:bg-card hover:text-foreground focus-visible:opacity-100 data-[state=open]:opacity-100"
                        >
                          <MoreHorizontal className="size-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" side="right" className="w-44">
                        <MenuItems
                          startup={s}
                          ui={{ Item: DropdownMenuItem, Label: DropdownMenuLabel, Separator: DropdownMenuSeparator }}
                          onOpen={() => open(s.id)}
                          onRename={() => setRenaming(s)}
                          onDelete={() => setDeleting(s)}
                        />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-44">
                  <MenuItems
                    startup={s}
                    ui={{ Item: ContextMenuItem, Label: ContextMenuLabel, Separator: ContextMenuSeparator }}
                    onOpen={() => open(s.id)}
                    onRename={() => setRenaming(s)}
                    onDelete={() => setDeleting(s)}
                  />
                </ContextMenuContent>
              </ContextMenu>
            </li>
          );
        })}
        {loadError && (
          <li className="px-2 py-1 text-[11px] text-subtle" title={loadError}>
            Couldn&apos;t load your startups.
          </li>
        )}
      </ul>

      <AddStartupDialog open={adding} onOpenChange={setAdding} />
      <RenameStartupDialog startup={renaming} open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)} />
      <DeleteStartupDialog
        startup={deleting}
        active={deleting?.id === activeId}
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
      />
    </div>
  );
}

type MenuUI = {
  Item: typeof DropdownMenuItem | typeof ContextMenuItem;
  Label: typeof DropdownMenuLabel | typeof ContextMenuLabel;
  Separator: typeof DropdownMenuSeparator | typeof ContextMenuSeparator;
};

/** The same options for the "…" button and for right-click. */
function MenuItems({
  startup: s,
  ui: { Item, Label, Separator },
  onOpen,
  onRename,
  onDelete,
}: {
  startup: StartupSummary;
  ui: MenuUI;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <Label className="truncate text-xs text-muted-foreground">{s.name}</Label>
      <Item onSelect={onOpen}>
        <Rocket /> Open
      </Item>
      <Item onSelect={onRename}>
        <Pencil /> Rename
      </Item>
      <Separator />
      <Item variant="destructive" onSelect={onDelete}>
        <Trash2 /> Delete
      </Item>
    </>
  );
}
