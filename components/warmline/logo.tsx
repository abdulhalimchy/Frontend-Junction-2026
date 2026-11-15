import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/home" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2", className)}>
      <span className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-brand to-brand-2 shadow-[0_0_18px_-4px_var(--brand)]">
        <svg viewBox="0 0 64 64" className="size-7" fill="none" aria-hidden>
          <path d="M15 22 24.5 43 32 27.5 39.5 43 49 22" stroke="var(--brand-ink)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="15" cy="22" r="5" fill="var(--brand-ink)" />
          <circle cx="49" cy="22" r="5.25" fill="#fff6ea" stroke="var(--brand-ink)" strokeWidth="3" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight">Warmline</span>
    </Link>
  );
}
