"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { EntityAvatar } from "./blocks";

type Option = { id: string; name: string; subtitle: string; type: "company" | "investor" };

export function FindCompany({ options }: { options: Option[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const list = q ? options.filter((o) => `${o.name} ${o.subtitle}`.toLowerCase().includes(q.toLowerCase())) : options.slice(0, 5);

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Company name or description" className="h-10 pl-9" />
      </div>
      <ul className="mt-3 max-h-72 space-y-1 overflow-auto">
        {list.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => setPicked(o.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                picked === o.id ? "border-primary bg-teal-soft/50" : "border-transparent hover:bg-muted",
              )}
            >
              <EntityAvatar name={o.name} kind={o.type} size="sm" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{o.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{o.subtitle}</span>
              </span>
            </button>
          </li>
        ))}
        {!list.length && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No match on record for “{q}”.</li>}
      </ul>
      <div className="mt-6 space-y-2">
        <Button className="h-10 w-full" disabled={!picked} onClick={() => router.push("/onboarding/you")}>
          Continue
        </Button>
        <Button variant="ghost" className="h-10 w-full" asChild>
          <Link href="/onboarding/you">
            <Plus /> My company is not listed
          </Link>
        </Button>
      </div>
    </div>
  );
}
