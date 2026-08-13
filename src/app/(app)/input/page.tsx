import { redirect } from "next/navigation";

import { PaymentForm } from "@/components/payment-form";
import { PlanForm } from "@/components/plan-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireUser } from "@/lib/auth";
import { getSummary } from "@/lib/ledger";

export default async function InputPage() {
  const user = await requireUser();
  // Viewer tidak punya urusan di halaman ini; tombolnya memang disembunyikan,
  // tapi URL-nya tetap bisa diketik langsung.
  if (user.role !== "ADMIN") redirect("/");

  const summary = await getSummary();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold">Tambah catatan</h1>

      <Tabs defaultValue="bayar">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="bayar" className="tap">
            Pembayaran
          </TabsTrigger>
          <TabsTrigger value="jadwal" className="tap">
            Buat jadwal
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bayar" className="mt-4">
          <PaymentForm
            nextInstallmentNo={summary.nextInstallmentNo}
            nextPeriod={summary.nextOpenPeriod}
            monthlyTarget={summary.monthlyTarget}
          />
        </TabsContent>

        <TabsContent value="jadwal" className="mt-4">
          <PlanForm
            nextInstallmentNo={summary.nextInstallmentNo}
            nextPeriod={summary.nextOpenPeriod}
            monthlyTarget={summary.monthlyTarget}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
