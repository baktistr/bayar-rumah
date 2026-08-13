"use client";

import { useId, useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Kolom password dengan tombol lihat/sembunyi.
 *
 * Mengetik password panjang di papan ketik ponsel gampang meleset, dan aturan
 * kami mewajibkan minimal 12 karakter — tanpa cara memeriksa apa yang sudah
 * diketik, orang cenderung memilih password pendek yang mudah diketik ulang.
 * Bisa mengintip justru mendorong password yang lebih kuat.
 */
export function PasswordInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  const [terlihat, setTerlihat] = useState(false);
  const deskripsiId = useId();

  return (
    <div className="relative">
      <Input
        {...props}
        type={terlihat ? "text" : "password"}
        // Ruang untuk tombol, supaya teks panjang tidak tertutup ikon.
        className={cn("pr-12", className)}
        aria-describedby={deskripsiId}
      />
      <button
        type="button"
        onClick={() => setTerlihat((v) => !v)}
        // aria-pressed menyampaikan status ke pembaca layar; tanpa itu tombolnya
        // terbaca sama saja baik password sedang terlihat maupun tidak.
        aria-pressed={terlihat}
        aria-label={terlihat ? "Sembunyikan password" : "Tampilkan password"}
        aria-controls={props.id}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {terlihat ? (
          <EyeOffIcon className="size-5" />
        ) : (
          <EyeIcon className="size-5" />
        )}
      </button>
      <span id={deskripsiId} className="sr-only">
        {terlihat ? "Password sedang terlihat" : "Password disembunyikan"}
      </span>
    </div>
  );
}
