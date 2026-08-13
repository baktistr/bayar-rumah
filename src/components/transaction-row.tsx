import Link from "next/link";
import {
  ChevronRightIcon,
  FileTextIcon,
  ImageOffIcon,
  ReceiptTextIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { TYPE_LABELS } from "@/lib/labels";
import type { TransactionListItem } from "@/lib/ledger";
import { formatIDR } from "@/lib/money";
import { dateLabelShort, periodLabel } from "@/lib/period";

export function TransactionRow({ tx }: { tx: TransactionListItem }) {
  const title =
    tx.type === "CICILAN" && tx.installmentNo
      ? `Cicilan ${tx.installmentNo}`
      : TYPE_LABELS[tx.type];

  return (
    <Link
      href={`/riwayat/${tx.id}`}
      className="tap flex items-center gap-3 px-4 py-3 transition-colors active:bg-accent"
    >
      <div
        className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
          tx.status === "LUNAS"
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground"
        }`}
      >
        <ReceiptTextIcon className="size-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{title}</p>
          {tx.status === "RENCANA" ? (
            <Badge
              variant="outline"
              className="shrink-0 border-transparent bg-[var(--chart-3)]/12 px-1.5 py-0 text-[0.65rem] text-[var(--chart-3)]"
            >
              rencana
            </Badge>
          ) : null}
          {tx.preRecorded ? (
            <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[0.65rem]">
              pra-catat
            </Badge>
          ) : null}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {tx.paidAt ? dateLabelShort(tx.paidAt) : periodLabel(tx.period)}
          {tx.attachmentCount > 0 ? (
            <span className="ml-2 inline-flex items-center gap-1">
              <FileTextIcon className="size-3" />
              {tx.attachmentCount} bukti
            </span>
          ) : tx.status === "LUNAS" ? (
            <span className="ml-2 inline-flex items-center gap-1">
              <ImageOffIcon className="size-3" />
              belum ada bukti
            </span>
          ) : null}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="tnum text-sm font-semibold">{formatIDR(tx.amount)}</p>
      </div>
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
