import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, DatabaseBackupIcon, FileSpreadsheetIcon } from "lucide-react";

import { SettingsForm } from "@/components/settings-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/ledger";
import { dateLabel } from "@/lib/period";

export default async function PengaturanPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");

  const settings = await getSettings();

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/akun"
        className="tap -ml-2 flex w-fit items-center gap-1 px-2 text-sm text-muted-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Akun
      </Link>

      <h1 className="text-lg font-bold">Pengaturan</h1>

      <SettingsForm settings={settings} />

      <Card>
        <CardContent className="flex flex-col gap-3 py-1">
          <div>
            <p className="text-sm font-semibold">Cadangan &amp; ekspor</p>
            <p className="text-xs text-muted-foreground">
              Berkas database berisi seluruh ledger dan pengguna. Simpan di tempat
              aman — isinya bisa dibuka siapa pun yang memilikinya.
            </p>
          </div>

          <Button
            render={<a href="/api/export" download />}
            variant="secondary"
            className="tap h-12 w-full"
          >
            <FileSpreadsheetIcon className="size-4" />
            Unduh rekap CSV
          </Button>

          <Button
            render={<a href="/api/backup" download />}
            variant="outline"
            className="tap h-12 w-full"
          >
            <DatabaseBackupIcon className="size-4" />
            Unduh cadangan database
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-2 py-1 text-xs text-muted-foreground">
          <p className="text-sm font-semibold text-foreground">Baseline</p>
          <p>
            Saldo per {dateLabel(settings.baselineDate)} adalah titik awal
            perhitungan. Seluruh transaksi di ledger dikurangkan dari angka ini.
            Nilainya sengaja tidak bisa diubah lewat aplikasi — mengubahnya berarti
            menulis ulang sejarah pembayaran, jadi harus lewat migrasi database
            yang disengaja.
          </p>
          <p className="tnum pt-1 text-sm font-semibold text-foreground">
            Rp {settings.baselineAmount.toLocaleString("id-ID")}
          </p>
          <p>Cicilan 1–{settings.baselineInstallmentNo} sudah lewat sebelum baseline.</p>
        </CardContent>
      </Card>
    </div>
  );
}
