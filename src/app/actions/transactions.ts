"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { attachments, settings, transactions } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { addMonths, monthsBetween, periodOf, todayISO } from "@/lib/period";
import { deleteStoredFile, storeUpload } from "@/lib/uploads";

export type ActionState = { error?: string; success?: string; id?: number } | null;

const MAX_AMOUNT = 100_000_000_000; // Rp 100 M — pagar terhadap salah ketik nol.

const transactionSchema = z.object({
  amount: z
    .number()
    .int("Nominal harus bilangan bulat.")
    .positive("Nominal harus lebih dari nol.")
    .max(MAX_AMOUNT, "Nominal tidak masuk akal, periksa jumlah nolnya."),
  period: z.string().regex(/^\d{4}-\d{2}$/, "Format bulan tidak valid."),
  paidAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid.")
    .nullable(),
  installmentNo: z.number().int().positive().nullable(),
  type: z.enum(["CICILAN", "LUMP_SUM", "POTONGAN", "PENYESUAIAN"]),
  status: z.enum(["LUNAS", "RENCANA"]),
  method: z.enum(["TRANSFER", "TUNAI", "LAINNYA"]),
  bankNote: z.string().max(120).nullable(),
  note: z.string().max(500).nullable(),
});

function parseForm(formData: FormData) {
  const rawAmount = String(formData.get("amount") ?? "").replace(/\D/g, "");
  const rawInstallment = String(formData.get("installmentNo") ?? "").trim();
  const status = String(formData.get("status") ?? "LUNAS");
  const paidAt = String(formData.get("paidAt") ?? "").trim();
  const text = (key: string) => {
    const v = String(formData.get(key) ?? "").trim();
    return v === "" ? null : v;
  };

  return transactionSchema.safeParse({
    amount: rawAmount === "" ? 0 : Number.parseInt(rawAmount, 10),
    period: String(formData.get("period") ?? "").trim(),
    // Baris RENCANA belum punya tanggal transfer.
    paidAt: status === "RENCANA" ? null : paidAt || todayISO(),
    installmentNo: rawInstallment === "" ? null : Number.parseInt(rawInstallment, 10),
    type: String(formData.get("type") ?? "CICILAN"),
    status,
    method: String(formData.get("method") ?? "TRANSFER"),
    bankNote: text("bankNote"),
    note: text("note"),
  });
}

async function saveAttachments(transactionId: number, files: File[]) {
  const errors: string[] = [];
  for (const file of files) {
    if (!file || file.size === 0) continue;
    try {
      const stored = await storeUpload(file);
      await db.insert(attachments).values({ transactionId, ...stored });
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Gagal menyimpan bukti.");
    }
  }
  return errors;
}

/**
 * Membayar cicilan Agustus pada awal September itu wajar, jadi tanggal transfer
 * tidak dipaksa sebulan dengan periode cicilan. Yang dijaga hanya salah ketik
 * tahun — selisih lebih dari 12 bulan hampir pasti "2016" yang seharusnya "2026",
 * dan diam-diam merusak grafik penurunan saldo.
 */
function checkPeriodSanity(period: string, paidAt: string | null): string | null {
  if (!paidAt) return null;
  const gap = Math.abs(monthsBetween(period, periodOf(paidAt)));
  if (gap > 12) {
    return `Tanggal transfer (${paidAt}) terlalu jauh dari bulan cicilan (${period}). Periksa tahunnya.`;
  }
  return null;
}

function refresh() {
  revalidatePath("/", "layout");
}

