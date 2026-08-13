import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Semua nominal disimpan sebagai INTEGER rupiah penuh (bukan float, bukan sen).
 * Rupiah tidak punya pecahan desimal yang dipakai sehari-hari, dan float pada
 * angka miliaran menimbulkan galat pembulatan.
 *
 * Tanggal kalender (paid_at, baseline_date) disimpan TEXT 'YYYY-MM-DD' supaya
 * bebas dari pergeseran timezone. Timestamp sistem disimpan epoch milliseconds.
 */

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["ADMIN", "VIEWER"] }).notNull(),
  mustChangePassword: integer("must_change_password", { mode: "boolean" })
    .notNull()
    .default(false),
  /**
   * Dinaikkan setiap kali password diganti. Nilainya ikut ditanam di token
   * sesi dan dicocokkan ulang tiap request, sehingga token lama — termasuk
   * yang sudah dicuri — langsung tidak berlaku begitu password diganti.
   * Tanpa ini, mengganti password tidak mengusir siapa pun, karena JWT
   * bersifat stateless dan tetap sah sampai kedaluwarsa.
   */
  sessionVersion: integer("session_version").notNull().default(0),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch() * 1000)`),
  lastLoginAt: integer("last_login_at"),
});

/** Satu baris saja (id = 1). Dikelola admin lewat halaman Pengaturan. */
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  houseLabel: text("house_label").notNull(),
  /** Total kewajiban yang dipakai sebagai penyebut progres (100%). */
  originalAmount: integer("original_amount").notNull(),
  /** Saldo pada baseline_date, sebelum transaksi apa pun di tabel transactions. */
  baselineAmount: integer("baseline_amount").notNull(),
  baselineDate: text("baseline_date").notNull(),
  /** Cicilan ke-berapa yang sudah lewat sebelum baseline (tidak didetailkan). */
  baselineInstallmentNo: integer("baseline_installment_no").notNull().default(0),
  monthlyTarget: integer("monthly_target").notNull(),
  dueDayOfMonth: integer("due_day_of_month").notNull().default(5),
});

export const transactions = sqliteTable(
  "transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** Null untuk lump sum / potongan yang tidak masuk hitungan nomor cicilan. */
    installmentNo: integer("installment_no"),
    type: text("type", {
      enum: ["CICILAN", "LUMP_SUM", "POTONGAN", "PENYESUAIAN"],
    })
      .notNull()
      .default("CICILAN"),
    status: text("status", { enum: ["LUNAS", "RENCANA"] })
      .notNull()
      .default("LUNAS"),
    amount: integer("amount").notNull(),
    /** Bulan cicilan, format 'YYYY-MM'. */
    period: text("period").notNull(),
    /** Tanggal transfer 'YYYY-MM-DD'. Null selama status masih RENCANA. */
    paidAt: text("paid_at"),
    method: text("method", { enum: ["TRANSFER", "TUNAI", "LAINNYA"] })
      .notNull()
      .default("TRANSFER"),
    bankNote: text("bank_note"),
    note: text("note"),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: integer("created_at").notNull().default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
    /** Soft delete: baris tidak pernah benar-benar hilang dari ledger. */
    deletedAt: integer("deleted_at"),
  },
  (t) => [
    index("tx_period_idx").on(t.period),
    index("tx_status_idx").on(t.status),
    index("tx_deleted_idx").on(t.deletedAt),
  ],
);

export const attachments = sqliteTable(
  "attachments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    transactionId: integer("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    /** Nama file UUID di dalam data/uploads — bukan path dari user. */
    fileName: text("file_name").notNull(),
    thumbName: text("thumb_name"),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    originalName: text("original_name"),
    uploadedAt: integer("uploaded_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("att_tx_idx").on(t.transactionId)],
);

/**
 * Jejak audit. Tidak pernah di-update atau dihapus: ini catatan uang keluarga
 * yang dilihat dua pihak, jadi setiap perubahan angka harus bisa ditelusuri.
 */
export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actorId: integer("actor_id").references(() => users.id),
    actorName: text("actor_name").notNull(),
    action: text("action", {
      enum: ["CREATE", "UPDATE", "DELETE", "RESTORE", "LOGIN", "SETTINGS"],
    }).notNull(),
    entity: text("entity").notNull(),
    entityId: integer("entity_id"),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    at: integer("at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("audit_entity_idx").on(t.entity, t.entityId)],
);

export type User = typeof users.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
