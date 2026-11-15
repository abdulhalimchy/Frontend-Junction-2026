"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CONFIRM = "delete";

const WHAT_GOES = [
  "Your account, profile, role and goals",
  "Startups you added and their analyses",
  "Pitch decks you uploaded, the PDFs included, and their checks",
  "Your portfolio, market and company analyses",
  "Your watch list and alerts",
];

/** Permanently deletes the account and everything in it, after the user types "delete". */
export function DeleteAccount() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Could not delete your account.");
      }
      toast.success("Your account and all its data were deleted.");
      router.push("/");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete your account.");
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (busy) return;
        setOpen(v);
        setTyped("");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="destructive" className="h-9">
          <Trash2 /> Delete account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription>This permanently deletes everything below. It can&apos;t be undone.</DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {WHAT_GOES.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
        <p className="text-xs text-subtle">
          Public records about your company come from Cala and stay public; deleting your account doesn&apos;t change them.
        </p>
        <form
          className="space-y-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (typed.trim().toLowerCase() === CONFIRM) void remove();
          }}
        >
          <Label htmlFor="confirm-delete">
            Type <span className="font-mono font-semibold">{CONFIRM}</span> to confirm
          </Label>
          <Input id="confirm-delete" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} disabled={busy} className="h-9" />
        </form>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="h-9" disabled={busy}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            className="h-9 bg-destructive text-white hover:bg-destructive/90"
            disabled={busy || typed.trim().toLowerCase() !== CONFIRM}
            onClick={remove}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete everything
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
