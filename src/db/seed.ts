import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "./index";
import { settings, transactions, users } from "./schema";
import { hashPassword, validatePassword } from "../lib/password";
import { clampDayToMonth, currentPeriod } from "../lib/period";

/**
 * Seed idempoten: aman dijalankan tiap container start. Tidak pernah menimpa
 * data yang sudah ada — hanya mengisi tabel yang masih kosong.
 *
 * SELURUH angka datang dari environment, tanpa kecuali. Repositori ini tidak
 * memuat satu pun nilai keuangan sungguhan: saldo, riwayat cicilan, dan target
 * bulanan adalah data pribadi pemiliknya, dan kode sumber bukan tempatnya.
 * Nilai bawaannya nol/kosong, sehingga instalasi tanpa konfigurasi apa pun
 * tetap berjalan — hanya dengan ledger kosong yang siap diisi lewat aplikasi.
 */

const DEFAULT_DUE_DAY = 5;

function envInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const value = Number.parseInt(raw.replace(/\D/g, ""), 10);
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Riwayat pembayaran yang sudah terjadi sebelum aplikasi ini dipakai, dikirim
 * sebagai JSON lewat SEED_LEDGER. Divalidasi ketat: seed yang salah bentuk
 * lebih baik gagal keras saat container start daripada diam-diam memasukkan
 * angka ngawur ke ledger keuangan.
 */
const seedLedgerSchema = z.array(
  z.object({
    installmentNo: z.number().int().positive().nullable().default(null),
    type: z
      .enum(["CICILAN", "LUMP_SUM", "POTONGAN", "PENYESUAIAN"])
      .default("CICILAN"),
    amount: z.number().int().positive(),
    period: z.string().regex(/^\d{4}-\d{2}$/),
    day: z.number().int().min(1).max(31).default(DEFAULT_DUE_DAY),
    note: z.string().max(500).nullable().default(null),
  }),
);

function parseSeedLedger(): z.infer<typeof seedLedgerSchema> {
  const raw = process.env.SEED_LEDGER?.trim();
  if (!raw) return [];

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("SEED_LEDGER bukan JSON yang valid.");
  }

  const parsed = seedLedgerSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`SEED_LEDGER tidak valid: ${parsed.error.issues[0]?.message}`);
  }
  return parsed.data;
}

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

  const baselineAmount = envInt("BASELINE_AMOUNT", 0);
  const baselineDate = process.env.BASELINE_DATE ?? `${currentPeriod()}-01`;
  const dueDay = envInt("DUE_DAY_OF_MONTH", DEFAULT_DUE_DAY);
  const seedLedger = parseSeedLedger();

  const existingSettings = await db.query.settings.findFirst();
  if (!existingSettings) {
    await db.insert(settings).values({
      id: 1,
      houseLabel: process.env.HOUSE_LABEL ?? "Pembayaran Rumah",
      // Penyebut persentase progres. Kalau tidak diset, samakan dengan
      // baseline supaya progresnya dihitung dari titik awal pencatatan.
      originalAmount: envInt("ORIGINAL_AMOUNT", baselineAmount),
      baselineAmount,
      baselineDate,
      baselineInstallmentNo: envInt("BASELINE_INSTALLMENT_NO", 0),
      monthlyTarget: envInt("MONTHLY_TARGET", 0),
      dueDayOfMonth: dueDay >= 1 && dueDay <= 31 ? dueDay : DEFAULT_DUE_DAY,
    });
    notes.push(
      baselineAmount > 0
        ? `Pengaturan dibuat (saldo awal per ${baselineDate}).`
        : "Pengaturan dibuat dengan saldo awal nol — isi lewat menu Pengaturan.",
    );
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

  if (txCount === 0 && seedLedger.length > 0) {
    const admin = await db.query.users.findFirst();
    await db.insert(transactions).values(
      seedLedger.map((row) => ({
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
    const total = seedLedger.reduce((sum, r) => sum + r.amount, 0);
    notes.push(
      `${seedLedger.length} transaksi awal dimuat (total Rp ${total.toLocaleString("id-ID")}, ` +
        `sisa Rp ${(baselineAmount - total).toLocaleString("id-ID")}).`,
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
