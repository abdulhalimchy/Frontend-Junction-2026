import { CodeXml } from "lucide-react";
import { REPOS, REPOS_PUBLIC } from "@/lib/project";
import { cn } from "@/lib/utils";

/** "Source code: Frontend · Backend". Renders nothing until REPOS_PUBLIC is true (lib/project.ts). */
export function SourceLinks({ className }: { className?: string }) {
  if (!REPOS_PUBLIC) return null;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      <CodeXml className="size-3.5" aria-hidden />
      <span>Source code:</span>
      {REPOS.map((r, i) => (
        <span key={r.url} className="inline-flex items-center gap-2">
          {i > 0 && <span aria-hidden>·</span>}
          <a href={r.url} target="_blank" rel="noreferrer" className="font-medium text-foreground underline-offset-4 hover:underline">
            {r.label}
          </a>
        </span>
      ))}
    </span>
  );
}
