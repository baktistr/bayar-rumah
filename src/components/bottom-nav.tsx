"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartLineIcon, HouseIcon, PlusIcon, ReceiptTextIcon, UserIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Beranda", icon: HouseIcon },
  { href: "/riwayat", label: "Riwayat", icon: ReceiptTextIcon },
  { href: "/proyeksi", label: "Proyeksi", icon: ChartLineIcon },
  { href: "/akun", label: "Akun", icon: UserIcon },
];

export function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // Admin mendapat tombol tambah di tengah, jadi tab dibelah dua sisi.
  const left = isAdmin ? TABS.slice(0, 2) : TABS;
  const right = isAdmin ? TABS.slice(2) : [];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm">
      <div className="pb-safe mx-auto flex max-w-lg items-stretch justify-around px-1">
        {left.map((tab) => (
          <NavItem key={tab.href} {...tab} active={isActive(tab.href)} />
        ))}

        {isAdmin ? (
          <Link
            href="/input"
            aria-label="Tambah pembayaran"
            className="relative -top-3 mx-1 flex size-14 shrink-0 items-center justify-center self-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition active:scale-95"
          >
            <PlusIcon className="size-6" strokeWidth={2.5} />
          </Link>
        ) : null}

        {right.map((tab) => (
          <NavItem key={tab.href} {...tab} active={isActive(tab.href)} />
        ))}
      </div>
    </nav>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof HouseIcon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "tap flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[0.7rem] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
      {label}
    </Link>
  );
}
