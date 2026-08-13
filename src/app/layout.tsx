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
  appleWebApp: { capable: true, title: "BayarRumah", statusBarStyle: "default" },
  // Aplikasi keluarga di balik login — tidak ada gunanya diindeks mesin pencari.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#101619" },
  ],
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
 */
const themeScript = `
(function() {
  try {
    var stored = localStorage.getItem("br-theme");
    var dark = stored ? stored === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (dark) document.documentElement.classList.add("dark");
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
