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

const PANJANG_MINIMUM = 12;

/**
 * Kata dan pola yang paling dulu dicoba penyerang. Daftar pendek ini menutup
 * sebagian besar tebakan nyata; sisanya ditangani oleh syarat panjang.
 */
const KATA_TERLARANG = [
  "password", "passw0rd", "qwerty", "abc123", "iloveyou", "admin", "letmein",
  "welcome", "monkey", "dragon", "sunshine", "princess", "football",
  // Kata Indonesia yang lazim dipakai sebagai password
  "ganteng", "cantik", "sayang", "rahasia", "bismillah", "indonesia",
  "jakarta", "keluarga", "rumahku", "bayarrumah", "cicilan", "mertua",
  "akubisa", "semangat", "januari", "asdfghjkl", "qwertyuiop",
];

/**
 * Aturan password. Dipakai saat seed dan saat ganti password.
 *
 * Mengikuti pendekatan NIST SP 800-63B: bertumpu pada PANJANG dan daftar
 * larangan, bukan aturan komposisi (wajib simbol/angka/huruf besar). Aturan
 * komposisi mendorong orang membuat "Password1!" — memenuhi syarat di atas
 * kertas, tapi justru pola pertama yang ditebak mesin. Frasa panjang jauh
 * lebih kuat sekaligus lebih mudah diingat.
 */
export function validatePassword(
  password: string,
  opts: { username?: string } = {},
): string | null {
  if (password.length < PANJANG_MINIMUM) {
    return `Password minimal ${PANJANG_MINIMUM} karakter. Frasa seperti "melati-kembang-2026" lebih kuat sekaligus lebih mudah diingat daripada satu kata pendek.`;
  }
  if (password.length > 200) return "Password terlalu panjang.";

  const lower = password.toLowerCase();

  const terlarang = KATA_TERLARANG.find((kata) => lower.includes(kata));
  if (terlarang) {
    return `Password mengandung kata yang terlalu mudah ditebak ("${terlarang}"). Pilih kombinasi kata yang tidak berhubungan.`;
  }

  const username = opts.username?.toLowerCase().trim();
  if (username && username.length >= 3 && lower.includes(username)) {
    return "Password tidak boleh memuat username.";
  }

  // "aaaaaaaaaaaa" dan "123456789012" memenuhi syarat panjang tapi tidak
  // menambah kesulitan menebak sama sekali.
  if (/^(.)\1+$/.test(password)) {
    return "Password tidak boleh satu karakter yang diulang.";
  }
  if (new Set(password).size < 5) {
    return "Password terlalu sedikit variasi karakternya.";
  }
  if (/^(?:0123456789|1234567890|9876543210)/.test(password.replace(/\D/g, ""))) {
    return "Password tidak boleh berupa urutan angka.";
  }

  return null;
}
