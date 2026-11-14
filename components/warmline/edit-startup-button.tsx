"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Startup } from "@/lib/types";
import { EditStartupDialog } from "./startup-dialogs";

export function EditStartupButton({ startup }: { startup: Startup }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" className="bg-card" onClick={() => setOpen(true)}>
        <Pencil /> Edit details
      </Button>
      <EditStartupDialog startup={startup} open={open} onOpenChange={setOpen} />
    </>
  );
}
