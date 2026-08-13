"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { CameraIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { createTransactionAction } from "@/app/actions/transactions";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { METHOD_LABELS, TYPE_LABELS, toSelectItems } from "@/lib/labels";
import { todayISO } from "@/lib/period";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="tap h-12 w-full text-base" disabled={pending}>
      {pending ? (
        <>
          <LoaderCircleIcon className="size-4 animate-spin" />
          Menyimpan…
        </>
      ) : (
        "Simpan pembayaran"
      )}
    </Button>
  );
}

export function PaymentForm({
  nextInstallmentNo,
  nextPeriod,
  monthlyTarget,
}: {
  nextInstallmentNo: number;
  nextPeriod: string;
  monthlyTarget: number;
}) {
  const [state, formAction] = useActionState(createTransactionAction, null);
  const [files, setFiles] = useState<File[]>([]);
  const [paidAt, setPaidAt] = useState(todayISO());
  const [type, setType] = useState("CICILAN");
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      router.push(state.id ? `/riwayat/${state.id}` : "/riwayat");
    }
    if (state?.error) toast.error(state.error);
  }, [state, router]);

  // Bulan cicilan sengaja TIDAK diturunkan dari tanggal transfer. Keduanya
  // sering berbeda — cicilan bulan berjalan bisa ditransfer awal bulan
  // berikutnya, dan di ledger ini ada baris yang sudah tercatat sampai
  // Desember 2026 sehingga bulan terbuka berikutnya bukan bulan hari ini.
  // Menebak otomatis di sini akan lebih sering salah daripada benar.
  const [period, setPeriod] = useState(nextPeriod);

  const chips = Array.from(
    new Set([3_000_000, monthlyTarget, 10_000_000, 20_000_000]),
  ).sort((a, b) => a - b);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      {/* Berkas dipegang di state agar bisa di-preview dan dibuang sebelum
          dikirim; input asli dibiarkan tersembunyi dan disinkronkan. */}
      <input type="hidden" name="status" value="LUNAS" />

      <Card>
        <CardContent className="flex flex-col gap-5 py-1">
          <div className="flex flex-col gap-2">
            <Label htmlFor="amount" className="text-sm">
              Nominal
            </Label>
            <MoneyInput id="amount" name="amount" chips={chips} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="paidAt">Tanggal transfer</Label>
              <Input
                id="paidAt"
                name="paidAt"
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                required
                className="tap h-12"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="period">Bulan cicilan</Label>
              <Input
                id="period"
                name="period"
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                required
                className="tap h-12"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="type">Jenis</Label>
              {/* `items` memetakan nilai enum ke label; tanpa ini pemicunya
                  menampilkan "CICILAN" mentah, bukan "Cicilan". */}
              <Select
                name="type"
                items={TYPE_LABELS}
                value={type}
                onValueChange={(value) => setType(value ?? "CICILAN")}
              >
                <SelectTrigger id="type" className="tap h-12 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {toSelectItems(TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="installmentNo">Cicilan ke-</Label>
              <Input
                id="installmentNo"
                name="installmentNo"
                type="number"
                inputMode="numeric"
                min={1}
                defaultValue={nextInstallmentNo}
                disabled={type !== "CICILAN"}
                className="tnum tap h-12"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="method">Metode</Label>
            <Select name="method" items={METHOD_LABELS} defaultValue="TRANSFER">
              <SelectTrigger id="method" className="tap h-12 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {toSelectItems(METHOD_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 py-1">
          <Label className="text-sm">Bukti transfer</Label>

          <label className="tap flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-7 text-center transition-colors active:bg-accent">
            <CameraIcon className="size-7 text-muted-foreground" />
            <span className="text-sm font-medium">Ambil foto / pilih berkas</span>
            <span className="text-xs text-muted-foreground">
              JPG, PNG, HEIC, atau PDF · maks 10 MB
            </span>
            <input
              type="file"
              name="bukti"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
          </label>

          {files.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {files.map((file, i) => (
                <li
                  key={`${file.name}-${i}`}
                  className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs"
                >
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <span className="tnum shrink-0 text-muted-foreground">
                    {(file.size / 1024 / 1024).toLocaleString("id-ID", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}{" "}
                    MB
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {files.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setFiles([]);
                const input =
                  formRef.current?.querySelector<HTMLInputElement>('input[name="bukti"]');
                if (input) input.value = "";
              }}
              className="flex items-center justify-center gap-1 text-xs text-muted-foreground"
            >
              <XIcon className="size-3" />
              Kosongkan pilihan
            </button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 py-1">
          <div className="flex flex-col gap-2">
            <Label htmlFor="bankNote">Bank (opsional)</Label>
            <Input
              id="bankNote"
              name="bankNote"
              placeholder="BCA → Mandiri"
              className="tap h-12"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="note">Catatan (opsional)</Label>
            <Textarea id="note" name="note" rows={2} />
          </div>
        </CardContent>
      </Card>

      <Submit />
    </form>
  );
}
