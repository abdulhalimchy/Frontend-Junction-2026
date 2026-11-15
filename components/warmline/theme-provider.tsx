"use client";

import { ThemeProvider as NextThemes } from "next-themes";

/** Light and dark, chosen with the toggle and remembered in this browser. Dark is the default. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}
