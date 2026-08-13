// Sengaja tanpa "server-only": modul ini juga dipakai script migrasi & seed
// yang berjalan di Node biasa, di luar bundler Next.
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

export const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DB_PATH = process.env.DATABASE_PATH ?? path.join(DATA_DIR, "app.db");

function createClient() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const sqlite = new Database(DB_PATH);
  // WAL: baca tidak terblokir saat ada tulisan. foreign_keys tidak aktif
  // secara default di SQLite dan harus dinyalakan per koneksi.
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  return drizzle(sqlite, { schema });
}

// Di dev, Next me-reload modul tiap perubahan; tanpa cache global koneksi
// SQLite akan menumpuk sampai kena limit file descriptor.
const globalForDb = globalThis as unknown as {
  __bayarRumahDb?: ReturnType<typeof createClient>;
};

export const db = globalForDb.__bayarRumahDb ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.__bayarRumahDb = db;

export { schema };
