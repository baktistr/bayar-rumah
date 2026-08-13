/**
 * Kompresi bukti transfer di peramban, sebelum dikirim ke server.
 *
 * Ini penghematan terbesar untuk VPS kecil. Tanpa ini, foto 4 MB dikirim utuh
 * lalu server harus membongkarnya jadi ~36 MB piksel mentah di memori hanya
 * untuk mengecilkannya. Dengan ini, yang sampai ke server sudah ~200 KB:
 * unggahannya cepat di kuota HP, dan sharp di server nyaris tidak bekerja.
 *
 * Server TETAP mengompresi ulang. Ini optimasi, bukan pengaman — berkas dari
 * klien tidak pernah dipercaya begitu saja.
 */

const MAKS_SISI = 1600;
const KUALITAS = 0.82;
/** Di bawah ini tidak perlu diapa-apakan; ongkos encode-nya tidak sepadan. */
const AMBANG_LEWATI = 400 * 1024;

export type HasilKompresi = {
  file: File;
  dikompresi: boolean;
  ukuranAsli: number;
};

export async function compressImage(file: File): Promise<HasilKompresi> {
  const asli = { file, dikompresi: false, ukuranAsli: file.size };

  // PDF diteruskan apa adanya, dan berkas kecil tidak perlu disentuh.
  if (file.type === "application/pdf" || file.size <= AMBANG_LEWATI) return asli;

  try {
    // createImageBitmap membongkar gambar di luar thread utama, jadi antarmuka
    // tidak membeku saat memproses foto besar. imageOrientation menerapkan
    // rotasi EXIF supaya foto potret tidak tersimpan miring.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

    const skala = Math.min(1, MAKS_SISI / Math.max(bitmap.width, bitmap.height));
    const lebar = Math.round(bitmap.width * skala);
    const tinggi = Math.round(bitmap.height * skala);

    const canvas = document.createElement("canvas");
    canvas.width = lebar;
    canvas.height = tinggi;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return asli;
    }
    ctx.drawImage(bitmap, 0, 0, lebar, tinggi);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", KUALITAS),
    );
    canvas.width = 0;
    canvas.height = 0;

    // Kalau hasilnya justru lebih besar (mis. gambar sudah sangat teroptimasi),
    // kirim yang asli saja.
    if (!blob || blob.size >= file.size) return asli;

    const nama = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return {
      file: new File([blob], nama, { type: "image/jpeg", lastModified: Date.now() }),
      dikompresi: true,
      ukuranAsli: file.size,
    };
  } catch {
    // Format yang tidak bisa dibongkar peramban (mis. HEIC di Android) jatuh
    // ke berkas asli — server masih bisa menanganinya lewat sharp.
    return asli;
  }
}

/**
 * Mengompresi seluruh pilihan lalu menuliskannya kembali ke <input type="file">,
 * sehingga formulir mengirim versi yang sudah kecil tanpa perlu menyusun
 * FormData sendiri.
 */
export async function compressFileInput(input: HTMLInputElement): Promise<{
  files: File[];
  totalAsli: number;
  totalBaru: number;
}> {
  const dipilih = Array.from(input.files ?? []);
  if (dipilih.length === 0) return { files: [], totalAsli: 0, totalBaru: 0 };

  const hasil = await Promise.all(dipilih.map(compressImage));

  const dt = new DataTransfer();
  for (const h of hasil) dt.items.add(h.file);
  input.files = dt.files;

  return {
    files: hasil.map((h) => h.file),
    totalAsli: hasil.reduce((s, h) => s + h.ukuranAsli, 0),
    totalBaru: hasil.reduce((s, h) => s + h.file.size, 0),
  };
}
