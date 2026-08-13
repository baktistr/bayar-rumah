"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { formatNumber, parseIDR } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Input nominal yang memformat ribuan sambil diketik. Nilai yang dikirim ke
 * server tetap string berisi digit — action membersihkan non-digit lagi, jadi
 * pemformatan di sini murni bantuan visual.
 *
 * inputMode="numeric" memunculkan keypad angka di HP, bukan papan ketik penuh.
 */
export function MoneyInput({
  name,
  defaultValue = 0,
  chips = [],
  id,
  onValueChange,
}: {
  name?: string;
  defaultValue?: number;
  chips?: number[];
  id?: string;
  /** Dipanggil dengan nilai integer rupiah setiap kali berubah. */
  onValueChange?: (value: number) => void;
}) {
  const [display, setDisplay] = useState(
    defaultValue > 0 ? formatNumber(defaultValue) : "",
  );

  const value = parseIDR(display);

  function update(next: string) {
    setDisplay(next);
    onValueChange?.(parseIDR(next));
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-medium text-muted-foreground">
          Rp
        </span>
        <Input
          id={id}
          name={name}
          value={display}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            update(digits === "" ? "" : formatNumber(Number.parseInt(digits, 10)));
          }}
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          required
          className="tnum h-14 pl-11 text-right text-xl font-semibold"
        />
      </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => update(formatNumber(chip))}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                value === chip
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground",
              )}
            >
              {chip >= 1_000_000
                ? `${formatNumber(chip / 1_000_000)} jt`
                : formatNumber(chip)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
