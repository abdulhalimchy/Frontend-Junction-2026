import Link from "next/link";
import { Logo } from "@/components/warmline/logo";
import { SourceLinks } from "@/components/warmline/source-links";
import { ThemeToggle } from "@/components/warmline/theme-toggle";
import { LEGAL_UPDATED } from "@/lib/legal";

// Public pages (no sign-in needed): the privacy and terms pages.
export default function LegalLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-[760px] items-center gap-4 px-5 sm:px-8">
          <Logo href="/" />
          <nav className="ml-auto flex items-center gap-4 text-[13px] font-medium text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <ThemeToggle className="size-8 border-transparent bg-transparent" />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[760px] flex-1 px-5 py-12 sm:px-8 sm:py-16">
        {children}
        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t pt-6 text-[13px] text-subtle">
          <span>Last updated {LEGAL_UPDATED}.</span>
          <SourceLinks />
        </div>
      </main>
    </div>
  );
}
