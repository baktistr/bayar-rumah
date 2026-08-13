import { BurndownChart, BurndownLegend } from "@/components/charts/burndown-chart";
import { YearlyBars } from "@/components/charts/yearly-bars";
import { PayoffSimulator } from "@/components/payoff-simulator";
import { Card, CardContent } from "@/components/ui/card";
import { getBurndown, getSummary, getYearlyTotals } from "@/lib/ledger";
import { formatIDR } from "@/lib/money";
import { periodLabel } from "@/lib/period";

export default async function ProyeksiPage() {
  const [summary, burndown, yearly] = await Promise.all([
    getSummary(),
    getBurndown(),
    getYearlyTotals(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold">Proyeksi</h1>

      <Card>
        <CardContent className="flex flex-col gap-3 py-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">
                Dengan cicilan {formatIDR(summary.monthlyTarget)}/bulan
              </p>
              <p className="mt-1 text-xl font-bold leading-tight">
                Lunas {burndown.projection.payoffLabel}
              </p>
              <p className="text-sm text-muted-foreground">
                {burndown.projection.durationLabel} lagi
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Sisa</p>
              <p className="tnum text-sm font-semibold">
                {formatIDR(summary.remaining)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 py-1">
          <div>
            <p className="text-sm font-semibold">Penurunan saldo sampai lunas</p>
            <p className="text-xs text-muted-foreground">
              Dari {periodLabel(burndown.points[0]?.period ?? summary.nextOpenPeriod)}
              {burndown.projection.payoffPeriod
                ? ` sampai ${periodLabel(burndown.projection.payoffPeriod)}`
                : ""}
            </p>
          </div>
          <BurndownChart data={burndown.points} height={260} tickCount={5} />
          <BurndownLegend />
        </CardContent>
      </Card>

      <PayoffSimulator
        remaining={summary.remaining}
        startPeriod={summary.nextOpenPeriod}
        baseMonthly={summary.monthlyTarget}
      />

      {yearly.length > 0 ? (
        <Card>
          <CardContent className="flex flex-col gap-3 py-1">
            <p className="text-sm font-semibold">Total dibayar per tahun</p>
            <YearlyBars data={yearly} />
            <table className="w-full text-sm">
              <caption className="sr-only">
                Total pembayaran yang tercatat per tahun
              </caption>
              <tbody className="divide-y divide-border">
                {yearly.map((row) => (
                  <tr key={row.year}>
                    <th scope="row" className="py-2 text-left font-medium">
                      {row.year}
                    </th>
                    <td className="tnum py-2 text-right">{formatIDR(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
