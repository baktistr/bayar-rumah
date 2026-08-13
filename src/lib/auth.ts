import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "./password";
import {
  SESSION_COOKIE,
  type SessionUser,
  sessionCookieOptions,
  signSession,
  verifySession,
} from "./session";

/**
 * Tanda tangan token yang sah belum cukup: versinya juga harus masih cocok
 * dengan yang tercatat di database. Pemeriksaan ini yang membuat penggantian
 * password benar-benar mencabut sesi lain, bukan sekadar mengubah hash.
 *
 * Satu query per request — tidak masalah untuk aplikasi dua pengguna, dan
 * inilah harga dari sesi yang bisa dicabut.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await verifySession(token);
  if (!session) return null;

  const row = await db.query.users.findFirst({
    where: eq(users.id, session.id),
    columns: { sessionVersion: true, role: true, name: true, deletedAt: true },
  });
  // Akun yang dinonaktifkan diperlakukan seperti tidak ada: sesinya yang
  // sedang berjalan langsung berhenti berlaku, tanpa menunggu token kedaluwarsa.
  if (!row || row.deletedAt !== null) return null;
  if (row.sessionVersion !== session.sessionVersion) return null;

  // Peran dan nama diambil ulang dari database, bukan dari token: kalau
  // sewaktu-waktu diubah, perubahannya berlaku tanpa menunggu login ulang.
  return { ...session, role: row.role, name: row.name };
}

/** Untuk Server Component: pengunjung tanpa sesi dilempar ke halaman login. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Gerbang tulis. Dipanggil di setiap Server Action yang mengubah data —
 * menyembunyikan tombol di UI saja tidak menghentikan request buatan tangan.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new Error("Hanya admin yang boleh mengubah data.");
  }
  return user;
}

export async function createSessionCookie(user: SessionUser) {
  const token = await signSession(user);
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
}

export async function destroySessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * Rate limit login berbasis memori proses. Cukup untuk satu container dua
 * pengguna; kalau suatu saat di-scale ke banyak instance, ini harus pindah ke
 * penyimpanan bersama.
 *
 * Dihitung pada DUA sumbu sekaligus:
 *   - alamat IP  — menahan satu sumber yang mencoba banyak akun
 *   - username   — menahan banyak sumber yang mengeroyok satu akun
 *
 * Sumbu username itu yang menentukan. IP diambil dari header X-Forwarded-For,
 * dan header bisa dipalsukan; penyerang tinggal menggantinya tiap request
 * untuk selalu mendapat jatah baru. Username yang sedang dibobol tidak bisa
 * ikut dipalsukan, jadi batas ini tetap berlaku betapapun header diputar.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_IP = 5;
const MAX_PER_USERNAME = 10;

function limitFor(key: string, max: number) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) return { ok: true, retryInMin: 0 };
  if (entry.count >= max) {
    return { ok: false, retryInMin: Math.ceil((entry.resetAt - now) / 60000) };
  }
  return { ok: true, retryInMin: 0 };
}

export function checkRateLimit(
  ip: string,
  username: string,
): { ok: boolean; retryInMin: number } {
  const byIp = limitFor(`ip:${ip}`, MAX_PER_IP);
  if (!byIp.ok) return byIp;
  return limitFor(`user:${username.trim().toLowerCase()}`, MAX_PER_USERNAME);
}

export function recordFailedAttempt(ip: string, username: string) {
  const now = Date.now();
  for (const key of [`ip:${ip}`, `user:${username.trim().toLowerCase()}`]) {
    const entry = attempts.get(key);
    if (!entry || now > entry.resetAt) {
      attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    } else {
      entry.count += 1;
    }
  }
}

export function clearAttempts(ip: string, username: string) {
  attempts.delete(`ip:${ip}`);
  attempts.delete(`user:${username.trim().toLowerCase()}`);
}

export async function authenticate(
  username: string,
  password: string,
): Promise<SessionUser | null> {
  const row = await db.query.users.findFirst({
    where: eq(users.username, username.trim().toLowerCase()),
  });

  // Tetap jalankan verifikasi walau user tidak ada, memakai hash dummy, supaya
  // waktu respons tidak membocorkan username mana yang terdaftar.
  if (!row) {
    await verifyPassword(password, "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA");
    return null;
  }

  const ok = await verifyPassword(password, row.passwordHash);
  if (!ok) return null;

  // Diperiksa SETELAH password diverifikasi, bukan sebelumnya. Menolak lebih
  // awal akan membuat waktu respons berbeda antara akun nonaktif dan password
  // salah, dan selisih itu cukup untuk menebak username mana yang terdaftar.
  if (row.deletedAt !== null) return null;

  await db
    .update(users)
    .set({ lastLoginAt: Date.now() })
    .where(eq(users.id, row.id));

  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
    sessionVersion: row.sessionVersion,
  };
}
