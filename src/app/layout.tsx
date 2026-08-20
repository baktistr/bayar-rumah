import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "BayarRumah",
  description: "Monitoring pembayaran rumah",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "BayarRumah", statusBarStyle: "black-translucent" },
  // Aplikasi keluarga di balik login — tidak ada gunanya diindeks mesin pencari.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // Satu warna saja, mengikuti tema bawaan yang terang. Menautkannya ke
  // preferensi sistem akan membuat bilah browser gelap sementara halamannya
  // terang — sambungan yang justru terlihat salah.
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  // Zoom tetap diizinkan: bukti transfer perlu diperbesar, dan mengunci
  // zoom menyulitkan pengguna yang matanya sudah tidak setajam dulu.
  maximumScale: 5,
  viewportFit: "cover",
};

/**
 * Dijalankan sebelum paint pertama supaya tema gelap tidak berkedip putih
 * sesaat saat halaman dibuka.
 *
 * Bawaannya TERANG, bukan mengikuti preferensi sistem. Banyak ponsel menyalakan
 * mode gelap otomatis di malam hari, dan pengguna yang tidak pernah sengaja
 * memilihnya akan mendapati aplikasi ini berubah rupa sendiri — membingungkan
 * untuk sesuatu yang dibuka sebulan sekali. Tema gelap tetap ada, tapi harus
 * dipilih lewat tombol di header, dan pilihan itu diingat.
 */
const themeScript = `
(function() {
  try {
    if (localStorage.getItem("br-theme") === "dark") {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${sans.variable} antialiased`}>
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
