import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

import { ReceiptVoucherView } from "@/components/receipt-vouchers/ReceiptVoucherView";

export const Route = createFileRoute("/receipt-payment/receipt-voucher/$id")({
  component: ViewReceiptVoucherPage,
});

function ViewReceiptVoucherPage() {
  const { id } = Route.useParams();

  const voucher = useQuery({
    queryKey: ["receipt-voucher", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receipt_vouchers" as any)
        .select("*, customers(name)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const invoiceAllocations = useQuery({
    queryKey: ["receipt-voucher-invoices", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receipt_voucher_invoices" as any)
        .select("*, sales_invoices(invoice_number, total_amount)")
        .eq("receipt_voucher_id", id);
      if (error) throw error;
      return (data ?? []).map((a: any) => ({
        invoice_id: a.invoice_id,
        invoice_number: (a.sales_invoices as any)?.invoice_number ?? "—",
        outstanding: Number((a.sales_invoices as any)?.total_amount ?? 0),
        amount_applied: Number(a.amount_applied),
      }));
    },
    enabled: voucher.data?.adjustment_type === "invoice_wise",
  });

  if (voucher.isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading…
      </div>
    );
  }

  if (voucher.error || !voucher.data) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground mb-4">Receipt voucher not found.</p>
        <Link to="/receipt-payment" className="text-primary hover:underline">
          ← Back to list
        </Link>
      </div>
    );
  }

  return (
    <ReceiptVoucherView
      voucher={{
        ...voucher.data,
        invoice_allocations: invoiceAllocations.data,
      }}
    />
  );
}
