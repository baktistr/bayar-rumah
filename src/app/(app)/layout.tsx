import { eq } from "drizzle-orm";

import { BottomNav } from "@/components/bottom-nav";
import { ForcePasswordChange } from "@/components/force-password-change";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/ledger";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const row = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { mustChangePassword: true },
  });

  // Password bawaan dari seed muncul di log container; sampai diganti,
  // seluruh aplikasi ditahan di layar ini.
  if (row?.mustChangePassword) {
    return <ForcePasswordChange name={user.name} />;
  }

  const cfg = await getSettings();
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="pt-safe mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">
              {cfg.houseLabel}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user.name}
              {!isAdmin ? (
                <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-[0.65rem]">
                  hanya lihat
                </Badge>
              ) : null}
            </p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* pb-28 memberi ruang untuk bottom nav yang posisinya fixed. */}
      <main className="mx-auto max-w-lg px-4 pb-28 pt-4">{children}</main>

      <BottomNav isAdmin={isAdmin} />
    </div>
  );
}
