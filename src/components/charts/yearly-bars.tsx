"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatCompactIDR, formatIDR } from "@/lib/money";

/**
 * Total pembayaran per tahun. Seri tunggal, jadi tidak ada legenda —
 * judul kartu sudah menamainya.
 */
export function YearlyBars({
  data,
  height = 180,
}: {
  data: { year: number; total: number }[];
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="year"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <YAxis
            tickFormatter={formatCompactIDR}
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <Tooltip cursor={{ fill: "var(--accent)" }} content={<YearTooltip />} />
          <Bar
            dataKey="total"
            fill="var(--chart-1)"
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function YearTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: { year: number; total: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md">
      <p className="text-xs text-muted-foreground">Tahun {point.year}</p>
      <p className="tnum text-sm font-semibold text-popover-foreground">
        {formatIDR(point.total)}
      </p>
    </div>
  );
}
