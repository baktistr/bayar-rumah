/**
 * Helper tanggal. Aplikasi ini memakai dua bentuk saja:
 *   - period : 'YYYY-MM' (bulan cicilan)
 *   - date   : 'YYYY-MM-DD' (tanggal transfer)
 *
 * Keduanya string, bukan Date, supaya tidak pernah bergeser sehari gara-gara
 * server berjalan di UTC sementara penggunanya di WIB.
 */

export const TIMEZONE = "Asia/Jakarta";

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const BULAN_SINGKAT = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

/** Tanggal hari ini menurut WIB, 'YYYY-MM-DD'. */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Bulan berjalan menurut WIB, 'YYYY-MM'. */
export function currentPeriod(): string {
  return todayISO().slice(0, 7);
}

export function periodOf(dateISO: string): string {
  return dateISO.slice(0, 7);
}

export function splitPeriod(period: string): { year: number; month: number } {
  const [y, m] = period.split("-");
  return { year: Number(y), month: Number(m) };
}

export function addMonths(period: string, delta: number): string {
  const { year, month } = splitPeriod(period);
  const zeroBased = year * 12 + (month - 1) + delta;
  const y = Math.floor(zeroBased / 12);
  const m = (zeroBased % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** Jumlah bulan dari a ke b (b - a). */
export function monthsBetween(a: string, b: string): number {
  const pa = splitPeriod(a);
  const pb = splitPeriod(b);
  return (pb.year - pa.year) * 12 + (pb.month - pa.month);
}

export function comparePeriod(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** '2026-08' -> 'Agustus 2026' */
export function periodLabel(period: string): string {
  const { year, month } = splitPeriod(period);
  return `${BULAN[month - 1]} ${year}`;
}

/** '2026-08' -> 'Agu 2026' */
export function periodLabelShort(period: string): string {
  const { year, month } = splitPeriod(period);
  return `${BULAN_SINGKAT[month - 1]} ${year}`;
}

/** '2026-08-13' -> '13 Agustus 2026' */
export function dateLabel(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  return `${d} ${BULAN[m - 1]} ${y}`;
}

/** '2026-08-13' -> '13 Agu 2026' */
export function dateLabelShort(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  return `${d} ${BULAN_SINGKAT[m - 1]} ${y}`;
}

/** Hari terakhir bulan tersebut, supaya due date tidak jatuh ke 31 Februari. */
export function clampDayToMonth(period: string, day: number): string {
  const { year, month } = splitPeriod(period);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const d = Math.min(Math.max(day, 1), lastDay);
  return `${period}-${String(d).padStart(2, "0")}`;
}

/** "18 tahun 6 bulan" — dipakai di simulator proyeksi. */
export function humanizeMonths(months: number): string {
  if (months <= 0) return "lunas";
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} bulan`;
  if (m === 0) return `${y} tahun`;
  return `${y} tahun ${m} bulan`;
}
