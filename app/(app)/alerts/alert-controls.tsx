"use client";

import { CheckCheck, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markAllReadAction, markReadAction, scanAction } from "./actions";

export function ScanButton({ variant = "default" }: { variant?: "default" | "outline" }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant={variant}
      className={variant === "outline" ? "bg-card" : undefined}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await scanAction();
          if (!res.ok) return void toast.error(res.error);
          const { entities, alerts_created, skipped, errors } = res.result;
          const failed = Object.keys(errors).length;
          if (!entities && !failed)
            return void toast.info(skipped ? "Only demo entities are watched. Watch a live company to get alerts." : "Watch a company or investor first.");
          toast.success(
            `Checked ${entities} ${entities === 1 ? "entity" : "entities"}: ${alerts_created ? `${alerts_created} new ${alerts_created === 1 ? "alert" : "alerts"}` : "nothing new"}.`,
            failed ? { description: `${failed} could not be checked; try again later.` } : undefined,
          );
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      {pending ? "Checking for changes…" : "Check for changes"}
    </Button>
  );
}

export function MarkAllReadButton({ disabled }: { disabled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      className="bg-card"
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          const res = await markAllReadAction();
          if (!res.ok) toast.error(res.error);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <CheckCheck />} Mark all as read
    </Button>
  );
}

/** A link that also marks its alert read. Navigation never waits for the flag. */
export function AlertLink({ id, read, href, children, className }: { id: string; read: boolean; href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={className} onClick={() => !read && void markReadAction(id)}>
      {children}
    </Link>
  );
}
