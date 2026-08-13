"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  KeyRoundIcon,
  LoaderCircleIcon,
  PencilIcon,
  ShieldCheckIcon,
  UserPlusIcon,
  UserRoundXIcon,
  UserRoundCheckIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  createUserAction,
  resetPasswordAction,
  setUserActiveAction,
  updateUserAction,
} from "@/app/actions/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ManagedUser = {
  id: number;
  name: string;
  username: string;
  role: "ADMIN" | "VIEWER";
  mustChangePassword: boolean;
  createdAt: number;
  lastLoginAt: number | null;
  deletedAt: number | null;
};

const ROLE_LABELS = { ADMIN: "Admin", VIEWER: "Hanya lihat" } as const;

/** Kata netral untuk menyusun password sementara yang mudah diucapkan. */
const KATA = [
  "melati", "kemuning", "serambi", "lentera", "belimbing", "embun", "pualam",
  "cendana", "kirana", "gerimis", "pelangi", "samudra", "bintang", "kemarau",
];

function passwordSementara(): string {
  const pick = () => KATA[Math.floor(Math.random() * KATA.length)];
  const a = pick();
  let b = pick();
  while (b === a) b = pick();
  return `${a}-${b}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function Submit({ label, pending }: { label: string; pending: boolean }) {
  return (
    <Button type="submit" className="tap h-11 w-full" disabled={pending}>
      {pending ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
      {label}
    </Button>
  );
}

/**
 * Hasil action ditangani langsung di dalam handler submit, bukan lewat
 * useActionState + useEffect. Menutup dialog dan menyegarkan daftar adalah
 * akibat langsung dari satu kejadian — memantulkannya lewat state lalu
 * bereaksi di effect hanya menambah satu putaran render tanpa manfaat.
 */
function useDialogAction(
  action: (prev: null, formData: FormData) => Promise<{ error?: string; success?: string } | null>,
  onDone: () => void,
) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const submit = (formData: FormData) =>
    startTransition(async () => {
      const result = await action(null, formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result?.success ?? "Selesai.", { duration: 10000 });
      onDone();
      router.refresh();
    });

  return { pending, submit };
}

export function UserManager({
  users,
  currentUserId,
}: {
  users: ManagedUser[];
  currentUserId: number;
}) {
  const aktif = users.filter((u) => u.deletedAt === null);
  const nonaktif = users.filter((u) => u.deletedAt !== null);

  return (
    <div className="flex flex-col gap-4">
      <CreateUser />

      <div className="flex flex-col gap-2">
        {aktif.map((user) => (
          <UserCard key={user.id} user={user} currentUserId={currentUserId} />
        ))}
      </div>

      {nonaktif.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="px-1 text-xs font-medium text-muted-foreground">
            Nonaktif
          </p>
          {nonaktif.map((user) => (
            <UserCard key={user.id} user={user} currentUserId={currentUserId} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function UserCard({
  user,
  currentUserId,
}: {
  user: ManagedUser;
  currentUserId: number;
}) {
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const nonaktif = user.deletedAt !== null;
  const isSelf = user.id === currentUserId;

  async function toggleActive() {
    const pesan = nonaktif
      ? `Aktifkan kembali akun "${user.name}"?`
      : `Nonaktifkan akun "${user.name}"? Dia akan langsung keluar dari semua perangkat.`;
    if (!confirm(pesan)) return;

    setPending(true);
    const result = await setUserActiveAction(user.id, nonaktif);
    setPending(false);
    if (result?.error) toast.error(result.error);
    else {
      toast.success(result?.success ?? "Selesai.");
      router.refresh();
    }
  }

  return (
    <Card data-user={user.username} className={nonaktif ? "opacity-60" : undefined}>
      <CardContent className="flex flex-col gap-3 py-1">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              {isSelf ? (
                <Badge variant="outline" className="px-1.5 py-0 text-[0.65rem]">
                  kamu
                </Badge>
              ) : null}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              @{user.username}
            </p>
          </div>
          <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
            {ROLE_LABELS[user.role]}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground">
          {nonaktif
            ? "Akun nonaktif — tidak bisa login."
            : user.mustChangePassword
              ? "Belum pernah ganti password bawaan."
              : user.lastLoginAt
                ? `Login terakhir ${new Date(user.lastLoginAt).toLocaleString("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Jakarta",
                  })}`
                : "Belum pernah login."}
        </p>

        <div className="flex flex-wrap gap-2">
          {!nonaktif ? (
            <>
              <EditUser user={user} />
              <ResetPassword user={user} />
            </>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleActive}
            disabled={pending || (isSelf && !nonaktif)}
            className={nonaktif ? undefined : "text-destructive hover:text-destructive"}
          >
            {pending ? (
              <LoaderCircleIcon className="size-3.5 animate-spin" />
            ) : nonaktif ? (
              <UserRoundCheckIcon className="size-3.5" />
            ) : (
              <UserRoundXIcon className="size-3.5" />
            )}
            {nonaktif ? "Aktifkan" : "Nonaktifkan"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateUser() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState(passwordSementara);
  const { pending, submit } = useDialogAction(createUserAction, () => {
    setOpen(false);
    setPassword(passwordSementara());
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="tap h-12 w-full">
            <UserPlusIcon className="size-4" />
            Tambah pengguna
          </Button>
        }
      />
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogTitle>Tambah pengguna</DialogTitle>
        <DialogDescription>
          Password di bawah hanya sementara. Pengguna wajib menggantinya sendiri
          saat login pertama.
        </DialogDescription>

        <form action={submit} className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-name">Nama</Label>
            <Input id="new-name" name="name" required maxLength={60} className="tap h-11" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="new-username">Username</Label>
            <Input
              id="new-username"
              name="username"
              required
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="tap h-11"
            />
            <p className="text-xs text-muted-foreground">
              Huruf kecil, angka, titik, garis bawah, strip.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="new-role">Peran</Label>
            <Select name="role" items={ROLE_LABELS} defaultValue="VIEWER">
              <SelectTrigger id="new-role" className="tap h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VIEWER">Hanya lihat</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <ShieldCheckIcon className="mt-0.5 size-3.5 shrink-0" />
              Admin bisa mencatat, mengubah, dan menghapus pembayaran. Hanya
              lihat tidak bisa mengubah apa pun.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="new-password">Password sementara</Label>
            <div className="flex gap-2">
              <Input
                id="new-password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={12}
                className="tap h-11 flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setPassword(passwordSementara())}
                className="tap shrink-0"
              >
                Acak
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Catat dulu — setelah ini tidak bisa dilihat lagi.
            </p>
          </div>

          <Submit label="Buat pengguna" pending={pending} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUser({ user }: { user: ManagedUser }) {
  const [open, setOpen] = useState(false);
  const { pending, submit } = useDialogAction(updateUserAction, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <PencilIcon className="size-3.5" />
            Ubah
          </Button>
        }
      />
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogTitle>Ubah {user.name}</DialogTitle>
        <DialogDescription>
          Username tidak bisa diubah — ia dipakai sebagai rujukan di jejak audit.
        </DialogDescription>

        <form action={submit} className="flex flex-col gap-4 pt-2">
          <input type="hidden" name="id" value={user.id} />

          <div className="flex flex-col gap-2">
            <Label htmlFor={`edit-name-${user.id}`}>Nama</Label>
            <Input
              id={`edit-name-${user.id}`}
              name="name"
              defaultValue={user.name}
              required
              maxLength={60}
              className="tap h-11"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`edit-role-${user.id}`}>Peran</Label>
            <Select name="role" items={ROLE_LABELS} defaultValue={user.role}>
              <SelectTrigger id={`edit-role-${user.id}`} className="tap h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VIEWER">Hanya lihat</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Mengubah peran langsung mengeluarkan dia dari semua perangkat.
            </p>
          </div>

          <Submit label="Simpan" pending={pending} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPassword({ user }: { user: ManagedUser }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState(passwordSementara);
  const { pending, submit } = useDialogAction(resetPasswordAction, () => {
    setOpen(false);
    setPassword(passwordSementara());
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <KeyRoundIcon className="size-3.5" />
            Reset password
          </Button>
        }
      />
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogTitle>Reset password {user.name}</DialogTitle>
        <DialogDescription>
          Dipakai kalau dia lupa passwordnya. Semua perangkatnya akan keluar.
        </DialogDescription>

        <form action={submit} className="flex flex-col gap-4 pt-2">
          <input type="hidden" name="id" value={user.id} />

          <div className="flex flex-col gap-2">
            <Label htmlFor={`reset-${user.id}`}>Password sementara</Label>
            <div className="flex gap-2">
              <Input
                id={`reset-${user.id}`}
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={12}
                className="tap h-11 flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setPassword(passwordSementara())}
                className="tap shrink-0"
              >
                Acak
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Catat dulu — setelah ini tidak bisa dilihat lagi.
            </p>
          </div>

          <Submit label="Setel password" pending={pending} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
