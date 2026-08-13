import "server-only";

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { UPLOAD_DIR } from "@/db";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
export const ACCEPTED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

/**
 * Deteksi jenis berkas dari magic bytes, bukan dari ekstensi atau header
 * Content-Type — keduanya dikirim klien dan bisa dipalsukan.
 */
function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;

  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "%PDF") return "application/pdf";
  if (
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return "image/webp";
  // HEIC/HEIF: kotak 'ftyp' di offset 4, merek di offset 8.
  if (buf.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("ascii");
    if (["heic", "heix", "hevc", "mif1", "heim", "msf1"].includes(brand)) return "image/heic";
  }
  return null;
}

export type StoredFile = {
  fileName: string;
  thumbName: string | null;
  mimeType: string;
  sizeBytes: number;
  originalName: string;
};

/**
 * Menyimpan satu bukti transfer ke volume data.
 *
 * Gambar dikonversi ke WebP maksimal 2000px (foto HP 5 MB jadi ~300 KB) dan
 * metadata EXIF — termasuk koordinat GPS — dibuang oleh sharp. Orientasi
 * dinormalkan lebih dulu supaya foto dari HP tidak tampil miring.
 * PDF disimpan apa adanya tanpa thumbnail.
 */
export async function storeUpload(file: File): Promise<StoredFile> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Ukuran berkas melebihi 10 MB.");
  }
  if (file.size === 0) {
    throw new Error("Berkas kosong.");
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffMime(buf);
  if (!mime || !ACCEPTED_MIME.includes(mime as (typeof ACCEPTED_MIME)[number])) {
    throw new Error("Format tidak didukung. Gunakan JPG, PNG, WebP, HEIC, atau PDF.");
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  // Nama berkas selalu UUID buatan server: nama asli dari klien tidak pernah
  // menyentuh filesystem, jadi tidak ada jalan untuk path traversal.
  const id = randomUUID();
  const originalName = path.basename(file.name || "bukti").slice(0, 120);

  if (mime === "application/pdf") {
    const fileName = `${id}.pdf`;
    await fs.writeFile(path.join(UPLOAD_DIR, fileName), buf);
    return {
      fileName,
      thumbName: null,
      mimeType: mime,
      sizeBytes: buf.byteLength,
      originalName,
    };
  }

  const fileName = `${id}.webp`;
  const thumbName = `${id}_thumb.webp`;

  const full = await sharp(buf, { failOn: "none" })
    .rotate()
    .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  const thumb = await sharp(buf, { failOn: "none" })
    .rotate()
    .resize({ width: 400, height: 400, fit: "cover" })
    .webp({ quality: 70 })
    .toBuffer();

  await fs.writeFile(path.join(UPLOAD_DIR, fileName), full);
  await fs.writeFile(path.join(UPLOAD_DIR, thumbName), thumb);

  return {
    fileName,
    thumbName,
    mimeType: "image/webp",
    sizeBytes: full.byteLength,
    originalName,
  };
}

/** Membaca berkas tersimpan. Nama divalidasi ketat sebelum menyentuh disk. */
export async function readStoredFile(fileName: string): Promise<Buffer> {
  if (!/^[a-f0-9-]{36}(_thumb)?\.(webp|pdf)$/.test(fileName)) {
    throw new Error("Nama berkas tidak valid.");
  }
  return fs.readFile(path.join(UPLOAD_DIR, fileName));
}

export async function deleteStoredFile(fileName: string | null) {
  if (!fileName) return;
  try {
    await fs.unlink(path.join(UPLOAD_DIR, fileName));
  } catch {
    // Berkas sudah tidak ada — bukan alasan untuk menggagalkan penghapusan baris.
  }
}
