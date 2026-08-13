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

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
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
 * Rate limit login sederhana berbasis memori proses. Cukup untuk aplikasi
 * satu container dua pengguna; kalau nanti di-scale ke banyak instance,
 * ini perlu pindah ke penyimpanan bersama.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function checkRateLimit(key: string): { ok: boolean; retryInMin: number } {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 0, resetAt: now + WINDOW_MS });
    return { ok: true, retryInMin: 0 };
  }
  if (entry.count >= MAX_ATTEMPTS) {
    return { ok: false, retryInMin: Math.ceil((entry.resetAt - now) / 60000) };
  }
  return { ok: true, retryInMin: 0 };
}

export function recordFailedAttempt(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export function clearAttempts(key: string) {
  attempts.delete(key);
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

  await db
    .update(users)
    .set({ lastLoginAt: Date.now() })
    .where(eq(users.id, row.id));

  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
  };
}
