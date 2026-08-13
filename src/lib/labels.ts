/**
 * Satu sumber untuk label yang dibaca pengguna. Nilai enum-nya sendiri
 * (CICILAN, TRANSFER, …) tidak pernah ditampilkan mentah ke layar.
 */

export const TYPE_LABELS = {
  CICILAN: "Cicilan",
  LUMP_SUM: "Pembayaran tambahan",
  POTONGAN: "Potongan",
  PENYESUAIAN: "Penyesuaian",
} as const;

export const METHOD_LABELS = {
  TRANSFER: "Transfer bank",
  TUNAI: "Tunai",
  LAINNYA: "Lainnya",
} as const;

export const STATUS_LABELS = {
  LUNAS: "Lunas",
  RENCANA: "Rencana",
} as const;

export type TransactionType = keyof typeof TYPE_LABELS;
export type PaymentMethod = keyof typeof METHOD_LABELS;

/** Untuk prop `items` milik Base UI Select, sekaligus untuk merender opsinya. */
export function toSelectItems<T extends Record<string, string>>(labels: T) {
  return Object.entries(labels) as [keyof T & string, string][];
}
