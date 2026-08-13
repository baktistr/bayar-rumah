"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { users } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { hashPassword, validatePassword } from "@/lib/password";

export type ActionState = { error?: string; success?: string } | null;

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username minimal 3 karakter.")
  .max(32, "Username maksimal 32 karakter.")
  .regex(
    /^[a-z0-9_.-]+$/,
    "Username hanya boleh huruf kecil, angka, titik, garis bawah, dan strip.",
  );

const nameSchema = z
  .string()
  .trim()
  .min(1, "Nama wajib diisi.")
  .max(60, "Nama maksimal 60 karakter.");

const roleSchema = z.enum(["ADMIN", "VIEWER"]);

function refresh() {
  revalidatePath("/", "layout");
}

/**
 * Syarat SQL: masih ada admin aktif LAIN selain pengguna ini.
 *
 * Sengaja berupa kondisi di dalam perintah UPDATE, bukan pemeriksaan terpisah
 * sebelumnya. Pola "SELECT dulu, baru UPDATE" bisa dilewati dua permintaan
 * yang berjalan bersamaan: masing-masing menonaktifkan admin yang berbeda,
 * keduanya melihat masih ada satu admin lain, dan keduanya lolos — menyisakan
 * nol admin. Digabung jadi satu perintah, SQLite mengeksekusinya atomik,
 * sehingga yang kedua tidak mengubah baris apa pun.
 *
 * Ini penting karena aplikasi ini tidak punya panel pemulihan: kehilangan
 * admin terakhir berarti harus menyunting database langsung di server.
 */
const adminLainMasihAda = (exceptId: number) =>
  sql`exists (
    select 1 from users u2
    where u2.role = 'ADMIN' and u2.deleted_at is null and u2.id <> ${exceptId}
  )`;

export async function listUsers() {
  await requireAdmin();
  return db.query.users.findMany({
    orderBy: [asc(users.deletedAt), asc(users.id)],
    columns: {
      id: true,
      name: true,
      username: true,
      role: true,
      mustChangePassword: true,
      createdAt: true,
      lastLoginAt: true,
      deletedAt: true,
    },
  });
}

export async function createUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = z
    .object({ name: nameSchema, username: usernameSchema, role: roleSchema })
    .safeParse({
      name: formData.get("name"),
      username: formData.get("username"),
      role: formData.get("role"),
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const password = String(formData.get("password") ?? "");
  const invalid = validatePassword(password, { username: parsed.data.username });
  if (invalid) return { error: invalid };

  const existing = await db.query.users.findFirst({
    where: eq(users.username, parsed.data.username),
  });
  if (existing) {
    return {
      error: existing.deletedAt
        ? `Username "${parsed.data.username}" pernah dipakai akun yang dinonaktifkan. Aktifkan kembali akun itu, atau pilih username lain.`
        : `Username "${parsed.data.username}" sudah dipakai.`,
    };
  }

  const [row] = await db
    .insert(users)
    .values({
      name: parsed.data.name,
      username: parsed.data.username,
      role: parsed.data.role,
      passwordHash: await hashPassword(password),
      // Password sementara dari admin harus diganti pemiliknya sendiri —
      // admin tidak perlu, dan tidak seharusnya, tahu password akhirnya.
      mustChangePassword: true,
    })
    .returning({ id: users.id });

  await logAudit({
    actor: admin,
    action: "CREATE",
    entity: "user",
    entityId: row.id,
    after: { name: parsed.data.name, username: parsed.data.username, role: parsed.data.role },
  });

  refresh();
  return {
    success: `Pengguna "${parsed.data.name}" dibuat. Sampaikan password awalnya secara langsung, dan minta dia menggantinya saat login pertama.`,
  };
}

export async function updateUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { error: "ID tidak valid." };

  const before = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!before) return { error: "Pengguna tidak ditemukan." };

  const parsed = z
    .object({ name: nameSchema, role: roleSchema })
    .safeParse({ name: formData.get("name"), role: formData.get("role") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const turunDariAdmin = before.role === "ADMIN" && parsed.data.role !== "ADMIN";
  if (turunDariAdmin && id === admin.id) {
    return { error: "Tidak bisa menurunkan peranmu sendiri. Minta admin lain melakukannya." };
  }

  // Perubahan peran mencabut sesi yang sedang berjalan, supaya peran barunya
  // berlaku seketika dan bukan menunggu dia login ulang.
  const roleChanged = before.role !== parsed.data.role;
  const hasil = db
    .update(users)
    .set({
      name: parsed.data.name,
      role: parsed.data.role,
      sessionVersion: roleChanged ? before.sessionVersion + 1 : before.sessionVersion,
    })
    .where(
      turunDariAdmin
        ? and(eq(users.id, id), adminLainMasihAda(id))
        : eq(users.id, id),
    )
    .run();

  if (hasil.changes === 0) {
    return {
      error: "Ini satu-satunya admin yang aktif. Buat admin lain dulu sebelum menurunkan perannya.",
    };
  }

  await logAudit({
    actor: admin,
    action: "UPDATE",
    entity: "user",
    entityId: id,
    before: { name: before.name, role: before.role },
    after: parsed.data,
  });

  refresh();
  return { success: "Perubahan tersimpan." };
}

/** Memberi password sementara baru, mis. saat pengguna lupa passwordnya. */
export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { error: "ID tidak valid." };

  const target = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!target) return { error: "Pengguna tidak ditemukan." };

  const password = String(formData.get("password") ?? "");
  const invalid = validatePassword(password, { username: target.username });
  if (invalid) return { error: invalid };

  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
      // Mencabut semua sesi lama. Kalau alasan reset-nya adalah akun diduga
      // dibobol, membiarkan sesi lama tetap hidup membuat reset ini percuma.
      sessionVersion: target.sessionVersion + 1,
    })
    .where(eq(users.id, id));

  await logAudit({
    actor: admin,
    action: "UPDATE",
    entity: "user_password",
    entityId: id,
  });

  refresh();
  return {
    success: `Password sementara untuk "${target.name}" disetel. Semua perangkatnya keluar, dan dia wajib menggantinya saat login.`,
  };
}

export async function setUserActiveAction(
  id: number,
  active: boolean,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const target = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!target) return { error: "Pengguna tidak ditemukan." };

  if (!active && id === admin.id) {
    return { error: "Tidak bisa menonaktifkan akunmu sendiri." };
  }

  const perluPagarAdmin = !active && target.role === "ADMIN";
  const hasil = db
    .update(users)
    .set({
      deletedAt: active ? null : Date.now(),
      // Menonaktifkan harus langsung memutus sesi yang sedang berjalan.
      sessionVersion: target.sessionVersion + 1,
    })
    .where(
      perluPagarAdmin ? and(eq(users.id, id), adminLainMasihAda(id)) : eq(users.id, id),
    )
    .run();

  if (hasil.changes === 0) {
    return { error: "Ini satu-satunya admin yang aktif — tidak bisa dinonaktifkan." };
  }

  await logAudit({
    actor: admin,
    action: active ? "RESTORE" : "DELETE",
    entity: "user",
    entityId: id,
    before: { name: target.name, active: target.deletedAt === null },
    after: { name: target.name, active },
  });

  refresh();
  return {
    success: active
      ? `Akun "${target.name}" diaktifkan kembali.`
      : `Akun "${target.name}" dinonaktifkan dan langsung keluar dari semua perangkat.`,
  };
}
