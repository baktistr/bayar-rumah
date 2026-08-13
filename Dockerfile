# syntax=docker/dockerfile:1

# ── deps ──────────────────────────────────────────────────────────────
# better-sqlite3 adalah modul native. Prebuilt biasanya tersedia untuk
# linux/amd64, tapi toolchain tetap dipasang agar build tidak gagal di
# arsitektur lain (mis. Raspberry Pi / Apple Silicon).
FROM node:24-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ── builder ───────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── runner ────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/app/data \
    TZ=Asia/Jakarta

# Memakai user `node` bawaan image (uid 1000) — bukan uid baru. Folder data
# di-bind mount dari host, dan uid 1000 adalah pengguna pertama di hampir semua
# distro Linux, sehingga izin tulisnya cocok tanpa chown manual. Kalau uid host
# berbeda, override lewat PUID/PGID di compose.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
# Berkas migrasi SQL + skrip bootstrap yang sudah di-bundle.
COPY --from=builder --chown=node:node /app/drizzle ./drizzle
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --chown=node:node docker-entrypoint.sh /app/docker-entrypoint.sh

RUN mkdir -p /app/data/uploads \
  && chown -R node:node /app/data \
  && chmod +x /app/docker-entrypoint.sh

USER node
EXPOSE 3000

# Menyentuh database, bukan sekadar membalas 200 — container hidup dengan
# database tak terbaca tetap harus dilaporkan tidak sehat.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
