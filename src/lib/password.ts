import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

// Parameter scrypt: N=2^15 memakai ~32 MB per hash. maxmem harus dinaikkan
// karena batas bawaan Node (32 MB) tepat di ambang dan bisa melempar error.
const PARAMS = { N: 32768, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };
const KEYLEN = 64;

/**
 * scrypt dari node:crypto — memory-hard, tanpa dependency native tambahan
 * sehingga image Docker tidak perlu toolchain build.
 * Format: scrypt$N$r$p$salt_b64$hash_b64
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN, PARAMS);
  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, n, r, p, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");

  try {
    const actual = await scrypt(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: PARAMS.maxmem,
    });
    // Panjang harus sama sebelum timingSafeEqual, atau ia melempar.
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Aturan minimum password. Dipakai saat seed dan saat ganti password. */
export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password minimal 8 karakter.";
  if (password.length > 200) return "Password terlalu panjang.";
  return null;
}
