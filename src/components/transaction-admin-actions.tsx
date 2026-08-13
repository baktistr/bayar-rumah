"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, LoaderCircleIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import {
  deleteTransactionAction,
  markPaidAction,
} from "@/app/actions/transactions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Transaction } from "@/db/schema";

export function TransactionAdminActions({ tx }: { tx: Transaction }) {
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<"paid" | "delete" | null>(null);
  const router = useRouter();

  function run(kind: "paid" | "delete") {
    if (kind === "delete" && !confirm("Hapus transaksi ini dari ledger?")) return;
    setAction(kind);
    startTransition(async () => {
      const result =
        kind === "paid"
          ? await markPaidAction(tx.id)
          : await deleteTransactionAction(tx.id);
      setAction(null);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result?.success ?? "Selesai.");
      if (kind === "delete") router.push("/riwayat");
      else router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 py-1">
        <p className="text-sm font-semibold">Kelola</p>

        {tx.status === "RENCANA" ? (
          <Button
            onClick={() => run("paid")}
            disabled={pending}
            className="tap w-full"
          >
            {pending && action === "paid" ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : (
              <CheckIcon className="size-4" />
            )}
            Tandai sudah dibayar
          </Button>
        ) : null}

        <Button
          variant="outline"
          onClick={() => run("delete")}
          disabled={pending}
          className="tap w-full text-destructive hover:text-destructive"
        >
          {pending && action === "delete" ? (
            <LoaderCircleIcon className="size-4 animate-spin" />
          ) : (
            <Trash2Icon className="size-4" />
          )}
          Hapus transaksi
        </Button>

        <p className="text-xs text-muted-foreground">
          Transaksi yang dihapus tetap tersimpan di database dan tercatat di jejak
          audit — angka tidak pernah hilang tanpa jejak.
        </p>
      </CardContent>
    </Card>
  );
}
