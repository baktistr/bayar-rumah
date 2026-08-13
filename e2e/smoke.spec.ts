import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/**
 * Uji alur nyata lewat browser: login kedua peran, catat pembayaran beserta
 * bukti transfer, dan pastikan saldo ikut berubah. Dijalankan terhadap
 * container produksi, bukan dev server.
 */

const ADMIN = { username: "admin", password: "rahasia12345", newPassword: "adminBaru123" };
const VIEWER = { username: "ibu", password: "ibu12345678", newPassword: "ibuBaru12345" };

async function submitLogin(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
}

async function login(page: Page, username: string, password: string) {
  await submitLogin(page, username, password);
  // Menunggu sampai benar-benar meninggalkan /login. Tanpa ini, navigasi
  // berikutnya bisa berangkat sebelum cookie sesi terpasang, dan halaman
  // yang dituju memantulkan balik ke login.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/** Layar ganti password wajib muncul sekali pada login pertama. */
async function passFirstLogin(page: Page, current: string, next: string) {
  await expect(page.getByRole("heading", { name: /Halo/ })).toBeVisible();
  await page.getByLabel("Password saat ini").fill(current);
  await page.getByLabel("Password baru", { exact: true }).fill(next);
  await page.getByLabel("Ulangi password baru").fill(next);
  await page.getByRole("button", { name: "Simpan password baru" }).click();
}

test.describe.configure({ mode: "serial" });

test("gerbang auth menolak pengunjung tanpa sesi", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/riwayat");
  await expect(page).toHaveURL(/\/login\?next=%2Friwayat/);

  // Bukti transfer dan cadangan database tidak boleh bocor tanpa sesi.
  // maxRedirects: 0 penting — kalau redirect diikuti, yang terbaca adalah
  // status 200 milik halaman login dan pemeriksaan ini jadi tidak berarti.
  for (const url of ["/api/bukti/1", "/api/backup", "/api/export"]) {
    const res = await page.request.get(url, { maxRedirects: 0 });
    expect(res.status(), `${url} harus ditahan`).toBe(307);
    expect(res.headers().location).toContain("/login");
  }
});

test("password salah ditolak", async ({ page }) => {
  await submitLogin(page, "admin", "passwordSalah");
  await expect(page.getByText("Username atau password salah.")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("admin: login pertama, ganti password, lihat saldo awal", async ({ page }) => {
  await login(page, ADMIN.username, ADMIN.password);
  await passFirstLogin(page, ADMIN.password, ADMIN.newPassword);

  await expect(page.getByText("Sisa hutang")).toBeVisible();
  await expect(page.getByText("Rp 1.108.550.000").first()).toBeVisible();
  await expect(page.getByText("3,4%")).toBeVisible();
  await expect(page.getByText(/Lunas Juni 2045|Juni 2045/)).toBeVisible();
});

test("admin: catat pembayaran dengan bukti, saldo berkurang", async ({ page }) => {
  await login(page, ADMIN.username, ADMIN.newPassword);
  await expect(page.getByText("Rp 1.108.550.000").first()).toBeVisible();

  await page.goto("/input");
  await page.getByRole("button", { name: "10 jt" }).click();

  const bukti = path.join(os.tmpdir(), "bukti-test.png");
  fs.writeFileSync(
    bukti,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ),
  );
  await page.locator('input[name="bukti"]').setInputFiles(bukti);
  await page.getByRole("button", { name: "Simpan pembayaran" }).click();

  // Diarahkan ke halaman detail transaksi yang baru dibuat.
  await expect(page).toHaveURL(/\/riwayat\/\d+/);
  await expect(page.getByText("Rp 10.000.000").first()).toBeVisible();
  await expect(page.getByRole("img", { name: /bukti-test/i })).toBeVisible();

  // 1.108.550.000 - 10.000.000
  await page.goto("/");
  await expect(page.getByText("Rp 1.098.550.000").first()).toBeVisible();
});

test("admin: buat jadwal rencana tidak mengurangi saldo riil", async ({ page }) => {
  await login(page, ADMIN.username, ADMIN.newPassword);
  await page.goto("/input");
  await page.getByRole("tab", { name: "Buat jadwal" }).click();
  await page.getByRole("button", { name: "Buat jadwal" }).click();

  await expect(page).toHaveURL(/status=RENCANA/);
  await expect(page.getByText("rencana").first()).toBeVisible();

  await page.goto("/");
  // Saldo riil tidak berubah; yang muncul adalah baris proyeksi terpisah.
  await expect(page.getByText("Rp 1.098.550.000").first()).toBeVisible();
  await expect(page.getByText("Sisa bila semua rencana terbayar")).toBeVisible();
});

test("viewer: hanya bisa melihat, tidak bisa menulis", async ({ page }) => {
  await login(page, VIEWER.username, VIEWER.password);
  await passFirstLogin(page, VIEWER.password, VIEWER.newPassword);

  await expect(page.getByText("Rp 1.098.550.000").first()).toBeVisible();
  await expect(page.getByText("hanya lihat")).toBeVisible();

  // Tombol tambah tidak ada di navigasi.
  await expect(page.getByLabel("Tambah pembayaran")).toHaveCount(0);

  // Dan mengetik URL-nya langsung tetap ditolak.
  for (const url of ["/input", "/pengaturan"]) {
    await page.goto(url);
    expect(new URL(page.url()).pathname, `${url} harus dialihkan`).toBe("/");
  }

  // Cadangan database khusus admin: viewer punya sesi, jadi lolos proxy,
  // dan route-nya sendiri yang menolak.
  const backup = await page.request.get("/api/backup", { maxRedirects: 0 });
  expect(backup.status()).toBe(404);
});

test("viewer: bisa membuka bukti transfer dan riwayat", async ({ page }) => {
  await login(page, VIEWER.username, VIEWER.newPassword);
  await page.goto("/riwayat");
  await expect(page.getByText("Cicilan 11")).toBeVisible();
  await expect(page.getByText("pra-catat").first()).toBeVisible();

  const csv = await page.request.get("/api/export");
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain("cicilan_ke");
});

test("proyeksi: simulator mengubah tanggal lunas", async ({ page }) => {
  await login(page, ADMIN.username, ADMIN.newPassword);
  await page.goto("/proyeksi");

  await expect(page.getByText(/Lunas .* 20\d\d/)).toBeVisible();

  const slider = page.getByRole("slider").first();
  await slider.focus();
  // Setiap tekan panah menambah Rp 500.000; 10 kali = +5 jt/bulan.
  for (let i = 0; i < 10; i += 1) await slider.press("ArrowRight");

  await expect(page.getByText(/lebih cepat/)).toBeVisible();
});
