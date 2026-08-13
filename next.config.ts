import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Menghasilkan server mandiri berisi hanya dependency yang benar-benar
  // dipakai — image Docker jauh lebih kecil daripada menyalin node_modules.
  output: "standalone",

  // Keduanya modul native/biner; bundler harus membiarkannya di-require
  // apa adanya saat runtime.
  serverExternalPackages: ["better-sqlite3", "sharp"],

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
        ],
      },
    ];
  },
};

export default nextConfig;
