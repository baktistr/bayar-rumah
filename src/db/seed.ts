import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";

import { db } from "./index";
import { settings, transactions, users } from "./schema";
import { hashPassword, validatePassword } from "../lib/password";
import { clampDayToMonth } from "../lib/period";

/**
 * Seed idempoten: aman dijalankan tiap container start. Tidak pernah menimpa
 * data yang sudah ada — hanya mengisi tabel yang masih kosong.
 */

const BASELINE_AMOUNT = 1_147_550_000;
const BASELINE_DATE = "2026-05-01";
const BASELINE_INSTALLMENT_NO = 8;
const MONTHLY_TARGET = 5_000_000;
const DUE_DAY = 5;

/**
 * Ledger awal sesuai catatan manual per 13 Agustus 2026.
 * Cicilan 12–15 (Sep–Des 2026) ikut dicatat LUNAS sesuai keputusan pemilik data,
 * dengan paid_at tersebar per bulan supaya grafik penurunan saldo tetap
 * bertahap, bukan terjun bebas di satu tanggal.
 */
const SEED_LEDGER = [
  {
    installmentNo: null,
    type: "LUMP_SUM" as const,
    amount: 6_000_000,
    period: "2026-05",
    day: 1,
    note: "Pengurang saldo per 1 Mei 2026 (sesuai catatan awal).",
  },
  {
    installmentNo: 9,
    type: "CICILAN" as const,
    amount: 3_000_000,
    period: "2026-06",
    day: DUE_DAY,
    note: null,
  },
  ...([10, 11, 12, 13, 14, 15] as const).map((no, i) => ({
    installmentNo: no,
    type: "CICILAN" as const,
    amount: 5_000_000,
    period: `2026-${String(7 + i).padStart(2, "0")}`,
    day: DUE_DAY,
    note: null,
  })),
];

/**
 * Password dari environment harus lolos aturan yang sama dengan yang berlaku
 * di aplikasi. Kalau tidak, password lemah bisa menyelinap lewat pintu belakang
 * seed — persis jalur yang tidak diawasi siapa pun.
 */
function envOrRandom(key: string): {
  value: string;
  generated: boolean;
  reason?: string;
} {
  const fromEnv = process.env[key];
  if (fromEnv) {
    const invalid = validatePassword(fromEnv);
    if (!invalid) return { value: fromEnv, generated: false };
    return {
      value: randomBytes(12).toString("base64url"),
      generated: true,
      reason: `${key} ditolak: ${invalid}`,
    };
  }
  return { value: randomBytes(12).toString("base64url"), generated: true };
}

export async function seed() {
  const notes: string[] = [];

  const existingSettings = await db.query.settings.findFirst();
  if (!existingSettings) {
    await db.insert(settings).values({
      id: 1,
      houseLabel: process.env.HOUSE_LABEL ?? "Pembayaran Rumah ke Mertua",
      originalAmount: BASELINE_AMOUNT,
      baselineAmount: BASELINE_AMOUNT,
      baselineDate: BASELINE_DATE,
      baselineInstallmentNo: BASELINE_INSTALLMENT_NO,
      monthlyTarget: MONTHLY_TARGET,
      dueDayOfMonth: DUE_DAY,
    });
    notes.push("Pengaturan dasar dibuat.");
  }

  const [{ count: userCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users);

  const credentials: { label: string; username: string; password: string }[] = [];

  if (userCount === 0) {
    const adminPw = envOrRandom("ADMIN_PASSWORD");
    const viewerPw = envOrRandom("VIEWER_PASSWORD");
    const adminUsername = (process.env.ADMIN_USERNAME ?? "admin").toLowerCase();
    const viewerUsername = (process.env.VIEWER_USERNAME ?? "ibu").toLowerCase();

    await db.insert(users).values([
      {
        name: process.env.ADMIN_NAME ?? "Admin",
        username: adminUsername,
        passwordHash: await hashPassword(adminPw.value),
        role: "ADMIN",
        mustChangePassword: true,
      },
      {
        name: process.env.VIEWER_NAME ?? "Ibu",
        username: viewerUsername,
        passwordHash: await hashPassword(viewerPw.value),
        role: "VIEWER",
        mustChangePassword: true,
      },
    ]);

    for (const pw of [adminPw, viewerPw]) {
      if (pw.reason) notes.push(pw.reason);
    }
    credentials.push(
      { label: "ADMIN ", username: adminUsername, password: adminPw.value },
      { label: "VIEWER", username: viewerUsername, password: viewerPw.value },
    );
    notes.push("Dua pengguna dibuat.");
  }

  const [{ count: txCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(transactions);

  if (txCount === 0) {
    const admin = await db.query.users.findFirst();
    await db.insert(transactions).values(
      SEED_LEDGER.map((row) => ({
        installmentNo: row.installmentNo,
        type: row.type,
        status: "LUNAS" as const,
        amount: row.amount,
        period: row.period,
        paidAt: clampDayToMonth(row.period, row.day),
        method: "TRANSFER" as const,
        note: row.note,
        createdBy: admin?.id ?? null,
      })),
    );
    const total = SEED_LEDGER.reduce((s, r) => s + r.amount, 0);
    notes.push(
      `${SEED_LEDGER.length} transaksi awal dimuat (total Rp ${total.toLocaleString("id-ID")}, ` +
        `sisa Rp ${(BASELINE_AMOUNT - total).toLocaleString("id-ID")}).`,
    );
  }

  return { notes, credentials };
}

// Dijalankan langsung lewat `npm run db:seed` atau entrypoint container.
if (process.argv[1] && process.argv[1].includes("seed")) {
  seed()
    .then(({ notes, credentials }) => {
      if (notes.length === 0) {
        console.log("Seed dilewati — data sudah ada.");
      } else {
        for (const n of notes) console.log(`  ${n}`);
      }
      if (credentials.length > 0) {
        console.log("\n  ┌─ Kredensial awal (hanya tampil sekali) ─────────────");
        for (const c of credentials) {
          console.log(`  │ ${c.label}  ${c.username}  /  ${c.password}`);
        }
        console.log("  └─ Wajib diganti saat login pertama. ────────────────\n");
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seed gagal:", err);
      process.exit(1);
    });
}
