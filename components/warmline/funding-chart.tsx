"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Datum = { year: number; equity: number; grants: number; rounds: number };

/** Equity and grants as two separate series (grouped, never stacked into one total). Values in millions. */
export function FundingChart({ data, currency }: { data: Datum[]; currency: string }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={2} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            tickFormatter={(v) => `${v}M`}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", fontSize: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}
            formatter={(v, name) => [`${currency} ${v}M`, name === "equity" ? "Equity" : "Grants"]}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12 }}
            formatter={(v) => <span className="text-muted-foreground">{v === "equity" ? "Equity" : "Grants (separate)"}</span>}
          />
          <Bar dataKey="equity" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="grants" fill="var(--chart-4)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
