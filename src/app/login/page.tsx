import { Suspense } from "react";
import { redirect } from "next/navigation";
import { HomeIcon } from "lucide-react";

import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  // Pemeriksaan lengkap (termasuk versi sesi), bukan sekadar tanda tangan
  // token. Sesi yang sudah dicabut harus jatuh ke formulir login di sini,
  // bukan dipantulkan kembali ke aplikasi.
  const user = await getSessionUser();
  if (user) redirect("/");

  return <LoginScreen />;
}

function LoginScreen() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-muted/40 px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <HomeIcon className="size-7" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">BayarRumah</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catatan pembayaran rumah
          </p>
        </div>

        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
