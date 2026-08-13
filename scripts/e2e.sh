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

echo "→ Menjalankan container bersih di port ${PORT}…"
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" \
  -p "127.0.0.1:${PORT}:3000" \
  -e AUTH_SECRET="$(openssl rand -base64 32)" \
  -e COOKIE_SECURE=false \
  -e ADMIN_NAME=Bakti -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD=rahasia12345 \
  -e VIEWER_NAME=Ibu -e VIEWER_USERNAME=ibu -e VIEWER_PASSWORD=ibu12345678 \
  -v "${DATA_DIR}:/app/data" \
  bayar-rumah:e2e >/dev/null

echo "→ Menunggu container siap…"
for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then break; fi
  sleep 1
done

E2E_BASE_URL="http://127.0.0.1:${PORT}" npx playwright test "$@"
