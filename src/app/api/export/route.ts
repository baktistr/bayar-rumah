import { getSessionUser } from "@/lib/auth";
import { listTransactions } from "@/lib/ledger";
import { todayISO } from "@/lib/period";

/** Membungkus nilai agar aman di CSV, termasuk melawan injeksi rumus di Excel. */
function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  // Sel yang diawali = + - @ dieksekusi sebagai rumus oleh spreadsheet.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return new Response("Tidak ditemukan", { status: 404 });

  const rows = await listTransactions();

  const header = [
    "id",
    "cicilan_ke",
    "jenis",
    "status",
    "bulan",
    "tanggal_transfer",
    "nominal",
    "metode",
    "bank",
    "catatan",
    "jumlah_bukti",
  ];

  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.id,
        r.installmentNo ?? "",
        r.type,
        r.status,
        r.period,
        r.paidAt ?? "",
        r.amount,
        r.method,
        r.bankNote ?? "",
        r.note ?? "",
        r.attachmentCount,
      ]
        .map(csvCell)
        .join(","),
    ),
  ];

  // BOM UTF-8 supaya Excel di Windows membaca karakter non-ASCII dengan benar.
  const body = `﻿${lines.join("\r\n")}\r\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bayarrumah-${todayISO()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
