# BayarRumah

Aplikasi monitoring pembayaran rumah ke mertua. Mobile-first, self-hosted di
Docker, dua pengguna: **admin** (mencatat) dan **viewer** (melihat).

Rancangan lengkap dan alasan di balik keputusannya ada di [PLAN.md](PLAN.md).

---

## Konsep yang perlu dipahami dulu

**Setiap transaksi punya status `LUNAS` atau `RENCANA`.** Ini inti aplikasinya.
Catatan manual sebelumnya mencampur "sudah ditransfer" dengan "dijadwalkan",
sehingga angka Rp 1.108.550.000 yang tertulis sebagai posisi 13 Agustus 2026
sebenarnya adalah proyeksi setelah cicilan Desember 2026.

Di aplikasi:

- **Sisa hutang** hanya menghitung baris `LUNAS`.
- **Sisa bila semua rencana terbayar** menghitung `RENCANA` juga, ditampilkan
  terpisah dan tidak pernah dicampur.

Seed awal memuat cicilan 9–15 sebagai `LUNAS` sesuai catatan asli, jadi saldo
awal aplikasi = **Rp 1.108.550.000**. Baris yang tanggal transfernya masih di
depan diberi tanda `pra-catat` di Riwayat, dan bukti transfernya bisa dilampirkan
menyusul.

**Semua perubahan tercatat.** Menghapus transaksi tidak benar-benar menghapus
barisnya (soft delete), dan setiap pembuatan/perubahan masuk ke jejak audit yang
bisa dilihat kedua pengguna di halaman detail transaksi.

---

## Kebutuhan sumber daya

Diukur pada image produksi, bukan perkiraan:

| | |
|---|---|
| Image Docker | 297 MB |
| RAM saat idle | ~55 MB |
| RAM pemakaian normal | ~120–145 MB |
| RAM puncak (mengompresi foto 8 MB) | ~196 MB |
| CPU | ~0% idle, sekejap naik saat kompresi foto |
| Waktu proses unggah foto 8 MB | ~1 detik |

**VPS 1 GB RAM sudah lapang** — termasuk Caddy (~15 MB) dan sistem operasinya.
512 MB pun masih cukup, meski tanpa banyak ruang bernapas.

Disk: database berukuran beberapa ratus KB bahkan setelah ratusan transaksi.
Yang tumbuh adalah bukti transfer — sekitar 200–400 KB per foto setelah
dikompresi ke WebP. Untuk seluruh masa cicilan (±222 pembayaran), perkiraannya
di bawah 100 MB.

---

## Menjalankan di VPS

Prasyarat: Docker + Docker Compose, dan **A record domain sudah mengarah ke IP
VPS**. Caddy menerbitkan sertifikat lewat verifikasi HTTP-01, jadi kalau DNS
belum propagasi saat container pertama kali start, penerbitannya gagal.

```bash
git clone <repo> bayar-rumah && cd bayar-rumah

cp .env.example .env
# Isi AUTH_SECRET dan DOMAIN. Buat secret dengan:
openssl rand -base64 32

mkdir -p data
docker compose --profile proxy up -d --build
```

Buka `https://<DOMAIN>`. Login dengan kredensial dari `.env`; keduanya wajib
ganti password pada login pertama sebelum bisa masuk ke aplikasi.

Kalau `ADMIN_PASSWORD`/`VIEWER_PASSWORD` dikosongkan, password acak dibuat dan
dicetak **satu kali** ke log:

```bash
docker compose logs app | head -30
```

### Kalau uid host bukan 1000

Container menulis ke `./data` sebagai uid 1000. Cek uid Anda dengan `id -u`;
kalau berbeda, tambahkan ke `.env`:

```
PUID=1001
PGID=1001
```

### Tanpa domain (uji coba lokal)

```bash
docker compose up -d --build        # tanpa --profile proxy
```

Aplikasi tersedia di `http://127.0.0.1:3000`. Untuk HTTP polos, sesi butuh
`COOKIE_SECURE=false` di `.env` — jangan dipakai di server yang terekspos.

---

## Pengembangan lokal

```bash
npm install
cp .env.example .env.local        # isi AUTH_SECRET
npm run db:migrate                # migrasi + seed data awal
npm run dev
```

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Build produksi + bundel skrip bootstrap |
| `npm run db:migrate` | Jalankan migrasi lalu seed (idempoten) |
| `npm run db:generate` | Buat berkas migrasi baru setelah mengubah skema |
| `npm run check` | Cetak ringkasan ledger + uji konsistensi angka |
| `npm run e2e` | Uji end-to-end Playwright terhadap image Docker |
| `npx tsc --noEmit` | Typecheck |
| `npx eslint src` | Lint |

`npm run check` berguna setelah restore backup atau kapan pun angka di layar
terasa meragukan — ia membandingkan jumlah transaksi dengan total terbayar dan
jumlah jadwal proyeksi dengan sisa hutang.

---

## Cadangan

Semua state ada di satu folder: `./data` (`app.db` + `uploads/`).

```bash
./scripts/backup.sh
```

Membuat snapshot konsisten via `VACUUM INTO` — bukan menyalin `app.db` mentah,
yang bisa kehilangan transaksi terbaru karena SQLite berjalan dalam mode WAL —
plus arsip bukti transfer. Hasilnya di `data/backups/`, disimpan 30 hari.

Untuk cadangan harian otomatis, pasang di cron host:

```
0 2 * * * cd /srv/bayar-rumah && ./scripts/backup.sh >> data/backup.log 2>&1
```

Admin juga bisa mengunduh cadangan sewaktu-waktu lewat **Akun → Pengaturan**.

### Memulihkan

