import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { UserManager } from "@/components/user-manager";
import { Card, CardContent } from "@/components/ui/card";
import { listUsers } from "@/app/actions/users";
import { requireUser } from "@/lib/auth";

export default async function PenggunaPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");

  const users = await listUsers();

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/akun"
        className="tap -ml-2 flex w-fit items-center gap-1 px-2 text-sm text-muted-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Akun
      </Link>

      <div>
        <h1 className="text-lg font-bold">Pengguna</h1>
        <p className="text-sm text-muted-foreground">
          {users.filter((u) => u.deletedAt === null).length} akun aktif
        </p>
      </div>

      <UserManager users={users} currentUserId={user.id} />

      <Card>
        <CardContent className="flex flex-col gap-2 py-1 text-xs text-muted-foreground">
          <p className="text-sm font-semibold text-foreground">
            Kenapa akun dinonaktifkan, bukan dihapus
          </p>
          <p>
            Tiap transaksi menyimpan siapa yang mencatatnya, dan jejak audit
            menyimpan siapa yang mengubah apa. Menghapus barisnya akan memutus
            rujukan itu — ledger kehilangan jawaban atas &ldquo;siapa yang
            memasukkan angka ini&rdquo;, padahal justru itu inti dari mencatat
            berdua.
          </p>
          <p>
            Akun nonaktif tidak bisa login dan langsung keluar dari semua
            perangkatnya, tapi namanya tetap melekat pada catatan lama.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
