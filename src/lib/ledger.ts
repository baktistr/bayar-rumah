import "server-only";

import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { attachments, settings, transactions } from "@/db/schema";
import {
  addMonths,
  clampDayToMonth,
  comparePeriod,
  currentPeriod,
  periodOf,
  todayISO,
} from "./period";
import { projectPayoff, type ProjectionResult } from "./projection";

const alive = () => isNull(transactions.deletedAt);

export async function getSettings() {
  const row = await db.query.settings.findFirst({ where: eq(settings.id, 1) });
  if (!row) throw new Error("Pengaturan belum di-seed. Jalankan: npm run db:seed");
  return row;
}

export type Summary = {
  /** Saldo berdasarkan transaksi berstatus LUNAS saja. */
  remaining: number;
  /** Saldo setelah cicilan berstatus RENCANA ikut diperhitungkan. */
  projectedRemaining: number;
  totalPaid: number;
  plannedTotal: number;
  originalAmount: number;
  progressPct: number;
  monthlyTarget: number;
  lastPaid: { period: string; paidAt: string | null; installmentNo: number | null } | null;
  /** Nomor cicilan berikutnya, sudah termasuk cicilan sebelum baseline. */
  nextInstallmentNo: number;
  /** Bulan cicilan pertama yang belum tercatat sama sekali. */
  nextOpenPeriod: string;
  currentMonth: {
    period: string;
    paid: boolean;
    amount: number;
    dueDate: string;
    overdue: boolean;
  };
};

