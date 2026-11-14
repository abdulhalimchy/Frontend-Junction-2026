"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AddStartupDialog } from "./startup-dialogs";

/** Opens the same add-a-startup dialog as the + next to "My startup" in the sidebar. */
export function AddStartupButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> Add your startup
      </Button>
      <AddStartupDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
