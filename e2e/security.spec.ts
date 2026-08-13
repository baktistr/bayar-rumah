import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Uji regresi keamanan. Setiap kasus di sini pernah gagal sungguhan saat
 * penilaian pra-deploy, jadi jangan dihapus tanpa alasan kuat.
 *
 * URUTAN PENTING. Rangkaian ini berbagi satu container, dan rate limiter
 * menyimpan hitungannya di memori proses selama 15 menit. Uji brute force
 * karena itu ditaruh paling akhir — kalau dijalankan lebih dulu, ia mengunci
 * akun admin dan membuat uji-uji sesudahnya gagal karena alasan yang salah.
 */

const ADMIN = { username: "admin", password: "kemuning-batu-3391" };
const PASSWORD_BARU = "belimbing-tua-4408";

test.describe.configure({ mode: "serial" });

async function isiLogin(page: Page, username: string, password: string) {
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
}

test("parameter ?next= tidak bisa membawa pengguna keluar situs", async ({
  page,
  baseURL,
}) => {
  const hostAsli = new URL(baseURL!).host;

  // `/\example.com` lolos dari pemeriksaan startsWith("//") yang naif, dan
  // browser menormalkan backslash jadi garis miring sehingga hasilnya
  // protocol-relative — pengguna terlempar keluar tepat setelah mengetik
  // password.
  await page.goto(`/login?next=${encodeURIComponent("/\\example.com")}`);
  await isiLogin(page, ADMIN.username, ADMIN.password);
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));

  const mendarat = new URL(page.url());
  expect(mendarat.host, "tidak boleh keluar ke domain lain").toBe(hostAsli);
  expect(mendarat.pathname, "tujuan mencurigakan harus jatuh ke beranda").toBe("/");
});

test("header keamanan terpasang di setiap respons", async ({ page }) => {
  await page.goto("/login");
  await isiLogin(page, ADMIN.username, ADMIN.password);
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));

  const res = await page.request.get("/", { maxRedirects: 0 });
  const h = res.headers();
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("no-referrer");
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["content-security-policy"]).toContain("object-src 'none'");
  expect(h["content-security-policy"]).toContain("base-uri 'self'");
  // HSTS dulu disetel di Caddyfile. Begitu deployment pindah ke proxy lain,
  // header itu hilang tanpa suara — dan memang sempat hilang di produksi.
  // Sekarang aplikasi yang menetapkannya, dan uji ini yang menjaganya.
  expect(h["strict-transport-security"]).toContain("max-age=31536000");
  expect(h["x-powered-by"], "versi framework tidak perlu diumumkan").toBeUndefined();
});

test("ganti password mencabut sesi di perangkat lain", async ({ browser }) => {
  const perangkatA = await browser.newContext();
  const perangkatB = await browser.newContext();
  const a = await perangkatA.newPage();
  const b = await perangkatB.newPage();

  for (const page of [a, b]) {
    await page.goto("/login");
    await isiLogin(page, ADMIN.username, ADMIN.password);
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  }

  // Perangkat A mengganti password lewat layar wajib-ganti pada login pertama.
  await a.getByLabel("Password saat ini").fill(ADMIN.password);
  await a.getByLabel("Password baru", { exact: true }).fill(PASSWORD_BARU);
  await a.getByLabel("Ulangi password baru").fill(PASSWORD_BARU);
  await a.getByRole("button", { name: "Simpan password baru" }).click();
  // Layar wajib-ganti tidak menampilkan pesan sukses; ia langsung me-refresh
  // ke aplikasi, jadi munculnya dashboard itulah tanda berhasilnya.
  await expect(a.getByText("Sisa hutang")).toBeVisible();

  // A tetap masuk — yang mengganti password tidak ikut terlempar…
  await a.goto("/riwayat");
  expect(new URL(a.url()).pathname).toBe("/riwayat");

  // …sedangkan token lama di perangkat B sudah tidak berlaku.
  await b.goto("/riwayat");
  await expect(b, "token lama harus dicabut, bukan tetap sah").toHaveURL(/\/login/);

  await perangkatA.close();
  await perangkatB.close();
});

test("CF-Connecting-IP dipakai sebagai alamat pengunjung, bukan X-Forwarded-For", async ({
  browser,
}) => {
  // Di belakang Cloudflare, entri terakhir X-Forwarded-For adalah IP edge
  // Cloudflare — sama untuk semua pengunjung. Kalau itu yang dipakai sebagai
  // kunci, jatah per-IP jadi satu ember bersama dan salah ketik password
  // beberapa kali bisa mengunci seisi keluarga.
  //
  // Di sini CF-Connecting-IP dibuat TETAP sementara X-Forwarded-For diganti
  // tiap percobaan. Kalau aplikasi mendahulukan CF-Connecting-IP, batas
  // per-IP (5) akan menahan sebelum percobaan ke-7. Kalau ia masih memakai
  // X-Forwarded-For, tiap percobaan dianggap alamat baru dan tidak ada yang
  // tertahan sampai batas per-username (10).
  const pesan: string[] = [];
  for (let i = 1; i <= 7; i += 1) {
    const ctx = await browser.newContext({
      extraHTTPHeaders: {
        "CF-Connecting-IP": "198.51.100.77",
        "X-Forwarded-For": `203.0.113.${i}, 172.16.0.${i}`,
      },
    });
    const page = await ctx.newPage();
    await page.goto("/login");
    // Username yang tidak terdaftar, supaya jatah akun asli tidak terpakai.
    await isiLogin(page, "bukansiapasiapa", `tebakan-${i}`);
    pesan.push(
      (await page
        .locator('p[role="alert"]')
        .textContent({ timeout: 5000 })
        .catch(() => "")) ?? "",
    );
    await ctx.close();
  }

  const tertahan = pesan.findIndex((m) => /Terlalu banyak percobaan/.test(m));
  expect(
    tertahan,
    "batas per-IP harus kena — berarti CF-Connecting-IP yang dipakai",
  ).toBeGreaterThanOrEqual(0);
  expect(
    tertahan,
    "kalau baru tertahan setelah 10, berarti masih memakai X-Forwarded-For",
  ).toBeLessThan(7);
});

test("brute force satu akun tertahan walau X-Forwarded-For dipalsukan", async ({
  browser,
}: {
  browser: Browser;
}) => {
  const pesan: string[] = [];

  for (let i = 1; i <= 12; i += 1) {
    // Tiap percobaan menyamar sebagai IP berbeda, sehingga batas per-IP tidak
    // pernah kena. Yang harus menangkapnya adalah batas per-username.
    const ctx = await browser.newContext({
      extraHTTPHeaders: { "X-Forwarded-For": `203.0.113.${i}` },
    });
    const page = await ctx.newPage();
    await page.goto("/login");
    await isiLogin(page, ADMIN.username, `tebakan-${i}`);
    pesan.push(
      (await page
        .locator('p[role="alert"]')
        .textContent({ timeout: 5000 })
        .catch(() => "")) ?? "",
    );
    await ctx.close();
  }

  expect(
    pesan.some((m) => /Terlalu banyak percobaan/.test(m)),
    "penyerang yang memutar IP tiap request harus tetap tertahan",
  ).toBe(true);
});
