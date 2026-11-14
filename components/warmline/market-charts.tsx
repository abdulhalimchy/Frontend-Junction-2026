"use client";

import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BarDatum, YearDatum } from "@/lib/market-report";

// Charts for the market report. Colors validated (dataviz validator, light surface): equity / main series
// #00968f, grants #c0782f; forecast is a lighter step of the main hue. Values in tooltips use text ink.

const MAIN = "#00968f";
const SECOND = "#c0782f";
const FORECAST = "#8fd0cb";
const AXIS = { fontSize: 12, fill: "var(--muted-foreground)" };
const TOOLTIP = { borderRadius: 10, border: "1px solid var(--border)", fontSize: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.06)", color: "var(--foreground)" };

function compact(n: number) {
  const a = Math.abs(n);
  const t = (x: number) => (x >= 100 ? x.toFixed(0) : x.toFixed(1).replace(/\.0$/, ""));
  return a >= 1e12 ? `${t(n / 1e12)}T` : a >= 1e9 ? `${t(n / 1e9)}B` : a >= 1e6 ? `${t(n / 1e6)}M` : a >= 1e3 ? `${t(n / 1e3)}k` : `${n}`;
}

/**
 * Ranked horizontal bars as HTML (names stay readable and clickable; no axis needed): one series, one hue,
 * the value written at the end of each bar.
 */
export function BarList({ data, emptyText }: { data: BarDatum[]; emptyText: string }) {
  if (!data.length) return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
  const max = Math.max(...data.map((d) => d.value));
  return (
    <ul className="space-y-2">
      {data.map((d) => {
        const label = d.href ? (
          <Link href={d.href} className="truncate hover:text-primary hover:underline">
            {d.label}
          </Link>
        ) : (
          <span className="truncate">{d.label}</span>
        );
        return (
          <li key={d.label} className="group text-[13px]" title={d.note ? `${d.label}: ${d.note}` : undefined}>
            <div className="flex items-baseline justify-between gap-3">
              {label}
              <span className="tabular shrink-0 whitespace-nowrap text-muted-foreground">{d.display}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-muted/50">
              <div className="h-full rounded-full transition-opacity group-hover:opacity-80" style={{ width: `${Math.max(3, (d.value / max) * 100)}%`, background: MAIN }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Equity and grants per year as two separate series (grouped, never stacked into one total). */
export function FundingByYearChart({ data, currency }: { data: YearDatum[]; currency: string }) {
  const grants = data.some((d) => d.grants > 0);
  return (
    <div className="h-60">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={2} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="year" tickLine={false} axisLine={false} tick={AXIS} />
          <YAxis tickLine={false} axisLine={false} tick={AXIS} width={48} tickFormatter={(v) => compact(Number(v))} />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            contentStyle={TOOLTIP}
            formatter={(v, name) => [`${currency} ${compact(Number(v))}`, name === "equity" ? "Equity raised" : "Grants"]}
            labelFormatter={(y, p) => `${y} · ${p?.[0]?.payload?.rounds ?? 0} rounds with an amount`}
          />
          {grants && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span className="text-muted-foreground">{v === "equity" ? "Equity" : "Grants (kept separate)"}</span>} />}
          <Bar dataKey="equity" fill={MAIN} radius={[4, 4, 0, 0]} maxBarSize={28} />
          {grants && <Bar dataKey="grants" fill={SECOND} radius={[4, 4, 0, 0]} maxBarSize={28} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** One publisher's market-size figures by year: reported values solid, forecasts lighter. */
export function MarketSizeChart({ data, currency }: { data: { year: number; value: number; forecast: boolean }[]; currency: string }) {
  return (
    <div className="h-60">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="year" tickLine={false} axisLine={false} tick={AXIS} />
          <YAxis tickLine={false} axisLine={false} tick={AXIS} width={48} tickFormatter={(v) => compact(Number(v))} />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            contentStyle={TOOLTIP}
            formatter={(v, _n, p) => [`${currency} ${compact(Number(v))}`, p?.payload?.forecast ? "Forecast" : "Reported"]}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={44} label={{ position: "top", fontSize: 11, fill: "var(--muted-foreground)", formatter: (v: unknown) => compact(Number(v)) }}>
            {data.map((d) => (
              <Cell key={d.year} fill={d.forecast ? FORECAST : MAIN} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SizeLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full" style={{ background: MAIN }} /> Reported
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full" style={{ background: FORECAST }} /> Forecast
      </span>
    </div>
  );
}
