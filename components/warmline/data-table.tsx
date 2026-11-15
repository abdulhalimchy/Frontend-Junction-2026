"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type Column = { key: string; label: string; align?: "left" | "right"; sortable?: boolean; width?: string };
export type Cell = { display: React.ReactNode; sort?: string | number | null };
export type Row = { id: string; href?: string; cells: Record<string, Cell> };

/**
 * Sortable table. Cells are pre-rendered on the server (display) with an optional sort key,
 * so server pages can pass rich content without passing functions to the client.
 */
export function DataTable({
  columns,
  rows,
  initialSort,
  empty,
}: {
  columns: Column[];
  rows: Row[];
  initialSort?: { key: string; dir: "asc" | "desc" };
  empty?: React.ReactNode;
}) {
  const router = useRouter();
  const [sort, setSort] = useState(initialSort ?? null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const av = a.cells[sort.key]?.sort;
      const bv = b.cells[sort.key]?.sort;
      // Missing values (e.g. no funding on record) always sink to the bottom.
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [rows, sort]);

  function toggle(key: string) {
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  }

  if (!rows.length && empty) return <>{empty}</>;

  // On phones the table scrolls sideways with its first column pinned and narrow, so the other columns stay in view.
  const pinHead = "max-sm:sticky max-sm:left-0 max-sm:z-10 max-sm:w-40! max-sm:max-w-40 max-sm:bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))]";
  const pinCell = "max-sm:sticky max-sm:left-0 max-sm:z-10 max-sm:w-40! max-sm:max-w-40 max-sm:overflow-hidden max-sm:bg-card max-sm:shadow-[6px_0_8px_-8px_rgb(0_0_0/0.45)]";

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm max-sm:min-w-[36rem]">
        <thead className="bg-muted/50">
          <tr>
            {columns.map((c, i) => {
              const active = sort?.key === c.key;
              const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
              return (
                <th
                  key={c.key}
                  style={{ width: c.width }}
                  className={cn("h-9 px-3 text-xs font-medium text-muted-foreground", c.align === "right" ? "text-right" : "text-left", i === 0 && pinHead)}
                >
                  {c.sortable === false ? (
                    c.label
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggle(c.key)}
                      className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground")}
                    >
                      {c.label}
                      <Icon className={cn("size-3", !active && "opacity-40")} />
                    </button>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map((r) => (
            <tr
              key={r.id}
              onClick={r.href ? () => router.push(r.href!) : undefined}
              className={cn("bg-card", r.href && "cursor-pointer transition-colors hover:bg-muted/40")}
            >
              {columns.map((c, i) => (
                <td key={c.key} className={cn("px-3 py-2.5 align-middle", c.align === "right" && "text-right tabular", i === 0 && pinCell)}>
                  {r.cells[c.key]?.display ?? <span className="text-subtle">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
