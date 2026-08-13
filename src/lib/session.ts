import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "br_session";
const ISSUER = "bayar-rumah";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 hari

export type SessionUser = {
  id: number;
  name: string;
  username: string;
  role: "ADMIN" | "VIEWER";
};

/**
 * Rahasia sesi wajib dari environment. Sengaja tidak ada nilai default:
 * fallback diam-diam berarti semua instalasi memakai kunci yang sama dan
 * token bisa dipalsukan siapa pun yang membaca kode ini.
 */
function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET belum diset atau kurang dari 32 karakter. " +
        "Buat dengan: openssl rand -base64 32",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({
    name: user.name,
    username: user.username,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { issuer: ISSUER });
    const role = payload.role;
    if (role !== "ADMIN" && role !== "VIEWER") return null;
    return {
      id: Number(payload.sub),
      name: String(payload.name ?? ""),
      username: String(payload.username ?? ""),
      role,
    };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Produksi selalu di balik HTTPS (Caddy), jadi cookie ditandai Secure.
    // COOKIE_SECURE=false hanya untuk menjalankan image produksi di HTTP
    // polos saat pengujian lokal — jangan dipakai di server yang terekspos.
    secure:
      process.env.COOKIE_SECURE === "false"
        ? false
        : process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}
