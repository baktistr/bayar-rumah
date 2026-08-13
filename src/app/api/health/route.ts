import { sql } from "drizzle-orm";

import { db } from "@/db";

/**
 * Dipakai HEALTHCHECK Docker. Sengaja menyentuh database, bukan sekadar
 * membalas 200: container yang hidup tapi databasenya tidak terbaca
 * tetap harus dilaporkan tidak sehat.
 */
export async function GET() {
  try {
    await db.get(sql`select 1`);
    return Response.json({ status: "ok", time: new Date().toISOString() });
  } catch (err) {
    return Response.json(
      { status: "error", message: err instanceof Error ? err.message : "unknown" },
      { status: 503 },
    );
  }
}
