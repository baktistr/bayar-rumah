"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import {
  authenticate,
  checkRateLimit,
  clearAttempts,
  createSessionCookie,
  destroySessionCookie,
  recordFailedAttempt,
  requireUser,
} from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { hashPassword, validatePassword, verifyPassword } from "@/lib/password";

export type ActionState = { error?: string; success?: string } | null;

/**
 * Kunci rate limit login.
 *
 * PENTING: ambil entri TERAKHIR dari X-Forwarded-For, bukan yang pertama.
 * Caddy menambahkan IP klien ke ujung rantai yang sudah ada, jadi entri
 * pertama justru nilai yang dikirim klien dan bisa dipalsukan. Memakai
 * entri pertama membuat penyerang cukup mengganti header tiap request untuk
 * mendapat jatah percobaan baru — rate limit-nya jadi tidak berfungsi.
 */
async function clientKey(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const chain = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (chain.length > 0) return chain[chain.length - 1];
  }
  return h.get("x-real-ip") || "unknown";
}

/**
 * Membatasi tujuan redirect setelah login ke path internal.
 *
 * Memakai daftar karakter yang diizinkan, bukan menolak pola berbahaya satu
 * per satu: `startsWith("/") && !startsWith("//")` masih meloloskan
 * `/\evil.com`, dan browser menormalkan backslash jadi garis miring sehingga
 * hasilnya `//evil.com` — URL protocol-relative yang membawa pengguna keluar
 * dari situs, tepat setelah mereka mengetik password.
 */
function safeNext(next: string): string {
  return /^\/[A-Za-z0-9._~\-/]*$/.test(next) ? next : "/";
}

export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!username || !password) {
    return { error: "Username dan password harus diisi." };
  }

  const key = await clientKey();
  const limit = checkRateLimit(key, username);
  if (!limit.ok) {
    return {
      error: `Terlalu banyak percobaan. Coba lagi dalam ${limit.retryInMin} menit.`,
    };
  }

  const user = await authenticate(username, password);
  if (!user) {
    recordFailedAttempt(key, username);
    // Pesan sengaja tidak menyebut mana yang salah, username atau password.
    return { error: "Username atau password salah." };
  }

  clearAttempts(key, username);
  await createSessionCookie(user);
  await logAudit({ actor: user, action: "LOGIN", entity: "session", entityId: user.id });

  redirect(safeNext(next));
}

export async function logoutAction() {
  await destroySessionCookie();
  redirect("/login");
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const row = await db.query.users.findFirst({ where: eq(users.id, user.id) });
  if (!row) return { error: "Pengguna tidak ditemukan." };

  if (!(await verifyPassword(current, row.passwordHash))) {
    return { error: "Password saat ini salah." };
  }
  const invalid = validatePassword(next);
  if (invalid) return { error: invalid };
  if (next !== confirm) return { error: "Konfirmasi password tidak cocok." };
  if (next === current) return { error: "Password baru harus berbeda." };

  // Menaikkan session_version mencabut SEMUA token yang sudah beredar untuk
  // pengguna ini — termasuk yang mungkin dicuri, yang justru jadi alasan
  // orang mengganti password.
  const nextVersion = row.sessionVersion + 1;
  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(next),
      mustChangePassword: false,
      sessionVersion: nextVersion,
    })
    .where(eq(users.id, user.id));

  // Perangkat yang sedang dipakai untuk mengganti password diberi token baru,
  // supaya tidak ikut terlempar keluar oleh pencabutan di atas.
  await createSessionCookie({ ...user, sessionVersion: nextVersion });

  await logAudit({ actor: user, action: "UPDATE", entity: "password", entityId: user.id });
  return { success: "Password berhasil diganti. Perangkat lain otomatis keluar." };
}
