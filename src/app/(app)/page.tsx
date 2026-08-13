import Link from "next/link";
import {
  CalendarClockIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  TriangleAlertIcon,
  WalletIcon,
} from "lucide-react";

import { BurndownChart, BurndownLegend } from "@/components/charts/burndown-chart";
import { TransactionRow } from "@/components/transaction-row";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getBurndown, getSummary, listTransactions } from "@/lib/ledger";
import { formatIDR, formatPercent, terbilangSingkat } from "@/lib/money";
import { dateLabel, periodLabel } from "@/lib/period";

export default async function DashboardPage() {
  const [summary, burndown, recent] = await Promise.all([
    getSummary(),
    getBurndown(),
    listTransactions({ limit: 5 }),
  ]);

  // Grafik beranda memakai rentang penuh sampai lunas, bukan potongan
  // beberapa bulan: pada saldo miliaran, cicilan bulanan nyaris tak terlihat
  // dalam jendela pendek dan grafiknya tampak datar tanpa memberi informasi.
  // Yang ingin dilihat sekilas adalah bentuk keseluruhan lintasan pelunasan.
  const hasPlanned = summary.plannedTotal > 0;

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden border-0 bg-primary text-primary-foreground shadow-lg shadow-primary/20">
        <CardContent className="flex flex-col gap-4 pt-1">
          <div>
            <p className="text-sm/none opacity-80">Sisa hutang</p>
            <p className="tnum mt-2 text-[2rem] font-bold leading-none tracking-tight">
              {formatIDR(summary.remaining)}
            </p>
            <p className="mt-1.5 text-xs opacity-75">
              kurang lebih {terbilangSingkat(summary.remaining)}
            </p>
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between text-xs opacity-85">
              <span>Sudah dibayar {formatIDR(summary.totalPaid)}</span>
              <span className="tnum font-semibold">
                {formatPercent(summary.progressPct)}
              </span>
            </div>
            <Progress
              value={summary.progressPct}
              className="h-2 bg-primary-foreground/25 [&>div]:bg-primary-foreground"
            />
          </div>

          {summary.lastPaid ? (
            <p className="text-xs opacity-75">
              Terakhir tercatat:{" "}
              {summary.lastPaid.installmentNo
                ? `Cicilan ${summary.lastPaid.installmentNo} · `
                : ""}
              {summary.lastPaid.paidAt
                ? dateLabel(summary.lastPaid.paidAt)
                : periodLabel(summary.lastPaid.period)}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <MonthStatus summary={summary} />

      <div className="grid grid-cols-2 gap-3">
        <MiniStat
          icon={<CalendarClockIcon className="size-4" />}
          label="Perkiraan lunas"
          value={burndown.projection.payoffLabel}
          hint={burndown.projection.durationLabel}
        />
        <MiniStat
          icon={<WalletIcon className="size-4" />}
          label="Cicilan berikutnya"
          value={formatIDR(summary.monthlyTarget)}
          hint={`#${summary.nextInstallmentNo} · ${periodLabel(summary.nextOpenPeriod)}`}
        />
      </div>

      {hasPlanned ? (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 py-1">
            <div>
              <p className="text-xs text-muted-foreground">
                Sisa bila semua rencana terbayar
              </p>
              <p className="tnum text-base font-semibold">
                {formatIDR(summary.projectedRemaining)}
              </p>
            </div>
            <p className="tnum text-xs text-muted-foreground">
              {formatIDR(summary.plannedTotal)} terjadwal
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="flex flex-col gap-3 py-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Penurunan saldo</p>
            <Link
              href="/proyeksi"
              className="flex items-center text-xs font-medium text-primary"
            >
              Lihat penuh
              <ChevronRightIcon className="size-3.5" />
            </Link>
          </div>
          <BurndownChart data={burndown.points} height={180} tickCount={3} />
          <BurndownLegend />
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="px-0 py-0">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm font-semibold">Pembayaran terakhir</p>
            <Link
              href="/riwayat"
              className="flex items-center text-xs font-medium text-primary"
            >
              Semua
              <ChevronRightIcon className="size-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-border border-t border-border">
            {recent.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Belum ada catatan pembayaran.
              </p>
            ) : (
              recent.map((tx) => <TransactionRow key={tx.id} tx={tx} />)
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MonthStatus({
  summary,
}: {
  summary: Awaited<ReturnType<typeof getSummary>>;
}) {
  const { currentMonth } = summary;

  if (currentMonth.paid) {
    return (
      <Card className="border-[var(--chart-1)]/25 bg-[var(--chart-1)]/8">
        <CardContent className="flex items-center gap-3 py-1">
          <CheckCircle2Icon className="size-5 shrink-0 text-[var(--chart-1)]" />
          <div className="min-w-0">
            <p className="text-sm font-medium">
              Cicilan {periodLabel(currentMonth.period)} sudah dibayar
            </p>
            <p className="tnum text-xs text-muted-foreground">
              {formatIDR(currentMonth.amount)} bulan ini
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={
        currentMonth.overdue
          ? "border-destructive/30 bg-destructive/8"
          : "border-[var(--chart-3)]/30 bg-[var(--chart-3)]/8"
      }
    >
      <CardContent className="flex items-center gap-3 py-1">
        <TriangleAlertIcon
          className={`size-5 shrink-0 ${
            currentMonth.overdue ? "text-destructive" : "text-[var(--chart-3)]"
          }`}
        />
        <div className="min-w-0">
          <p className="text-sm font-medium">
            Cicilan {periodLabel(currentMonth.period)} belum dibayar
          </p>
          <p className="text-xs text-muted-foreground">
            {currentMonth.overdue ? "Lewat jatuh tempo " : "Jatuh tempo "}
            {dateLabel(currentMonth.dueDate)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-1">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}
          {label}
        </p>
        <p className="tnum text-base font-semibold leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
