import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { db } from "./index";
import { seed } from "./seed";

/**
 * Dipanggil entrypoint container sebelum server start. Migrasi Drizzle
 * mencatat sendiri apa yang sudah dijalankan, jadi aman diulang.
 */
async function main() {
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  console.log("Migrasi database selesai.");

  const { notes, credentials } = await seed();
  for (const n of notes) console.log(`  ${n}`);
  if (credentials.length > 0) {
    console.log("\n  ┌─ Kredensial awal (hanya tampil sekali) ─────────────");
    for (const c of credentials) {
      console.log(`  │ ${c.label}  ${c.username}  /  ${c.password}`);
    }
    console.log("  └─ Wajib diganti saat login pertama. ────────────────\n");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migrasi gagal:", err);
    process.exit(1);
  });
