"use client";

import { MoonIcon, SunIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Tema tidak disimpan di state React sama sekali. Ikon mana yang tampil
 * ditentukan CSS dari kelas `dark` pada <html>, sehingga server dan klien
 * merender markup yang identik — tidak ada hydration mismatch dan tidak ada
 * setState di dalam effect hanya untuk membaca DOM.
 */
export function ThemeToggle() {
  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("br-theme", next ? "dark" : "light");
    } catch {
      // Mode privat browser bisa memblokir localStorage — tema tetap berganti
      // untuk sesi ini, hanya tidak diingat.
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Ganti tema terang / gelap"
      className="tap"
    >
      <MoonIcon className="size-5 dark:hidden" />
      <SunIcon className="hidden size-5 dark:block" />
    </Button>
  );
}
