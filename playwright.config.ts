import { defineConfig, devices } from "@playwright/test";

/**
 * Diarahkan ke container produksi (lihat README), bukan dev server —
 * yang diuji harus artefak yang benar-benar dijalankan di VPS.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    // Meniru layar HP: aplikasi ini dipakai dari ponsel, bukan desktop.
    ...devices["Pixel 7"],
  },
  projects: [{ name: "mobile-chrome" }],
});