export async function getSummary(): Promise<Summary> {
  const cfg = await getSettings();

  const [totals] = await db
    .select({
      paid: sql<number>`coalesce(sum(case when ${transactions.status} = 'LUNAS' then ${transactions.amount} else 0 end), 0)`,
      planned: sql<number>`coalesce(sum(case when ${transactions.status} = 'RENCANA' then ${transactions.amount} else 0 end), 0)`,
      maxInstallment: sql<number | null>`max(${transactions.installmentNo})`,
      maxPeriod: sql<string | null>`max(${transactions.period})`,
    })
    .from(transactions)
    .where(alive());

  const totalPaid = totals?.paid ?? 0;
  const plannedTotal = totals?.planned ?? 0;
  const remaining = cfg.baselineAmount - totalPaid;

  const lastPaidRow = await db.query.transactions.findFirst({
    where: and(alive(), eq(transactions.status, "LUNAS")),
    orderBy: [desc(transactions.period), desc(transactions.id)],
    columns: { period: true, paidAt: true, installmentNo: true },
  });

  const period = currentPeriod();
  const [monthAgg] = await db
    .select({
      amount: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(transactions)
    .where(
      and(alive(), eq(transactions.status, "LUNAS"), eq(transactions.period, period)),
    );

  const paidThisMonth = (monthAgg?.count ?? 0) > 0;
  const dueDate = clampDayToMonth(period, cfg.dueDayOfMonth);

  // Nomor cicilan lanjut dari yang tertinggi; kalau ledger masih kosong,
  // lanjut dari hitungan cicilan sebelum baseline.
  const nextInstallmentNo =
    Math.max(totals?.maxInstallment ?? 0, cfg.baselineInstallmentNo) + 1;

  const maxPeriod = totals?.maxPeriod ?? null;
  const nextOpenPeriod =
    maxPeriod && comparePeriod(maxPeriod, period) >= 0
      ? addMonths(maxPeriod, 1)
      : period;

  return {
    remaining,
    projectedRemaining: remaining - plannedTotal,
    totalPaid,
    plannedTotal,
    originalAmount: cfg.originalAmount,
    progressPct:
      cfg.originalAmount > 0
        ? ((cfg.originalAmount - remaining) / cfg.originalAmount) * 100
        : 0,
    monthlyTarget: cfg.monthlyTarget,
    lastPaid: lastPaidRow ?? null,
    nextInstallmentNo,
    nextOpenPeriod,
    currentMonth: {
      period,
      paid: paidThisMonth,
      amount: monthAgg?.amount ?? 0,
      dueDate,
      overdue: !paidThisMonth && todayISO() > dueDate,
    },
  };
}

export type BurndownPoint = {
  period: string;
  /** Saldo realisasi; null untuk titik yang murni proyeksi. */
  actual: number | null;
  /** Saldo proyeksi; null untuk titik yang sudah terjadi. */
  projected: number | null;
  payment: number;
};

/**
 * Deret saldo dari baseline sampai lunas. Bagian realisasi dan proyeksi
 * sengaja dipisah jadi dua field supaya bisa digambar sebagai satu garis
 * utuh + satu garis putus-putus tanpa terputus di titik sambungan.
 */
export async function getBurndown(): Promise<{
  points: BurndownPoint[];
  projection: ProjectionResult;
}> {
  const cfg = await getSettings();

  const rows = await db
    .select({
      period: transactions.period,
      amount: sql<number>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .where(and(alive(), eq(transactions.status, "LUNAS")))
    .groupBy(transactions.period)
    .orderBy(asc(transactions.period));

  const basePeriod = periodOf(cfg.baselineDate);
  const points: BurndownPoint[] = [
    { period: basePeriod, actual: cfg.baselineAmount, projected: null, payment: 0 },
  ];

  let balance = cfg.baselineAmount;
  for (const row of rows) {
    balance -= row.amount;
    if (row.period === basePeriod) {
      // Pembayaran di bulan baseline menimpa titik awal, bukan menambah titik.
      points[0] = { ...points[0], actual: balance, payment: row.amount };
      continue;
    }
    points.push({ period: row.period, actual: balance, projected: null, payment: row.amount });
  }

  const lastActual = points[points.length - 1];
  const projection = projectPayoff({
    remaining: balance,
    monthly: cfg.monthlyTarget,
    startPeriod: addMonths(lastActual.period, 1),
  });

  // Titik sambungan: garis proyeksi mulai dari saldo realisasi terakhir.
  if (projection.schedule.length > 0) {
    lastActual.projected = lastActual.actual;
    for (const step of projection.schedule) {
      points.push({
        period: step.period,
        actual: null,
        projected: step.balance,
        payment: step.payment,
      });
    }
  }

  return { points, projection };
}

export type TransactionFilter = {
  year?: number;
  status?: "LUNAS" | "RENCANA";
  limit?: number;
};

export async function listTransactions(filter: TransactionFilter = {}) {
  const conditions = [alive()];
  if (filter.status) conditions.push(eq(transactions.status, filter.status));
  if (filter.year) {
    conditions.push(sql`substr(${transactions.period}, 1, 4) = ${String(filter.year)}`);
  }

  const rows = await db.query.transactions.findMany({
    where: and(...conditions),
    orderBy: [desc(transactions.period), desc(transactions.id)],
    limit: filter.limit,
  });

  if (rows.length === 0) return [];

  // Satu query untuk semua lampiran, bukan satu per transaksi.
  const counts = await db
    .select({
      transactionId: attachments.transactionId,
      total: sql<number>`count(*)`,
    })
    .from(attachments)
    .groupBy(attachments.transactionId);

  const countMap = new Map(counts.map((c) => [c.transactionId, c.total]));
  return rows.map((row) => ({
    ...row,
    attachmentCount: countMap.get(row.id) ?? 0,
    /** Tercatat lunas tapi tanggalnya masih di depan — ditandai di UI. */
    preRecorded: row.status === "LUNAS" && !!row.paidAt && row.paidAt > todayISO(),
  }));
}

export type TransactionListItem = Awaited<ReturnType<typeof listTransactions>>[number];

export async function getTransactionDetail(id: number) {
  const row = await db.query.transactions.findFirst({
    where: and(eq(transactions.id, id), alive()),
  });
  if (!row) return null;

  const files = await db.query.attachments.findMany({
    where: eq(attachments.transactionId, id),
  });

  return { ...row, attachments: files };
}

export async function listYears(): Promise<number[]> {
  const rows = await db
    .selectDistinct({ year: sql<string>`substr(${transactions.period}, 1, 4)` })
    .from(transactions)
    .where(alive())
    .orderBy(desc(sql`substr(${transactions.period}, 1, 4)`));
  return rows.map((r) => Number(r.year));
}

/** Total pembayaran per tahun, untuk grafik batang di halaman proyeksi. */
export async function getYearlyTotals() {
  const rows = await db
    .select({
      year: sql<string>`substr(${transactions.period}, 1, 4)`,
      total: sql<number>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .where(and(alive(), eq(transactions.status, "LUNAS")))
    .groupBy(sql`substr(${transactions.period}, 1, 4)`)
    .orderBy(asc(sql`substr(${transactions.period}, 1, 4)`));
  return rows.map((r) => ({ year: Number(r.year), total: r.total }));
}
