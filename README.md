# BayarRumah

Installment tracker for an interest-free family house loan. Mobile-first,
self-hosted, two users: an **admin** who records payments and a **viewer** who
can only look.

> This repository contains no financial data. Every figure — opening balance,
> payment history, monthly target — comes from environment variables when the
> database is first created, then lives in the app. See [`.env.example`](.env.example).

The interface is in Indonesian.

---

## The one concept that matters

Every transaction is either **`LUNAS`** (paid) or **`RENCANA`** (scheduled).
They are never mixed:

- **Sisa hutang** counts `LUNAS` rows only.
- **Sisa bila semua rencana terbayar** adds `RENCANA`, shown separately.

Handwritten notes tend to blur these two, and once blurred a single balance
figure means different things to different readers.

Rows marked `LUNAS` with a future transfer date are flagged `pra-catat` in the
history, and proof can be attached later.

Nothing is ever silently deleted. Removing a transaction soft-deletes it, and
every create, edit, and delete is written to an audit trail both users can read.

---

## Deploy

Requirements: Docker with Compose, a domain, a server with 1 GB RAM.

```bash
git clone https://github.com/baktistr/bayar-rumah.git && cd bayar-rumah

cp .env.example .env
openssl rand -base64 32        # put this in AUTH_SECRET

mkdir -p data
docker compose --profile proxy up -d --build
```

Point the domain's A record at the server **before** the first start — Caddy
issues its certificate over HTTP-01 and fails if DNS hasn't propagated yet.

Open `https://<DOMAIN>` and log in. Both accounts must change their password
before they can go any further.

If `ADMIN_PASSWORD` / `VIEWER_PASSWORD` are left blank, random ones are printed
**once** to the log:

```bash
docker compose logs app | head -30
```

**Without a domain**, drop `--profile proxy` and the app is served on
`127.0.0.1:3000`. Over plain HTTP the session cookie needs `COOKIE_SECURE=false`
in `.env` — never set that on an exposed server.

**If your host UID isn't 1000**, set `PUID` / `PGID` in `.env` to match
(`id -u && id -g`). The container writes to `./data` as UID 1000.

---

## Configuration

| Variable | Notes |
|---|---|
| `AUTH_SECRET` | **Required**, 32+ chars. Changing it logs everyone out |
| `DOMAIN` | Used by Caddy for automatic HTTPS |
| `ADMIN_*` / `VIEWER_*` | Name, username, password for the two accounts |
| `BASELINE_AMOUNT`, `BASELINE_DATE` | Opening balance and its date |
| `ORIGINAL_AMOUNT` | Denominator for the progress percentage |
| `MONTHLY_TARGET`, `DUE_DAY_OF_MONTH` | Projection and form defaults |
| `SEED_LEDGER` | Existing payment history, one-line JSON |
| `HOUSE_LABEL` | Title shown in the header |

Passwords must be 12+ characters and are checked against a blocklist of common
words. A value that fails is replaced with a random one and the reason logged.

The financial variables are read **only** while the database is empty; after
that everything is managed in the app. Leave them blank to start with an empty
ledger and enter the numbers through the UI instead — the safest option if you
would rather they never pass through an environment variable at all.

A malformed `SEED_LEDGER` aborts startup rather than writing bad numbers into
the ledger.

---

## Backups

All state lives in one folder: `./data` (`app.db` + `uploads/`).

```bash
./scripts/backup.sh
```

Uses `VACUUM INTO` for a consistent snapshot — copying `app.db` directly can
lose recent writes, because SQLite runs in WAL mode — plus a tar of the proof
images. Output goes to `data/backups/`, kept 30 days.

Nightly, via the host's crontab:

```
0 2 * * * cd /srv/bayar-rumah && ./scripts/backup.sh >> data/backup.log 2>&1
```

The admin can also download a backup any time from **Akun → Pengaturan**.

Restore:

```bash
docker compose down
cp data/backups/app-YYYYMMDD-HHMMSS.db data/app.db
tar -xzf data/backups/uploads-YYYYMMDD-HHMMSS.tar.gz -C data
docker compose --profile proxy up -d
npm run check     # confirms the numbers still add up
```

**Backups are not encrypted.** They hold the full ledger and password hashes —
encrypt them before copying anywhere else.

---

## Development

```bash
npm install
cp .env.example .env.local     # set AUTH_SECRET
npm run db:migrate             # migrate + seed
npm run dev
```

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build + migration bootstrap bundle |
| `npm run db:migrate` | Run migrations, then seed (idempotent) |
| `npm run db:generate` | New migration file after a schema change |
| `npm run check` | Ledger summary + consistency check |
| `npm run e2e` | End-to-end tests against the Docker image |

`npm run check` is worth running after restoring a backup, or any time the
numbers on screen look wrong — it cross-checks transaction totals against the
running balance, and the projection schedule against the remaining debt.

---

## Security

- Sessions are JWTs in `httpOnly` cookies carrying a `session_version` that is
  re-checked on every request, so changing a password immediately revokes
  sessions on other devices — including a stolen one.
- Login is rate-limited per IP **and** per username. The username axis is the
  one that counts: `X-Forwarded-For` can be forged, the account under attack
  cannot.
- Passwords use scrypt from `node:crypto`. The policy follows NIST SP 800-63B —
  length plus a blocklist, not composition rules.
- Proof images are never served from a public folder. `/api/bukti/[id]` checks
  the session first and answers 404 when it shouldn't be seen.
- Uploads are validated by magic bytes, not extension or `Content-Type`.
  Filenames are server-generated UUIDs and EXIF — including GPS — is stripped.
  PDFs are forced to download, because browser PDF viewers execute JavaScript.
- Roles are enforced server-side in every Server Action, not by hiding buttons.
- CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `no-referrer`, `noindex`.
- No third-party analytics or telemetry.

`e2e/security.spec.ts` locks these down. Every case in there failed for real at
some point — don't delete them casually.

Still your responsibility: encrypt backups, clear seeded credentials out of
container logs, use key-only SSH, keep the firewall tight.

---

## Resource usage

Measured against the production image, not estimated:

| | |
|---|---|
| Docker image | 297 MB |
| RAM idle / typical / peak | ~55 MB / ~120 MB / ~131 MB |
| CPU | ~0% idle, brief spike while processing a photo |
| Disk | a few hundred KB for the database, ~150 KB per proof image |

Proof images are compressed twice: resized to 1600px in the browser before
upload (a 4 MB phone photo becomes ~230 KB), then re-encoded server-side to
WebP with a thumbnail. The server always re-compresses — client-side
compression is an optimisation, never a trust boundary.

1 GB RAM is comfortable. Across a loan running into the hundreds of payments,
total disk stays under 40 MB.
