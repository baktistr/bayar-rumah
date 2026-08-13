import { expect, test, type Page } from "@playwright/test";

/**
 * Manajemen pengguna, dengan penekanan pada cara-cara mengunci diri sendiri
 * keluar dari aplikasi. Aplikasi ini tidak punya panel pemulihan: kalau admin
 * terakhir hilang, satu-satunya jalan adalah mengutak-atik database di server.
 */

const ADMIN = { username: "admin", password: "kemuning-batu-3391" };

test.describe.configure({ mode: "serial" });

async function loginSebagaiAdmin(page: Page, password = ADMIN.password) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(ADMIN.username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

async function buatPengguna(
  page: Page,
  nama: string,
  username: string,
  password: string,
  peran: "Hanya lihat" | "Admin" = "Hanya lihat",
) {
  await page.goto("/pengguna");
  await page.getByRole("button", { name: "Tambah pengguna" }).click();
  await page.getByLabel("Nama").fill(nama);
  await page.getByLabel("Username").fill(username);
  if (peran === "Admin") {
    await page.getByLabel("Peran").click();
    await page.getByRole("option", { name: "Admin" }).click();
  }
  await page.getByLabel("Password sementara").fill(password);
  await page.getByRole("button", { name: "Buat pengguna" }).click();
}

test("seed hanya membuat admin, tidak ada akun lain", async ({ page }) => {
  await loginSebagaiAdmin(page);
  // Login pertama menahan di layar ganti password.
  await page.getByLabel("Password saat ini").fill(ADMIN.password);
  await page.getByLabel("Password baru", { exact: true }).fill("lentera-pagi-5520");
  await page.getByLabel("Ulangi password baru").fill("lentera-pagi-5520");
  await page.getByRole("button", { name: "Simpan password baru" }).click();
  await expect(page.getByText("Sisa hutang")).toBeVisible();

  await page.goto("/pengguna");
  await expect(page.getByText("1 akun aktif")).toBeVisible();
});

test("username duplikat ditolak", async ({ page }) => {
  await loginSebagaiAdmin(page, "lentera-pagi-5520");
  await buatPengguna(page, "Duplikat", ADMIN.username, "gerimis-pualam-8811");
  await expect(page.getByText(/sudah dipakai/)).toBeVisible();
});

test("password lemah untuk pengguna baru ditolak", async ({ page }) => {
  await loginSebagaiAdmin(page, "lentera-pagi-5520");

  // Panjangnya sudah lolos syarat 12 karakter — jadi peramban meloloskannya
  // dan yang harus menangkap adalah aturan di server. Memakai password pendek
  // di sini justru tidak menguji apa-apa: input akan ditolak minLength lebih
  // dulu dan action-nya tidak pernah dipanggil.
  await buatPengguna(page, "Lemah", "lemah", "ganteng-sekali-2026");
  await expect(page.getByText(/mudah ditebak/)).toBeVisible();

  // Dan akunnya memang tidak terbuat.
  await page.goto("/pengguna");
  await expect(page.locator('[data-user="lemah"]')).toHaveCount(0);
});

test("viewer yang dibuat harus ganti password dan tidak bisa menulis", async ({
  browser,
}) => {
  const ctxAdmin = await browser.newContext();
  const admin = await ctxAdmin.newPage();
  await loginSebagaiAdmin(admin, "lentera-pagi-5520");
  await buatPengguna(admin, "Ibu", "ibu", "serambi-hujan-8172");
  await expect(admin.getByText("@ibu")).toBeVisible();
  await ctxAdmin.close();

  const ctxIbu = await browser.newContext();
  const ibu = await ctxIbu.newPage();
  await ibu.goto("/login");
  await ibu.getByLabel("Username").fill("ibu");
  await ibu.getByLabel("Password").fill("serambi-hujan-8172");
  await ibu.getByRole("button", { name: "Masuk" }).click();

  // Password dari admin bersifat sementara — wajib diganti pemiliknya.
  await expect(ibu.getByRole("heading", { name: /Halo/ })).toBeVisible();
  await ibu.getByLabel("Password saat ini").fill("serambi-hujan-8172");
  await ibu.getByLabel("Password baru", { exact: true }).fill("kopi-sore-7734");
  await ibu.getByLabel("Ulangi password baru").fill("kopi-sore-7734");
  await ibu.getByRole("button", { name: "Simpan password baru" }).click();
  await expect(ibu.getByText("Sisa hutang")).toBeVisible();

  // Viewer tidak boleh menyentuh menu pengguna, walau URL-nya diketik manual.
  await ibu.goto("/pengguna");
  expect(new URL(ibu.url()).pathname).toBe("/");
  await ctxIbu.close();
});

test("menonaktifkan akun langsung memutus sesinya", async ({ browser }) => {
  const ctxIbu = await browser.newContext();
  const ibu = await ctxIbu.newPage();
  await ibu.goto("/login");
  await ibu.getByLabel("Username").fill("ibu");
  await ibu.getByLabel("Password").fill("kopi-sore-7734");
  await ibu.getByRole("button", { name: "Masuk" }).click();
  await ibu.waitForURL((url) => !url.pathname.startsWith("/login"));

  const ctxAdmin = await browser.newContext();
  const admin = await ctxAdmin.newPage();
  await loginSebagaiAdmin(admin, "lentera-pagi-5520");
  await admin.goto("/pengguna");
  admin.on("dialog", (d) => d.accept());
  await admin
    .locator('[data-user="ibu"]')
    .getByRole("button", { name: "Nonaktifkan" })
    .click();
  // Dicocokkan pada kalimat toast-nya, bukan kata "dinonaktifkan" saja —
  // kata itu juga muncul di kartu penjelasan di bawah halaman.
  await expect(admin.getByText(/Akun "Ibu" dinonaktifkan/)).toBeVisible();

  // Sesi yang sedang berjalan harus mati saat itu juga, bukan menunggu token
  // kedaluwarsa — inilah gunanya memeriksa status akun tiap request.
  await ibu.goto("/riwayat");
  await expect(ibu).toHaveURL(/\/login/);

  // Dan tentu saja tidak bisa login lagi.
  await ibu.getByLabel("Username").fill("ibu");
  await ibu.getByLabel("Password").fill("kopi-sore-7734");
  await ibu.getByRole("button", { name: "Masuk" }).click();
  await expect(ibu.getByText("Username atau password salah.")).toBeVisible();

  await ctxIbu.close();
  await ctxAdmin.close();
});

test("admin terakhir tidak bisa mengunci dirinya sendiri keluar", async ({ page }) => {
  await loginSebagaiAdmin(page, "lentera-pagi-5520");
  await page.goto("/pengguna");

  const kartuSendiri = page.locator('[data-user="admin"]');
  await expect(kartuSendiri.getByText("kamu")).toBeVisible();

  // Tombol nonaktifkan mati untuk akun sendiri.
  await expect(
    kartuSendiri.getByRole("button", { name: "Nonaktifkan" }),
  ).toBeDisabled();

  // Pagar yang sebenarnya ada di server: menurunkan peran sendiri ditolak,
  // bukan sekadar disembunyikan dari UI.
  await kartuSendiri.getByRole("button", { name: "Ubah" }).click();
  await page.getByLabel("Peran").click();
  await page.getByRole("option", { name: "Hanya lihat" }).click();
  await page.getByRole("button", { name: "Simpan" }).click();

  await expect(page.getByText(/menurunkan peranmu sendiri|satu-satunya admin/)).toBeVisible();

  // Dan perannya memang tidak berubah.
  await page.goto("/pengguna");
  await expect(
    page.locator('[data-user="admin"]').getByText("Hanya lihat"),
    "admin terakhir tidak boleh berhasil turun peran",
  ).toHaveCount(0);
});
