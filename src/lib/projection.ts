import { addMonths, humanizeMonths, periodLabel } from "./period";

/** Batas aman iterasi: 100 tahun. Mencegah loop tak berujung bila cicilan terlalu kecil. */
const MAX_MONTHS = 1200;

export type ExtraPayment = { period: string; amount: number };

export type ProjectionInput = {
  /** Sisa hutang saat ini (integer rupiah). */
  remaining: number;
  /** Nominal cicilan per bulan. */
  monthly: number;
  /** Bulan cicilan pertama yang diproyeksikan, 'YYYY-MM'. */
  startPeriod: string;
  /** Pembayaran tambahan di luar cicilan rutin. */
  extras?: ExtraPayment[];
};

export type ProjectionPoint = {
  period: string;
  payment: number;
  balance: number;
};

export type ProjectionResult = {
  /** Jumlah bulan sampai lunas. null bila tidak akan pernah lunas. */
  months: number | null;
  /** Bulan pelunasan 'YYYY-MM'. null bila tidak akan pernah lunas. */
  payoffPeriod: string | null;
  payoffLabel: string;
  durationLabel: string;
  schedule: ProjectionPoint[];
  /** Total yang masih harus dibayar (= remaining, kecuali sudah lunas). */
  totalToPay: number;
};

/**
 * Proyeksi pelunasan tanpa bunga: saldo berkurang sebesar cicilan tiap bulan,
 * ditambah pembayaran ekstra bila ada. Cicilan terakhir otomatis dipotong
 * sebesar sisa (tidak membayar lebih dari yang tersisa).
 */
export function projectPayoff({
  remaining,
  monthly,
  startPeriod,
  extras = [],
}: ProjectionInput): ProjectionResult {
  if (remaining <= 0) {
    return {
      months: 0,
      payoffPeriod: null,
      payoffLabel: "Sudah lunas",
      durationLabel: "lunas",
      schedule: [],
      totalToPay: 0,
    };
  }

  const extraByPeriod = new Map<string, number>();
  for (const e of extras) {
    if (e.amount > 0) {
      extraByPeriod.set(e.period, (extraByPeriod.get(e.period) ?? 0) + e.amount);
    }
  }

  const schedule: ProjectionPoint[] = [];
  let balance = remaining;
  let period = startPeriod;
  let months = 0;

  while (balance > 0 && months < MAX_MONTHS) {
    const scheduled = Math.max(0, monthly) + (extraByPeriod.get(period) ?? 0);
    // Cicilan nol dan tanpa ekstra berarti saldo tidak akan pernah turun.
    if (scheduled <= 0) {
      return {
        months: null,
        payoffPeriod: null,
        payoffLabel: "Tidak akan lunas",
        durationLabel: "—",
        schedule,
        totalToPay: remaining,
      };
    }

    const payment = Math.min(scheduled, balance);
    balance -= payment;
    months += 1;
    schedule.push({ period, balance, payment });
    if (balance > 0) period = addMonths(period, 1);
  }

  if (balance > 0) {
    return {
      months: null,
      payoffPeriod: null,
      payoffLabel: "Lebih dari 100 tahun",
      durationLabel: "> 100 tahun",
      schedule,
      totalToPay: remaining,
    };
  }

  return {
    months,
    payoffPeriod: period,
    payoffLabel: periodLabel(period),
    durationLabel: humanizeMonths(months),
    schedule,
    totalToPay: remaining,
  };
}

/**
 * Selisih dua skenario, untuk kalimat "lebih cepat 9 tahun 2 bulan".
 * Mengembalikan null bila salah satu skenario tidak pernah lunas.
 */
export function compareScenarios(
  base: ProjectionResult,
  candidate: ProjectionResult,
): { fasterMonths: number; label: string } | null {
  if (base.months === null || candidate.months === null) return null;
  const diff = base.months - candidate.months;
  if (diff === 0) return { fasterMonths: 0, label: "sama dengan rencana awal" };
  return {
    fasterMonths: diff,
    label:
      diff > 0
        ? `lebih cepat ${humanizeMonths(diff)}`
        : `lebih lama ${humanizeMonths(-diff)}`,
  };
}
