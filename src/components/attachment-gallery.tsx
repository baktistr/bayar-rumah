"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DownloadIcon,
  FileTextIcon,
  ImagePlusIcon,
  LoaderCircleIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import {
  addAttachmentsAction,
  deleteAttachmentAction,
} from "@/app/actions/transactions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Attachment } from "@/db/schema";
import { compressFileInput } from "@/lib/compress-image";

export function AttachmentGallery({
  attachments,
  transactionId,
  isAdmin,
}: {
  attachments: Attachment[];
  transactionId: number;
  isAdmin: boolean;
}) {
  const [state, formAction, pending] = useActionState(addAttachmentsAction, null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      formRef.current?.reset();
    }
    if (state?.error) toast.error(state.error);
  }, [state]);

  async function handleDelete(id: number) {
    if (!confirm("Hapus bukti ini?")) return;
    setDeletingId(id);
    const result = await deleteAttachmentAction(id);
    setDeletingId(null);
    if (result?.error) toast.error(result.error);
    else {
      toast.success("Bukti dihapus.");
      router.refresh();
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-1">
        <p className="text-sm font-semibold">Bukti transfer</p>

        {attachments.length === 0 ? (
          <p className="rounded-lg bg-muted p-4 text-center text-xs text-muted-foreground">
            Belum ada bukti transfer untuk pembayaran ini.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {attachments.map((file) => (
              <div key={file.id} className="group relative">
                {file.mimeType === "application/pdf" ? (
                  <a
                    href={`/api/bukti/${file.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-border bg-muted text-muted-foreground"
                  >
                    <FileTextIcon className="size-6" />
                    <span className="text-[0.65rem]">PDF</span>
                  </a>
                ) : (
                  <Dialog>
                    <DialogTrigger className="block w-full overflow-hidden rounded-lg border border-border">
                      {/* next/image dilewati: berkas ada di volume privat dan
                          sudah dikompresi sharp saat unggah. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/bukti/${file.id}?thumb=1`}
                        alt={file.originalName ?? "Bukti transfer"}
                        className="aspect-square w-full object-cover"
                        loading="lazy"
                      />
                    </DialogTrigger>
                    <DialogContent className="max-w-[95vw] p-2 sm:max-w-2xl">
                      <DialogTitle className="sr-only">
                        {file.originalName ?? "Bukti transfer"}
                      </DialogTitle>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/bukti/${file.id}`}
                        alt={file.originalName ?? "Bukti transfer"}
                        className="max-h-[80vh] w-full rounded object-contain"
                      />
                      <Button
                        render={<a href={`/api/bukti/${file.id}`} download />}
                        variant="secondary"
                        className="tap w-full"
                      >
                        <DownloadIcon className="size-4" />
                        Unduh
                      </Button>
                    </DialogContent>
                  </Dialog>
                )}

                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(file.id)}
                    disabled={deletingId === file.id}
                    aria-label="Hapus bukti"
                    className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-background/90 text-destructive shadow-sm"
                  >
                    {deletingId === file.id ? (
                      <LoaderCircleIcon className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2Icon className="size-3.5" />
                    )}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {isAdmin ? (
          <form ref={formRef} action={formAction}>
            <input type="hidden" name="transactionId" value={transactionId} />
            <label className="tap flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border py-3 text-sm text-muted-foreground transition-colors active:bg-accent">
              {pending ? (
                <LoaderCircleIcon className="size-4 animate-spin" />
              ) : (
                <ImagePlusIcon className="size-4" />
              )}
              {pending ? "Mengunggah…" : "Tambah bukti"}
              <input
                type="file"
                name="bukti"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={async (e) => {
                  // Kecilkan dulu, baru kirim — sama seperti di form input.
                  const input = e.currentTarget;
                  await compressFileInput(input);
                  input.form?.requestSubmit();
                }}
              />
            </label>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
