"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Datum = { period: string; revenue?: number; ebitda?: number };

/** Annual revenue and EBITDA from filings, as two grouped series. Values are in the reporting currency's units. */
export function FinancialsChart({ data, currency }: { data: Datum[]; currency: string }) {
  const hasEbitda = data.some((d) => d.ebitda !== undefined);
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={2} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
          <YAxis tickLine={false} axisLine={false} width={56} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} tickFormatter={(v: number) => compact(v)} />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", fontSize: 12, background: "var(--popover)", color: "var(--foreground)", boxShadow: "var(--lift-shadow)" }}
            itemStyle={{ color: "var(--foreground)" }}
            formatter={(v, name) => [`${currency} ${compact(Number(v))}`, name === "revenue" ? "Revenue" : "EBITDA"]}
          />
          {hasEbitda && (
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12 }}
              formatter={(v) => <span className="text-muted-foreground">{v === "revenue" ? "Revenue" : "EBITDA"}</span>}
            />
          )}
          <Bar dataKey="revenue" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          {hasEbitda && <Bar dataKey="ebitda" fill="var(--chart-4)" radius={[4, 4, 0, 0]} maxBarSize={28} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function compact(n: number) {
  const a = Math.abs(n);
  const s = a >= 1e9 ? `${trim(a / 1e9)}B` : a >= 1e6 ? `${trim(a / 1e6)}M` : a >= 1e3 ? `${trim(a / 1e3)}k` : `${a}`;
  return n < 0 ? `−${s}` : s;
}

function trim(n: number) {
  return n >= 100 ? n.toFixed(0) : n.toFixed(1).replace(/\.0$/, "");
}
