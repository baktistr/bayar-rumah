import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE, verifySession } from "@/lib/session";

/**
  * Gerbang pertama: menahan permintaan tanpa sesi sebelum menyentuh halaman.
 * Pemeriksaan peran (ADMIN vs VIEWER) tetap dilakukan di Server Action —
  * proxy hanya memeriksa "sudah login atau belum".
 */
const PUBLIC_PATHS = ["/login", "/api/health"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    // Keputusan "sudah login, tidak perlu lihat /login lagi" TIDAK diambil di
    // sini. Proxy hanya memverifikasi tanda tangan token; ia tidak tahu apakah
    // versi sesinya masih berlaku. Token yang tanda tangannya sah tapi sudah
    // dicabut akan dipantulkan ke "/", ditolak halaman, dikembalikan ke
    // "/login", dan dipantulkan lagi — lingkaran redirect tanpa ujung.
    // Halaman login sendiri yang memutuskannya, memakai pemeriksaan yang
    // menyertakan database.
    return NextResponse.next();
  }

  if (!session) {
    const url = new URL("/login", request.url);
    // Simpan tujuan awal supaya setelah login langsung diarahkan ke sana.
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Semua rute kecuali aset internal Next dan berkas statis.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon-.*\\.png).*)",
  ],
};
