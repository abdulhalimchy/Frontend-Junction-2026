"use client";

import { Menu } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/** Phones and small tablets: the sidebar in a drawer behind a menu button. Closes when the page changes. */
export function MobileNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const url = `${usePathname()}?${useSearchParams()}`;
  const [lastUrl, setLastUrl] = useState(url);
  if (url !== lastUrl) {
    setLastUrl(url);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open menu"
        className="-ml-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-64 gap-0 bg-background p-0 sm:max-w-64">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
}
