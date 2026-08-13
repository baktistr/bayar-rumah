import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Menghasilkan server mandiri berisi hanya dependency yang benar-benar
  // dipakai — image Docker jauh lebih kecil daripada menyalin node_modules.
  output: "standalone",

  // Keduanya modul native/biner; bundler harus membiarkannya di-require
  // apa adanya saat runtime.
  serverExternalPackages: ["better-sqlite3", "sharp"],

  // Tidak perlu mengumumkan framework dan versinya ke pemindai otomatis.
  poweredByHeader: false,

  /**
   * Batas bawaan body Server Action adalah 1 MB, dan bukti transfer dikirim
   * lewat Server Action. Foto kamera HP umumnya 2–5 MB, jadi dengan nilai
   * bawaan praktis SEMUA unggahan foto asli gagal dengan 413 — fitur inti
   * aplikasi ini. Nilainya disetel di atas batas 10 MB milik aplikasi supaya
   * berkas yang terlalu besar ditolak oleh validasi kita (dengan pesan yang
   * bisa dibaca) alih-alih oleh framework (dengan 413 mentah).
   */
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "geolocation=(), microphone=()" },
          // Aplikasi keluarga berisi data keuangan — jangan sampai muncul di
          // hasil pencarian bila suatu saat domainnya terekspos.
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          {
            // Pertahanan berlapis. 'unsafe-inline' pada script terpaksa ada
            // karena Next menyisipkan skrip inline (termasuk penentu tema);
            // menghilangkannya butuh nonce per request. Nilai selebihnya tetap
            // menutup jalur paling berguna bagi penyerang: memuat skrip dari
            // domain lain, menyuntik <base>, membingkai halaman, dan
            // mengirim data keluar lewat fetch.
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
