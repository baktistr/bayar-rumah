"use client";

import { useMemo, useState } from "react";
import { TrendingDownIcon } from "lucide-react";

import { BurndownChart, BurndownLegend } from "@/components/charts/burndown-chart";
import { MoneyInput } from "@/components/money-input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { formatIDR, formatNumber } from "@/lib/money";
import { compareScenarios, projectPayoff } from "@/lib/projection";

const MIN = 1_000_000;
const MAX = 25_000_000;
const STEP = 500_000;

/**
 * Simulator jalannya di browser: projectPayoff adalah fungsi murni, jadi
 * menggeser slider tidak perlu bolak-balik ke server.
 */
export function PayoffSimulator({
  remaining,
  startPeriod,
  baseMonthly,
}: {
  remaining: number;
  startPeriod: string;
  baseMonthly: number;
}) {
  const [monthly, setMonthly] = useState(baseMonthly);
  const [extra, setExtra] = useState(0);
  const [extraPeriod, setExtraPeriod] = useState(startPeriod);

  const base = useMemo(
    () => projectPayoff({ remaining, monthly: baseMonthly, startPeriod }),
    [remaining, baseMonthly, startPeriod],
  );

  const scenario = useMemo(
    () =>
      projectPayoff({
        remaining,
        monthly,
        startPeriod,
        extras: extra > 0 ? [{ period: extraPeriod, amount: extra }] : [],
      }),
    [remaining, monthly, startPeriod, extra, extraPeriod],
  );

  const diff = compareScenarios(base, scenario);
  const changed = monthly !== baseMonthly || extra > 0;

  const chartData = useMemo(
    () =>
      scenario.schedule.map((point) => ({
        period: point.period,
        actual: null,
        projected: point.balance,
      })),
    [scenario],
  );

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 py-1">
        <div>
          <p className="text-sm font-semibold">Simulasi</p>
          <p className="text-xs text-muted-foreground">
            Geser untuk melihat pengaruhnya ke tanggal lunas.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="monthly">Cicilan per bulan</Label>
            <span className="tnum text-base font-semibold">{formatIDR(monthly)}</span>
          </div>
          <Slider
            id="monthly"
            min={MIN}
            max={MAX}
            step={STEP}
            value={[monthly]}
            onValueChange={(value) =>
              setMonthly(Array.isArray(value) ? value[0] : value)
            }
            className="py-2"
          />
          <div className="tnum flex justify-between text-[0.7rem] text-muted-foreground">
            <span>{formatNumber(MIN / 1_000_000)} jt</span>
            <span>{formatNumber(MAX / 1_000_000)} jt</span>
          </div>
        </div>

        <div className="rounded-xl bg-muted p-4">
          <p className="text-xs text-muted-foreground">Perkiraan lunas</p>
          <p className="mt-1 text-2xl font-bold leading-none">
            {scenario.payoffLabel}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {scenario.durationLabel} lagi
          </p>
          {changed && diff && diff.fasterMonths !== 0 ? (
            <p
              className={`mt-3 flex items-center gap-1.5 text-sm font-medium ${
                diff.fasterMonths > 0 ? "text-[var(--chart-1)]" : "text-[var(--chart-3)]"
              }`}
            >
              <TrendingDownIcon className="size-4" />
              {diff.label}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="extra">Pembayaran tambahan sekali (opsional)</Label>
            <MoneyInput
              id="extra"
              chips={[50_000_000, 100_000_000]}
              onValueChange={setExtra}
            />
          </div>

          {extra > 0 ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="extraPeriod">Dibayar pada bulan</Label>
              <input
                id="extraPeriod"
                type="month"
                value={extraPeriod}
                min={startPeriod}
                onChange={(e) => setExtraPeriod(e.target.value)}
                className="tap h-12 rounded-lg border border-input bg-background px-3 text-sm"
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="text-sm font-medium">Grafik skenario ini</p>
          <BurndownChart data={chartData} height={200} tickCount={4} />
          <BurndownLegend />
        </div>
      </CardContent>
    </Card>
  );
}