export async function createTransactionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const data = parsed.data;

  const mismatch = checkPeriodSanity(data.period, data.paidAt);
  if (mismatch) return { error: mismatch };

  const [row] = await db
    .insert(transactions)
    .values({ ...data, createdBy: admin.id })
    .returning({ id: transactions.id });

  const files = formData.getAll("bukti").filter((f): f is File => f instanceof File);
  const uploadErrors = await saveAttachments(row.id, files);

  await logAudit({
    actor: admin,
    action: "CREATE",
    entity: "transaction",
    entityId: row.id,
    after: data,
  });

  refresh();

  // Transaksinya SUDAH tersimpan di titik ini. Kalau hanya lampirannya yang
  // gagal, hasilnya tetap harus dilaporkan sebagai sukses — kalau dilaporkan
  // sebagai error, admin mengira pembayarannya tidak tercatat lalu mengisi
  // ulang formulir, dan ledger keuangan berakhir dengan baris ganda.
  // Buktinya bisa dilampirkan menyusul dari halaman detail.
  return uploadErrors.length > 0
    ? {
        id: row.id,
        success: `Pembayaran tersimpan, tapi bukti gagal diunggah: ${uploadErrors.join(" ")} Lampirkan lagi dari halaman ini.`,
      }
    : { id: row.id, success: "Pembayaran tersimpan." };
}

export async function updateTransactionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { error: "ID tidak valid." };

  const before = await db.query.transactions.findFirst({
    where: and(eq(transactions.id, id), isNull(transactions.deletedAt)),
  });
  if (!before) return { error: "Transaksi tidak ditemukan." };

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const data = parsed.data;
  const mismatch = checkPeriodSanity(data.period, data.paidAt);
  if (mismatch) return { error: mismatch };

  await db
    .update(transactions)
    .set({ ...data, updatedAt: Date.now() })
    .where(eq(transactions.id, id));

  const files = formData.getAll("bukti").filter((f): f is File => f instanceof File);
  await saveAttachments(id, files);

  await logAudit({
    actor: admin,
    action: "UPDATE",
    entity: "transaction",
    entityId: id,
    before,
    after: data,
  });

  refresh();
  return { id, success: "Perubahan tersimpan." };
}

/** Soft delete: baris tetap ada di database dan bisa dipulihkan. */
export async function deleteTransactionAction(id: number): Promise<ActionState> {
  const admin = await requireAdmin();
  const before = await db.query.transactions.findFirst({
    where: and(eq(transactions.id, id), isNull(transactions.deletedAt)),
  });
  if (!before) return { error: "Transaksi tidak ditemukan." };

  await db
    .update(transactions)
    .set({ deletedAt: Date.now(), updatedAt: Date.now() })
    .where(eq(transactions.id, id));

  await logAudit({
    actor: admin,
    action: "DELETE",
    entity: "transaction",
    entityId: id,
    before,
  });

  refresh();
  return { success: "Transaksi dihapus." };
}

/** Menandai baris RENCANA menjadi LUNAS begitu transfernya benar-benar dilakukan. */
export async function markPaidAction(
  id: number,
  paidAt?: string,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const before = await db.query.transactions.findFirst({
    where: and(eq(transactions.id, id), isNull(transactions.deletedAt)),
  });
  if (!before) return { error: "Transaksi tidak ditemukan." };
  if (before.status === "LUNAS") return { error: "Transaksi ini sudah berstatus lunas." };

  // Menandai lunas berarti transfernya terjadi hari ini, bukan pada bulan
  // cicilan yang bersangkutan — cicilan Maret bisa saja dilunasi bulan ini.
  const date = paidAt ?? todayISO();
  await db
    .update(transactions)
    .set({ status: "LUNAS", paidAt: date, updatedAt: Date.now() })
    .where(eq(transactions.id, id));

  await logAudit({
    actor: admin,
    action: "UPDATE",
    entity: "transaction",
    entityId: id,
    before,
    after: { status: "LUNAS", paidAt: date },
  });

  refresh();
  return { success: "Ditandai lunas." };
}

/**
 * Membuat beberapa bulan cicilan berstatus RENCANA sekaligus — pola yang
 * dipakai di catatan asli ("cicilan 10 s/d 15 @ 5 jt").
 */
