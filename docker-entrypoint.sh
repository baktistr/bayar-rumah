#!/bin/sh
set -e

# Panjang minimum diperiksa di sini, bukan dibiarkan meledak saat login
# pertama. Secret pendek berarti tanda tangan sesi bisa ditebak offline.
if [ "${#AUTH_SECRET}" -lt 32 ]; then
  echo "FATAL: AUTH_SECRET belum diset atau kurang dari 32 karakter."
  echo "Buat dengan: openssl rand -base64 32"
  exit 1
fi

# Migrasi Drizzle mencatat sendiri apa yang sudah dijalankan, dan seed hanya
# mengisi tabel yang masih kosong — jadi ini aman diulang tiap container start.
echo "→ Menyiapkan database…"
node /app/dist/bootstrap.cjs

echo "→ Menjalankan server…"
exec "$@"
