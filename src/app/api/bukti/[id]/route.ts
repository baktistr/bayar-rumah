import { eq } from "drizzle-orm";

import { db } from "@/db";
import { attachments } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { readStoredFile } from "@/lib/uploads";

/**
 * Bukti transfer tidak pernah diletakkan di /public. Setiap permintaan
 * melewati pemeriksaan sesi lebih dulu; tanpa sesi jawabannya 404, bukan 403,
 * supaya keberadaan berkas pun tidak bocor ke penebak URL.
 *
 * ?thumb=1 mengambil versi kecil untuk daftar.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return new Response("Tidak ditemukan", { status: 404 });

  const { id } = await params;
  const attachmentId = Number(id);
  if (!Number.isInteger(attachmentId)) {
    return new Response("Tidak ditemukan", { status: 404 });
  }

  const row = await db.query.attachments.findFirst({
    where: eq(attachments.id, attachmentId),
  });
  if (!row) return new Response("Tidak ditemukan", { status: 404 });

  const wantThumb = new URL(request.url).searchParams.get("thumb") === "1";
  const fileName = wantThumb && row.thumbName ? row.thumbName : row.fileName;

  try {
    const buf = await readStoredFile(fileName);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": wantThumb && row.thumbName ? "image/webp" : row.mimeType,
        "Content-Length": String(buf.byteLength),
        // private: proxy bersama tidak boleh menyimpan bukti transfer.
        "Cache-Control": "private, max-age=31536000, immutable",
        "Content-Disposition": `inline; filename="${encodeURIComponent(
          row.originalName ?? fileName,
        )}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Tidak ditemukan", { status: 404 });
  }
}
