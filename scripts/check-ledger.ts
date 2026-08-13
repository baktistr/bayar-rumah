/**
 * Pemeriksaan cepat isi ledger — dipakai setelah seed, setelah restore backup,
 * atau kapan pun angka di layar terasa meragukan.
 *
 * Jalankan: npm run check
 */
import { getBurndown, getSummary, getYearlyTotals, listTransactions } from "@/lib/ledger";
import { formatIDR } from "@/lib/money";
import { periodLabel } from "@/lib/period";

async function main() {
  const s = await getSummary();

  console.log("\n── Ringkasan ────────────────────────────────");
  console.log("Sisa hutang (LUNAS saja) :", formatIDR(s.remaining));
  console.log("Total sudah dibayar      :", formatIDR(s.totalPaid));
  console.log("Sisa setelah RENCANA     :", formatIDR(s.projectedRemaining));
  console.log("Progres                  :", `${s.progressPct.toFixed(2)}%`);
  console.log("Cicilan berikutnya       :", `#${s.nextInstallmentNo} (${s.nextOpenPeriod})`);
  console.log(
    "Bulan berjalan           :",
    `${s.currentMonth.period} — ${s.currentMonth.paid ? `dibayar ${formatIDR(s.currentMonth.amount)}` : "belum dibayar"}` +
      `${s.currentMonth.overdue ? " (LEWAT JATUH TEMPO)" : ""}`,
  );

  const { points, projection } = await getBurndown();
  const lastActual = points.filter((p) => p.actual !== null).at(-1);
  console.log("\n── Proyeksi ─────────────────────────────────");
  console.log("Realisasi terakhir       :", lastActual ? `${periodLabel(lastActual.period)} → ${formatIDR(lastActual.actual!)}` : "—");
  console.log("Perkiraan lunas          :", `${projection.payoffLabel} (${projection.durationLabel})`);
  console.log("Titik grafik             :", `${points.length} (realisasi ${points.filter((p) => p.actual !== null).length})`);

  const tx = await listTransactions();
  console.log("\n── Transaksi ────────────────────────────────");
  for (const t of tx) {
    console.log(
      `  ${t.period}  ${t.installmentNo ? `#${String(t.installmentNo).padStart(2, " ")}` : "  —"}` +
        `  ${formatIDR(t.amount).padStart(16)}  ${t.status}` +
        `  ${t.attachmentCount > 0 ? `${t.attachmentCount} bukti` : "tanpa bukti"}` +
        `${t.preRecorded ? "  [pra-catat]" : ""}`,
    );
  }

  const sum = tx.filter((t) => t.status === "LUNAS").reduce((a, t) => a + t.amount, 0);
  console.log("\n── Konsistensi ──────────────────────────────");
  console.log(
    "Jumlah transaksi == total dibayar :",
    sum === s.totalPaid ? "OK" : `TIDAK COCOK (${formatIDR(sum)} vs ${formatIDR(s.totalPaid)})`,
  );
  const proyeksiTotal = projection.schedule.reduce((a, p) => a + p.payment, 0);
  console.log(
    "Jumlah proyeksi == sisa           :",
    proyeksiTotal === s.remaining ? "OK" : `TIDAK COCOK (${formatIDR(proyeksiTotal)})`,
  );
  console.log("Per tahun :", (await getYearlyTotals()).map((y) => `${y.year} ${formatIDR(y.total)}`).join("  ·  "));
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