```bash
docker compose down
cp data/backups/app-YYYYMMDD-HHMMSS.db data/app.db
tar -xzf data/backups/uploads-YYYYMMDD-HHMMSS.tar.gz -C data
docker compose --profile proxy up -d
npm run check     # pastikan angkanya utuh
```

---

## Keamanan

Sesi dan akun:

- Password disimpan dengan **scrypt** (`node:crypto`), tanpa dependency eksternal.
- Aturan password mengikuti pendekatan NIST SP 800-63B: **minimal 12 karakter**
  plus daftar kata terlarang, bukan aturan komposisi (wajib simbol/angka/huruf
  besar). Aturan komposisi mendorong orang membuat `Password1!` — lolos syarat
  di atas kertas, tapi justru pola pertama yang ditebak mesin. Kata umum
  Indonesia (`ganteng`, `sayang`, `rahasia`, …), username sendiri, karakter
  berulang, dan urutan angka semuanya ditolak. Aturan yang sama berlaku untuk
  `ADMIN_PASSWORD`/`VIEWER_PASSWORD` di `.env`; nilai yang tidak lolos diganti
  password acak dan alasannya dicetak ke log container.
- Sesi berupa JWT di cookie `httpOnly`. Setiap request mencocokkan
  `session_version` di token dengan yang tercatat di database, sehingga
  **mengganti password langsung mencabut sesi di perangkat lain** — termasuk
  token yang sudah dicuri. Tanpa itu, JWT tetap sah sampai kedaluwarsa dan
  ganti password tidak mengusir siapa pun.
- Login dibatasi pada dua sumbu: **5 percobaan per IP** dan **10 per username**
  tiap 15 menit. Sumbu username yang menentukan — header `X-Forwarded-For` bisa
  dipalsukan, username yang sedang dibobol tidak bisa.
- Peran diperiksa di server pada setiap Server Action. Menyembunyikan tombol di
  UI tidak dianggap sebagai pengamanan.
- Tujuan redirect setelah login dibatasi daftar karakter yang diizinkan, bukan
  penolakan pola satu per satu.

Berkas dan data:

- Bukti transfer **tidak** disimpan di folder publik. Aksesnya lewat
  `/api/bukti/[id]` yang memeriksa sesi lebih dulu, dan menjawab 404 (bukan 403)
  bila tidak berhak, supaya keberadaan berkas pun tidak bocor.
- Unggahan divalidasi lewat magic bytes, bukan ekstensi atau `Content-Type` yang
  keduanya dikirim klien. Nama berkas diganti UUID buatan server, dan metadata
  EXIF termasuk koordinat GPS dibuang oleh sharp.
- PDF disajikan sebagai unduhan, bukan inline: penampil PDF bawaan browser
  menjalankan JavaScript, dan menampilkannya inline sama dengan menjalankan
  berkas unggahan pada origin aplikasi.

Transport dan header:

- HSTS diaktifkan di Caddy (tidak otomatis) dan cookie sesi bertanda `Secure`.
- Caddy **menimpa** `X-Forwarded-For` dengan IP peer sungguhan, bukan menambah
  ke rantai kiriman klien.
- CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`,
  `noindex`. Header `X-Powered-By` dimatikan.
- Tidak ada analytics atau telemetri pihak ketiga.

Regresi keamanan ini dikunci oleh `e2e/security.spec.ts` — jangan hapus kasusnya
tanpa alasan kuat; semuanya pernah gagal sungguhan.

### Yang tetap jadi tanggung jawab operasional

Aplikasinya tidak bisa menutup hal-hal ini untukmu:

1. **Cadangan tidak terenkripsi.** `data/backups/*.db` berisi seluruh ledger dan
   hash password. Kalau disalin ke penyimpanan awan, enkripsi dulu
   (`age` atau `gpg -c`).
2. **Kredensial awal tercetak di log container** bila dibuat acak. Setelah
   keduanya ganti password, bersihkan: `docker compose logs --no-log-prefix > /dev/null`
   atau putar ulang container dengan `docker compose up -d --force-recreate`.
3. **Amankan VPS-nya sendiri.** Aplikasi ini aman sejauh mesinnya aman: SSH
   dengan kunci saja (matikan login password), firewall hanya membuka 22/80/443,
   dan `unattended-upgrades` menyala.
4. **`AUTH_SECRET` jangan pernah masuk git.** Sudah ada di `.gitignore`;
   menggantinya akan mengeluarkan semua yang sedang login.
5. **Rate limit disimpan di memori proses**, jadi hitungannya reset tiap
   container restart. Cukup untuk satu instance; kalau nanti ada beberapa
   replika, ini harus pindah ke penyimpanan bersama.

---

## Struktur

```
src/
├─ app/
│  ├─ (app)/          Halaman di balik login: beranda, riwayat, input, proyeksi, akun
│  ├─ actions/        Server Actions — semua penulisan data lewat sini
│  ├─ api/            health, bukti (terproteksi), export CSV, backup
│  └─ login/
├─ components/        UI, termasuk charts/ dan komponen shadcn di ui/
├─ db/                Skema Drizzle, klien SQLite, migrasi, seed
├─ lib/               ledger (perhitungan saldo), projection (proyeksi lunas),
│                     money, period, auth, session, password, uploads, audit
└─ proxy.ts           Gerbang sesi tingkat request
e2e/                  Uji Playwright
drizzle/              Berkas migrasi SQL
```

Perhitungan inti terpisah dari database dan React: `lib/projection.ts` adalah
fungsi murni, sehingga simulator di halaman Proyeksi memakai kode yang sama
persis dengan proyeksi di server, tanpa duplikasi rumus.
