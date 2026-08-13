"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, KeyRoundIcon, LoaderCircleIcon } from "lucide-react";

import { changePasswordAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="tap h-12 w-full text-base" disabled={pending}>
      {pending ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
      Simpan password baru
    </Button>
  );
}

export function ForcePasswordChange({ name }: { name: string }) {
  const [state, formAction] = useActionState(changePasswordAction, null);
  const router = useRouter();

  useEffect(() => {
    // Flag must_change_password dibaca di layout server, jadi perlu refresh
    // agar layar ini hilang setelah password diganti.
    if (state?.success) router.refresh();
  }, [state?.success, router]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <KeyRoundIcon className="size-6" />
          </div>
          <h1 className="text-xl font-bold">Halo, {name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ganti password bawaan dulu sebelum melanjutkan.
          </p>
        </div>

        <Card>
          <CardContent className="pt-2">
            <form action={formAction} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="current">Password saat ini</Label>
                <Input
                  id="current"
                  name="current"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="tap h-12 text-base"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="next">Password baru</Label>
                <Input
                  id="next"
                  name="next"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  className="tap h-12 text-base"
                />
                <p className="text-xs text-muted-foreground">
                  Minimal 12 karakter. Gabungan beberapa kata seperti
                  <span className="font-medium"> melati-kembang-2026</span> jauh
                  lebih kuat sekaligus lebih mudah diingat daripada satu kata
                  pendek dengan angka di belakangnya.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirm">Ulangi password baru</Label>
                <Input
                  id="confirm"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  className="tap h-12 text-base"
                />
              </div>

              {state?.error ? (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
                >
                  <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
                  {state.error}
                </p>
              ) : null}

              <Submit />
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
