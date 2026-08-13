/**
 * Manifest PWA supaya aplikasi bisa "Add to Home Screen" dan terbuka
 * tanpa address bar — penting untuk pengguna yang membukanya tiap bulan.
 */
export function GET() {
  return Response.json({
    name: "BayarRumah",
    short_name: "BayarRumah",
    description: "Monitoring pembayaran rumah",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f766e",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  });
}
