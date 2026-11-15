import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/home" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2", className)}>
      <span className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-brand to-brand-2 shadow-[0_0_18px_-4px_var(--brand)]">
        <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
          <path d="M2 12c2.2 0 2.2-4 4.4-4s2.2 4 4.4 4 2.2-4 4.4-4S17.4 12 19 12" stroke="var(--brand-ink)" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight">Warmline</span>
    </Link>
  );
}
