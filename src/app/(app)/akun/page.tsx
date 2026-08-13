import Link from "next/link";
import { ChevronRightIcon, LogOutIcon, SettingsIcon, UsersIcon } from "lucide-react";

import { ChangePasswordForm } from "@/components/change-password-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { logoutAction } from "@/app/actions/auth";
import { getLoginHistory } from "@/lib/audit";
import { requireUser } from "@/lib/auth";

export default async function AkunPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const logins = await getLoginHistory(5);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold">Akun</h1>

      <Card>
        <CardContent className="flex items-center gap-3 py-1">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
          </div>
          <Badge variant={isAdmin ? "default" : "secondary"}>
            {isAdmin ? "Admin" : "Hanya lihat"}
          </Badge>
        </CardContent>
      </Card>

      {isAdmin ? (
        <Card>
          <CardContent className="divide-y divide-border px-0 py-0">
            <Link
              href="/pengguna"
              className="tap flex items-center gap-3 px-4 py-3.5 active:bg-accent"
            >
              <UsersIcon className="size-5 text-muted-foreground" />
              <span className="flex-1 text-sm font-medium">Pengguna</span>
              <ChevronRightIcon className="size-4 text-muted-foreground" />
            </Link>
            <Link
              href="/pengaturan"
              className="tap flex items-center gap-3 px-4 py-3.5 active:bg-accent"
            >
              <SettingsIcon className="size-5 text-muted-foreground" />
              <span className="flex-1 text-sm font-medium">Pengaturan</span>
              <ChevronRightIcon className="size-4 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <ChangePasswordForm />

      {logins.length > 0 ? (
        <Card>
          <CardContent className="flex flex-col gap-2 py-1">
            <p className="text-sm font-semibold">Login terakhir</p>
            <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              {logins.map((entry) => (
                <li key={entry.id} className="flex justify-between gap-3">
                  <span className="truncate">{entry.actorName}</span>
                  <span className="tnum shrink-0">
                    {new Date(entry.at).toLocaleString("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Asia/Jakarta",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <form action={logoutAction}>
        <Button
          type="submit"
          variant="outline"
          className="tap h-12 w-full text-destructive hover:text-destructive"
        >
          <LogOutIcon className="size-4" />
          Keluar
        </Button>
      </form>
    </div>
  );
}
