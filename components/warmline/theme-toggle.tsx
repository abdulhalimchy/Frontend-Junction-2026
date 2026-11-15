"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/** Switches between light and dark. The icon is picked in CSS, so it is right before the page hydrates. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      aria-label="Switch between light and dark theme"
      title="Switch theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={cn(
        "group flex size-9 shrink-0 items-center justify-center rounded-lg border bg-card/80 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground",
        className,
      )}
    >
      <Sun className="hidden size-4 transition-transform duration-300 group-hover:rotate-45 dark:block" />
      <Moon className="size-4 transition-transform duration-300 group-hover:-rotate-12 dark:hidden" />
    </button>
  );
}
