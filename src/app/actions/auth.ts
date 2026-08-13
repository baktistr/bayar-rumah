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

async function clientKey(): Promise<string> {
  const h = await headers();
  // Di belakang Caddy, IP asli ada di X-Forwarded-For. Ambil entri pertama.
  const forwarded = h.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
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
  const limit = checkRateLimit(key);
  if (!limit.ok) {
    return {
      error: `Terlalu banyak percobaan. Coba lagi dalam ${limit.retryInMin} menit.`,
    };
  }

  const user = await authenticate(username, password);
  if (!user) {
    recordFailedAttempt(key);
    // Pesan sengaja tidak menyebut mana yang salah, username atau password.
    return { error: "Username atau password salah." };
  }

  clearAttempts(key);
  await createSessionCookie(user);
  await logAudit({ actor: user, action: "LOGIN", entity: "session", entityId: user.id });

  // Hanya menerima path internal — mencegah open redirect lewat ?next=
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
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

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(next), mustChangePassword: false })
    .where(eq(users.id, user.id));

  await logAudit({ actor: user, action: "UPDATE", entity: "password", entityId: user.id });
  return { success: "Password berhasil diganti." };
}
