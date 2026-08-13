import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { sql } from "drizzle-orm";

import { db } from "@/db";
import { getSessionUser } from "@/lib/auth";
import { todayISO } from "@/lib/period";

/**
 * Cadangan database. Hanya admin — berkasnya berisi seluruh ledger beserta
 * hash password kedua pengguna.
 *
 * Memakai `VACUUM INTO`, bukan menyalin berkas mentah: dengan mode WAL, sebagian
 * transaksi terbaru masih berada di berkas -wal, sehingga salinan mentah bisa
 * kehilangan data atau rusak. VACUUM INTO menulis snapshot yang konsisten.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return new Response("Tidak ditemukan", { status: 404 });
  }

  const tmpPath = path.join(os.tmpdir(), `bayarrumah-${randomUUID()}.db`);

  try {
    await db.run(sql.raw(`VACUUM INTO '${tmpPath}'`));
    const buf = await fs.readFile(tmpPath);

    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(buf.byteLength),
        "Content-Disposition": `attachment; filename="bayarrumah-${todayISO()}.db"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return new Response(
      `Gagal membuat cadangan: ${err instanceof Error ? err.message : "unknown"}`,
      { status: 500 },
    );
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
  }
}
