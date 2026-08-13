"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { changePasswordAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" className="tap h-11 w-full" disabled={pending}>
      {pending ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
      Ganti password
    </Button>
  );
}

export function ChangePasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      formRef.current?.reset();
    }
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <Card>
      <CardContent className="py-1">
        <form ref={formRef} action={formAction} className="flex flex-col gap-4">
          <p className="text-sm font-semibold">Ganti password</p>

          <div className="flex flex-col gap-2">
            <Label htmlFor="acc-current">Password saat ini</Label>
            <PasswordInput
              id="acc-current"
              name="current"
              autoComplete="current-password"
              required
              className="tap h-11"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="acc-next">Password baru</Label>
            <PasswordInput
              id="acc-next"
              name="next"
              autoComplete="new-password"
              required
              minLength={12}
              className="tap h-11"
            />
            <p className="text-xs text-muted-foreground">
              Minimal 12 karakter, hindari kata umum.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="acc-confirm">Ulangi password baru</Label>
            <PasswordInput
              id="acc-confirm"
              name="confirm"
              autoComplete="new-password"
              required
              minLength={12}
              className="tap h-11"
            />
          </div>

          <Submit />
        </form>
      </CardContent>
    </Card>
  );
}