export async function generatePlanAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const months = Number(formData.get("months"));
  const amount = Number(String(formData.get("amount") ?? "").replace(/\D/g, ""));
  const startPeriod = String(formData.get("startPeriod") ?? "").trim();
  const startNo = Number(formData.get("startInstallmentNo"));

  if (!Number.isInteger(months) || months < 1 || months > 60) {
    return { error: "Jumlah bulan harus antara 1 dan 60." };
  }
  if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_AMOUNT) {
    return { error: "Nominal cicilan tidak valid." };
  }
  if (!/^\d{4}-\d{2}$/.test(startPeriod)) return { error: "Bulan mulai tidak valid." };

  const existing = await db.query.transactions.findMany({
    where: isNull(transactions.deletedAt),
    columns: { period: true },
  });
  const taken = new Set(existing.map((r) => r.period));

  const rows = [];
  let no = Number.isInteger(startNo) && startNo > 0 ? startNo : 1;
  for (let i = 0; i < months; i += 1) {
    const period = addMonths(startPeriod, i);
    // Lewati bulan yang sudah punya catatan, supaya tidak dobel.
    if (taken.has(period)) continue;
    rows.push({
      installmentNo: no,
      type: "CICILAN" as const,
      status: "RENCANA" as const,
      amount,
      period,
      paidAt: null,
      method: "TRANSFER" as const,
      note: null,
      createdBy: admin.id,
    });
    no += 1;
  }

  if (rows.length === 0) {
    return { error: "Semua bulan pada rentang itu sudah punya catatan." };
  }

  await db.insert(transactions).values(rows);
  await logAudit({
    actor: admin,
    action: "CREATE",
    entity: "transaction_plan",
    after: { months: rows.length, amount, startPeriod },
  });

  refresh();
  return { success: `${rows.length} bulan rencana dibuat.` };
}

export async function deleteAttachmentAction(id: number): Promise<ActionState> {
  const admin = await requireAdmin();
  const row = await db.query.attachments.findFirst({ where: eq(attachments.id, id) });
  if (!row) return { error: "Bukti tidak ditemukan." };

  await db.delete(attachments).where(eq(attachments.id, id));
  await deleteStoredFile(row.fileName);
  await deleteStoredFile(row.thumbName);

  await logAudit({
    actor: admin,
    action: "DELETE",
    entity: "attachment",
    entityId: id,
    before: { transactionId: row.transactionId, originalName: row.originalName },
  });

  refresh();
  return { success: "Bukti dihapus." };
}

/** Menambah bukti ke transaksi yang sudah ada — untuk melengkapi baris lama. */
export async function addAttachmentsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const id = Number(formData.get("transactionId"));
  if (!Number.isInteger(id)) return { error: "ID tidak valid." };

  const files = formData.getAll("bukti").filter((f): f is File => f instanceof File);
  if (files.every((f) => f.size === 0)) return { error: "Tidak ada berkas dipilih." };

  const errors = await saveAttachments(id, files);
  refresh();
  return errors.length > 0
    ? { error: errors.join(" ") }
    : { success: "Bukti ditambahkan." };
}

export async function updateSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const before = await db.query.settings.findFirst({ where: eq(settings.id, 1) });

  const num = (key: string) => Number(String(formData.get(key) ?? "").replace(/\D/g, ""));
  const houseLabel = String(formData.get("houseLabel") ?? "").trim().slice(0, 120);
  const originalAmount = num("originalAmount");
  const monthlyTarget = num("monthlyTarget");
  const dueDayOfMonth = Number(formData.get("dueDayOfMonth"));

  if (!houseLabel) return { error: "Nama/label wajib diisi." };
  if (!originalAmount || originalAmount > MAX_AMOUNT) return { error: "Total awal tidak valid." };
  if (!monthlyTarget || monthlyTarget > MAX_AMOUNT) return { error: "Target cicilan tidak valid." };
  if (!Number.isInteger(dueDayOfMonth) || dueDayOfMonth < 1 || dueDayOfMonth > 31) {
    return { error: "Tanggal jatuh tempo harus 1–31." };
  }

  await db
    .update(settings)
    .set({ houseLabel, originalAmount, monthlyTarget, dueDayOfMonth })
    .where(eq(settings.id, 1));

  await logAudit({
    actor: admin,
    action: "SETTINGS",
    entity: "settings",
    entityId: 1,
    before,
    after: { houseLabel, originalAmount, monthlyTarget, dueDayOfMonth },
  });

  refresh();
  return { success: "Pengaturan tersimpan." };
}
