#!/usr/bin/env bash
# Menjalankan uji end-to-end terhadap image produksi.
#
# Rangkaian uji ini stateful — di dalamnya ada alur ganti password wajib pada
# login pertama, yang menurut definisinya hanya bisa terjadi sekali. Karena itu
# container dan folder datanya selalu dibuat ulang dari nol di sini, bukan
# dipakai ulang.
set -euo pipefail

NAME=bayar-rumah-e2e
PORT=${E2E_PORT:-3100}
DATA_DIR=$(mktemp -d)

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  rm -rf "$DATA_DIR"
}
trap cleanup EXIT

echo "→ Membangun image…"
docker build -t bayar-rumah:e2e . >/dev/null

# Angka di bawah adalah FIKSI untuk pengujian, bukan data sungguhan. Repositori
# ini sengaja tidak memuat nilai keuangan asli mana pun.
#
# Tiap berkas spec dijalankan terhadap container yang baru. Rangkaian uji ini
# mengubah password dan status login — dijalankan berurutan dalam satu container,
# spec yang belakangan akan mewarisi state milik spec sebelumnya.
run_spec() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  rm -rf "${DATA_DIR:?}"/* 2>/dev/null || true
  docker run -d --name "$NAME" \
    -p "127.0.0.1:${PORT}:3000" \
    -e AUTH_SECRET="$(openssl rand -base64 32)" \
    -e COOKIE_SECURE=false \
    -e BASELINE_AMOUNT=1000000000 \
    -e ORIGINAL_AMOUNT=1000000000 \
    -e BASELINE_DATE=2026-05-01 \
    -e BASELINE_INSTALLMENT_NO=8 \
    -e MONTHLY_TARGET=5000000 \
    -e DUE_DAY_OF_MONTH=5 \
    -e SEED_LEDGER='[{"type":"LUMP_SUM","amount":10000000,"period":"2026-05","day":1,"note":"Saldo awal disesuaikan."},{"installmentNo":9,"amount":5000000,"period":"2026-06"},{"installmentNo":10,"amount":5000000,"period":"2026-07"},{"installmentNo":11,"amount":5000000,"period":"2026-08"},{"installmentNo":12,"amount":5000000,"period":"2026-09"}]' \
    -e ADMIN_NAME=Bakti -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD=kemuning-batu-3391 \
    -e VIEWER_NAME=Ibu -e VIEWER_USERNAME=ibu -e VIEWER_PASSWORD=serambi-hujan-8172 \
    -v "${DATA_DIR}:/app/data" \
    bayar-rumah:e2e >/dev/null
  for _ in $(seq 1 60); do
    curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1 && break
    sleep 1
  done
  E2E_BASE_URL="http://127.0.0.1:${PORT}" npx playwright test "$1"
}

status=0
for spec in e2e/*.spec.ts; do
  echo "→ $spec"
  run_spec "$spec" || status=1
done
exit $status
