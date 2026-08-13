"use client";

import { Share2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * Web Share API dipakai kalau tersedia (HP), sehingga bisa langsung ke
 * WhatsApp. Di desktop jatuh ke salin-ke-clipboard.
 */
export function ShareButton({ text }: { text: string }) {
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // Pengguna membatalkan dialog berbagi — bukan error yang perlu dilaporkan.
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Disalin ke clipboard.");
    } catch {
      toast.error("Tidak bisa membagikan di perangkat ini.");
    }
  }

  return (
    <Button variant="secondary" onClick={share} className="tap w-full">
      <Share2Icon className="size-4" />
      Bagikan
    </Button>
  );
}
