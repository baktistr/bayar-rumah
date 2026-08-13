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
    // Yang sudah login tidak perlu melihat halaman login lagi.
    if (pathname === "/login" && session) {
      return NextResponse.redirect(new URL("/", request.url));
    }
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
