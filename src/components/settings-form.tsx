"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { updateSettingsAction } from "@/app/actions/transactions";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Settings } from "@/db/schema";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="tap h-12 w-full" disabled={pending}>
      {pending ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
      Simpan pengaturan
    </Button>
  );
}

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, formAction] = useActionState(updateSettingsAction, null);

  useEffect(() => {
    if (state?.success) toast.success(state.success);
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-5 py-1">
          <div className="flex flex-col gap-2">
            <Label htmlFor="houseLabel">Nama / label</Label>
            <Input
              id="houseLabel"
              name="houseLabel"
              defaultValue={settings.houseLabel}
              required
              maxLength={120}
              className="tap h-12"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="originalAmount">Total kewajiban awal</Label>
            <MoneyInput
              id="originalAmount"
              name="originalAmount"
              defaultValue={settings.originalAmount}
            />
            <p className="text-xs text-muted-foreground">
              Dipakai sebagai penyebut persentase progres. Saat ini disetel sama
              dengan saldo baseline 1 Mei 2026, sehingga cicilan 1–8 tidak ikut
              dihitung. Ubah kalau angka harga rumah yang sebenarnya sudah ketemu.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="monthlyTarget">Target cicilan per bulan</Label>
            <MoneyInput
              id="monthlyTarget"
              name="monthlyTarget"
              defaultValue={settings.monthlyTarget}
              chips={[3_000_000, 5_000_000, 10_000_000]}
            />
            <p className="text-xs text-muted-foreground">
              Dipakai untuk proyeksi tanggal lunas dan nilai bawaan form.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="dueDayOfMonth">Tanggal jatuh tempo</Label>
            <Input
              id="dueDayOfMonth"
              name="dueDayOfMonth"
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              defaultValue={settings.dueDayOfMonth}
              required
              className="tnum tap h-12"
            />
          </div>
        </CardContent>
      </Card>

      <Submit />
    </form>
  );
}
