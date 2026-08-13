#!/bin/sh
# Cadangan harian ledger. Jalankan dari folder proyek, mis. lewat cron host:
#   0 2 * * * cd /srv/bayar-rumah && ./scripts/backup.sh >> data/backup.log 2>&1
#
# Memakai VACUUM INTO, bukan menyalin app.db mentah: dengan mode WAL sebagian
# transaksi terbaru masih ada di berkas -wal, sehingga salinan mentah bisa
# kehilangan data atau rusak.
set -e

KEEP_DAYS=30
STAMP=$(date +%Y%m%d-%H%M%S)
TARGET="/app/data/backups/app-${STAMP}.db"

mkdir -p data/backups

docker compose exec -T app node -e "
const Database = require('better-sqlite3');
const fs = require('node:fs');
fs.mkdirSync('/app/data/backups', { recursive: true });
const db = new Database('/app/data/app.db', { readonly: true });
db.exec(\"VACUUM INTO '${TARGET}'\");
db.close();
console.log('Cadangan dibuat: ${TARGET}');
"

# Bukti transfer ikut diarsipkan — database tanpa berkasnya tidak utuh.
tar -czf "data/backups/uploads-${STAMP}.tar.gz" -C data uploads

find data/backups -name 'app-*.db' -mtime +${KEEP_DAYS} -delete
find data/backups -name 'uploads-*.tar.gz' -mtime +${KEEP_DAYS} -delete

echo "Selesai. Cadangan tersimpan di data/backups/ (disimpan ${KEEP_DAYS} hari)."
