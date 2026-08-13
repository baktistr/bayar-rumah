"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { CalendarPlusIcon, LoaderCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { generatePlanAction } from "@/app/actions/transactions";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="tap h-12 w-full text-base" disabled={pending}>
      {pending ? (
        <LoaderCircleIcon className="size-4 animate-spin" />
      ) : (
        <CalendarPlusIcon className="size-4" />
      )}
      Buat jadwal
    </Button>
  );
}

/**
 * Membuat beberapa bulan cicilan sekaligus sebagai RENCANA — pola yang sama
 * dengan catatan asli ("cicilan 10 s/d 15 @ 5 jt"), tanpa mengisi form
 * satu per satu.
 */
export function PlanForm({
  nextInstallmentNo,
  nextPeriod,
  monthlyTarget,
}: {
  nextInstallmentNo: number;
  nextPeriod: string;
  monthlyTarget: number;
}) {
  const [state, formAction] = useActionState(generatePlanAction, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      router.push("/riwayat?status=RENCANA");
    }
    if (state?.error) toast.error(state.error);
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-5 py-1">
          <div className="flex flex-col gap-2">
            <Label htmlFor="plan-amount">Nominal per bulan</Label>
            <MoneyInput
              id="plan-amount"
              name="amount"
              defaultValue={monthlyTarget}
              chips={[3_000_000, 5_000_000, 10_000_000]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="startPeriod">Mulai bulan</Label>
              <Input
                id="startPeriod"
                name="startPeriod"
                type="month"
                defaultValue={nextPeriod}
                required
                className="tap h-12"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="months">Berapa bulan</Label>
              <Input
                id="months"
                name="months"
                type="number"
                inputMode="numeric"
                min={1}
                max={60}
                defaultValue={6}
                required
                className="tnum tap h-12"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="startInstallmentNo">Mulai dari cicilan ke-</Label>
            <Input
              id="startInstallmentNo"
              name="startInstallmentNo"
              type="number"
              inputMode="numeric"
              min={1}
              defaultValue={nextInstallmentNo}
              required
              className="tnum tap h-12"
            />
          </div>

          <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            Jadwal dibuat berstatus <strong>rencana</strong> — belum mengurangi sisa
            hutang. Tandai lunas satu per satu setelah transfernya benar-benar
            dilakukan. Bulan yang sudah punya catatan akan dilewati.
          </p>
        </CardContent>
      </Card>

      <Submit />
    </form>
  );
}
