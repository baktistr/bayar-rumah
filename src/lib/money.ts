/** Semua fungsi di sini bekerja pada integer rupiah penuh. */

export function formatIDR(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
}

/** Tanpa prefix "Rp", untuk dipakai di dalam kalimat atau input. */
export function formatNumber(amount: number): string {
  return Math.round(amount).toLocaleString("id-ID");
}

/**
 * Persentase dalam format Indonesia: pemisah desimal koma, bukan titik.
 * `toFixed()` selalu memakai titik apa pun lokalnya, jadi tidak bisa dipakai
 * untuk teks yang dibaca pengguna.
 */
export function formatPercent(value: number, digits = 1): string {
  return `${value.toLocaleString("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

/**
 * Versi ringkas untuk sumbu grafik dan layar sempit.
 * 1_108_550_000 -> "1,11 M" | 39_000_000 -> "39 jt" | 500_000 -> "500 rb"
 */
export function formatCompactIDR(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  const trim = (n: number, digits: number) =>
    n.toLocaleString("id-ID", {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    });

  if (abs >= 1_000_000_000) return `${sign}${trim(abs / 1_000_000_000, 2)} M`;
  if (abs >= 1_000_000) return `${sign}${trim(abs / 1_000_000, 1)} jt`;
  if (abs >= 1_000) return `${sign}${trim(abs / 1_000, 0)} rb`;
  return `${sign}${trim(abs, 0)}`;
}

/**
 * Menerima apa pun yang diketik user ("5.000.000", "5000000", "Rp 5.000.000")
 * dan mengembalikan integer rupiah. Non-digit dibuang seluruhnya — tidak ada
 * penanganan desimal karena aplikasi ini hanya memakai rupiah bulat.
 */
export function parseIDR(input: string): number {
  const digits = input.replace(/\D/g, "");
  if (!digits) return 0;
  return Number.parseInt(digits, 10);
}

/** Untuk input terkontrol: mengetik "5000000" tampil jadi "5.000.000". */
export function formatIDRInput(input: string): string {
  const value = parseIDR(input);
  return value === 0 && input.replace(/\D/g, "") === "" ? "" : formatNumber(value);
}

/** "1.108.550.000" -> "satu miliar seratus delapan juta ..." — dipakai di layar konfirmasi. */
export function terbilangSingkat(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) {
    const m = abs / 1_000_000_000;
    return `${m.toLocaleString("id-ID", { maximumFractionDigits: 2 })} miliar`;
  }
  if (abs >= 1_000_000) {
    const j = abs / 1_000_000;
    return `${j.toLocaleString("id-ID", { maximumFractionDigits: 1 })} juta`;
  }
  if (abs >= 1_000) return `${Math.round(abs / 1_000)} ribu`;
  return formatNumber(abs);
}
