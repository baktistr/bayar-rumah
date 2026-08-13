"use client";

import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCompactIDR, formatIDR } from "@/lib/money";
import { periodLabel, periodLabelShort } from "@/lib/period";

export type ChartPoint = {
  period: string;
  actual: number | null;
  projected: number | null;
};

/**
 * Grafik penurunan saldo. Realisasi digambar sebagai area penuh, proyeksi
 * sebagai garis putus-putus dengan hue yang sama — keduanya mengukur hal
 * yang sama (sisa hutang), jadi bukan dua kategori berbeda. Pembeda utamanya
 * pola garis + legenda, bukan warna saja.
 */
export function BurndownChart({
  data,
  height = 240,
  tickCount = 5,
}: {
  data: ChartPoint[];
  height?: number;
  tickCount?: number;
}) {
  // Sumbu X pada 200+ titik akan bertumpuk kalau semua label digambar;
  // ambil beberapa titik saja yang tersebar merata.
  const ticks = useMemo(() => {
    if (data.length <= tickCount) return data.map((d) => d.period);
    const step = (data.length - 1) / (tickCount - 1);
    return Array.from(
      new Set(
        Array.from({ length: tickCount }, (_, i) => data[Math.round(i * step)]?.period),
      ),
    ).filter(Boolean) as string[];
  }, [data, tickCount]);

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="fillActual" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis
            dataKey="period"
            ticks={ticks}
            tickFormatter={periodLabelShort}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            minTickGap={8}
          />
          <YAxis
            tickFormatter={formatCompactIDR}
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
            content={<BurndownTooltip />}
          />

          <Area
            type="monotone"
            dataKey="actual"
            name="Realisasi"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#fillActual)"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="projected"
            name="Proyeksi"
            stroke="var(--chart-2)"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

type TooltipPayload = {
  payload?: ChartPoint;
};

function BurndownTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  const value = point.actual ?? point.projected;
  if (value === null || value === undefined) return null;
  const isProjected = point.actual === null;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md">
      <p className="text-xs text-muted-foreground">{periodLabel(point.period)}</p>
      <p className="tnum text-sm font-semibold text-popover-foreground">
        {formatIDR(value)}
      </p>
      <p className="text-[0.7rem] text-muted-foreground">
        {isProjected ? "proyeksi" : "realisasi"}
      </p>
    </div>
  );
}

/** Legenda dibuat manual supaya bisa memakai token teks, bukan warna seri. */
export function BurndownLegend() {
  return (
    <div className="flex items-center justify-center gap-5 text-xs text-muted-foreground">
      <span className="flex items-center gap-2">
        <span
          className="inline-block h-0.5 w-5 rounded"
          style={{ background: "var(--chart-1)" }}
        />
        Realisasi
      </span>
      <span className="flex items-center gap-2">
        <span
          className="inline-block h-0.5 w-5 rounded"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to right, var(--chart-2) 0 5px, transparent 5px 9px)",
          }}
        />
        Proyeksi
      </span>
    </div>
  );
}
