import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { AttachmentGallery } from "@/components/attachment-gallery";
import { ShareButton } from "@/components/share-button";
import { TransactionAdminActions } from "@/components/transaction-admin-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getAuditTrail } from "@/lib/audit";
import { METHOD_LABELS, STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import { requireUser } from "@/lib/auth";
import { getSummary, getTransactionDetail } from "@/lib/ledger";
import { formatIDR } from "@/lib/money";
import { dateLabel, periodLabel, todayISO } from "@/lib/period";

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const txId = Number(id);
  if (!Number.isInteger(txId)) notFound();

  const tx = await getTransactionDetail(txId);
  if (!tx) notFound();

  const [audit, summary] = await Promise.all([
    getAuditTrail("transaction", txId),
    getSummary(),
  ]);

  const isAdmin = user.role === "ADMIN";
  const title =
    tx.type === "CICILAN" && tx.installmentNo
      ? `Cicilan ${tx.installmentNo}`
      : TYPE_LABELS[tx.type];
  const preRecorded = tx.status === "LUNAS" && !!tx.paidAt && tx.paidAt > todayISO();

  const shareText =
    `${title} — ${formatIDR(tx.amount)}\n` +
    `${tx.paidAt ? dateLabel(tx.paidAt) : periodLabel(tx.period)}\n` +
    `Sisa hutang: ${formatIDR(summary.remaining)}`;

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/riwayat"
        className="tap -ml-2 flex w-fit items-center gap-1 px-2 text-sm text-muted-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Riwayat
      </Link>

      <Card>
        <CardContent className="flex flex-col gap-4 py-1">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-muted-foreground">{title}</p>
              <Badge
                variant="outline"
                className={
                  tx.status === "LUNAS"
                    ? "border-transparent bg-[var(--chart-1)]/12 text-[var(--chart-1)]"
                    : "border-transparent bg-[var(--chart-3)]/12 text-[var(--chart-3)]"
                }
              >
                {STATUS_LABELS[tx.status]}
              </Badge>
              {preRecorded ? <Badge variant="secondary">pra-catat</Badge> : null}
            </div>
            <p className="tnum mt-1 text-3xl font-bold tracking-tight">
              {formatIDR(tx.amount)}
            </p>
          </div>

          <Separator />

          <dl className="flex flex-col gap-2.5 text-sm">
            <Field label="Bulan cicilan" value={periodLabel(tx.period)} />
            <Field
              label="Tanggal transfer"
              value={tx.paidAt ? dateLabel(tx.paidAt) : "belum ditransfer"}
            />
            <Field label="Metode" value={METHOD_LABELS[tx.method]} />
            {tx.bankNote ? <Field label="Bank" value={tx.bankNote} /> : null}
            {tx.note ? <Field label="Catatan" value={tx.note} /> : null}
          </dl>

          {preRecorded ? (
            <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              Tanggal transfernya masih di depan. Baris ini dicatat lunas lebih dulu
              sesuai catatan awal, dan buktinya bisa dilampirkan menyusul.
            </p>
          ) : null}

          <ShareButton text={shareText} />
        </CardContent>
      </Card>

      <AttachmentGallery
        attachments={tx.attachments}
        transactionId={tx.id}
        isAdmin={isAdmin}
      />

      {isAdmin ? <TransactionAdminActions tx={tx} /> : null}

      {audit.length > 0 ? (
        <Card>
          <CardContent className="flex flex-col gap-3 py-1">
            <p className="text-sm font-semibold">Riwayat perubahan</p>
            <ol className="flex flex-col gap-2.5">
              {audit.map((entry) => (
                <li key={entry.id} className="flex gap-3 text-xs">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-border" />
                  <div className="min-w-0">
                    <p className="font-medium">
                      {AUDIT_LABEL[entry.action] ?? entry.action} oleh {entry.actorName}
                    </p>
                    <p className="text-muted-foreground">
                      {new Date(entry.at).toLocaleString("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Jakarta",
                      })}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

const AUDIT_LABEL: Record<string, string> = {
  CREATE: "Dibuat",
  UPDATE: "Diubah",
  DELETE: "Dihapus",
  RESTORE: "Dipulihkan",
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
