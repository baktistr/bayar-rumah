import Link from "next/link";

import { TransactionRow } from "@/components/transaction-row";
import { Card, CardContent } from "@/components/ui/card";
import { listTransactions, listYears } from "@/lib/ledger";
import { formatIDR } from "@/lib/money";
import { periodLabel } from "@/lib/period";
import { cn } from "@/lib/utils";

type Search = Promise<{ tahun?: string; status?: string }>;

export default async function RiwayatPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const params = await searchParams;
  const years = await listYears();
  const year = params.tahun ? Number(params.tahun) : undefined;
  const status =
    params.status === "LUNAS" || params.status === "RENCANA" ? params.status : undefined;

  const transactions = await listTransactions({ year, status });

  // Dikelompokkan per bulan supaya daftar panjang tetap mudah dipindai.
  const groups = new Map<string, typeof transactions>();
  for (const tx of transactions) {
    const list = groups.get(tx.period) ?? [];
    list.push(tx);
    groups.set(tx.period, list);
  }

  const total = transactions
    .filter((t) => t.status === "LUNAS")
    .reduce((sum, t) => sum + t.amount, 0);

  const buildHref = (next: { tahun?: number; status?: string }) => {
    const sp = new URLSearchParams();
    const y = next.tahun ?? year;
    const s = next.status ?? status;
    if (y) sp.set("tahun", String(y));
    if (s) sp.set("status", s);
    const qs = sp.toString();
    return qs ? `/riwayat?${qs}` : "/riwayat";
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <FilterRow label="Tahun">
          <Chip href="/riwayat" active={!year && !status}>
            Semua
          </Chip>
          {years.map((y) => (
            <Chip key={y} href={buildHref({ tahun: y })} active={year === y}>
              {y}
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label="Status">
          <Chip href={buildHref({ status: "LUNAS" })} active={status === "LUNAS"}>
            Lunas
          </Chip>
          <Chip href={buildHref({ status: "RENCANA" })} active={status === "RENCANA"}>
            Rencana
          </Chip>
        </FilterRow>
      </div>

      <Card>
        <CardContent className="flex items-center justify-between py-1">
          <p className="text-xs text-muted-foreground">
            {transactions.length} catatan
            {year ? ` · tahun ${year}` : ""}
          </p>
          <p className="tnum text-sm font-semibold">{formatIDR(total)}</p>
        </CardContent>
      </Card>

      {transactions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Tidak ada catatan untuk filter ini.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {[...groups.entries()].map(([period, items]) => (
            <div key={period}>
              <p className="mb-1.5 px-1 text-xs font-medium text-muted-foreground">
                {periodLabel(period)}
              </p>
              <Card className="overflow-hidden">
                <CardContent className="divide-y divide-border px-0 py-0">
                  {items.map((tx) => (
                    <TransactionRow key={tx.id} tx={tx} />
                  ))}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-xs text-muted-foreground">{label}</span>
      {/* Baris filter bisa digeser mendatar kalau tahunnya sudah banyak. */}
      <div className="-mx-1 flex flex-1 gap-2 overflow-x-auto px-1 pb-1">
        {children}
      </div>
    </div>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground",
      )}
    >
      {children}
    </Link>
  );
}
