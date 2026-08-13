#!/bin/sh
set -e

if [ -z "$AUTH_SECRET" ]; then
  echo "FATAL: AUTH_SECRET belum diset."
  echo "Buat dengan: openssl rand -base64 32"
  exit 1
fi

# Migrasi Drizzle mencatat sendiri apa yang sudah dijalankan, dan seed hanya
# mengisi tabel yang masih kosong — jadi ini aman diulang tiap container start.
echo "→ Menyiapkan database…"
node /app/dist/bootstrap.cjs

echo "→ Menjalankan server…"
exec "$@"
