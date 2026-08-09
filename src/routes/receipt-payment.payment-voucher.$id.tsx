import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

import { PaymentVoucherView } from "@/components/payment-vouchers/PaymentVoucherView";

export const Route = createFileRoute("/receipt-payment/payment-voucher/$id")({
  component: ViewPaymentVoucherPage,
});

function ViewPaymentVoucherPage() {
  const { id } = Route.useParams();

  const voucher = useQuery({
    queryKey: ["payment-voucher", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_vouchers")
        .select("*, vendors(name)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const billAllocations = useQuery({
    queryKey: ["payment-voucher-bills", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_voucher_bills")
        .select("*, bills(bill_number, internal_bill_number, final_amount)")
        .eq("payment_voucher_id", id);
      if (error) throw error;
      return (data ?? []).map((a) => ({
        bill_id: a.bill_id,
        bill_number: (a.bills as { bill_number?: string } | null)?.bill_number ?? null,
        internal_bill_number: (a.bills as { internal_bill_number?: string } | null)?.internal_bill_number ?? null,
        outstanding: Number((a.bills as { final_amount?: number } | null)?.final_amount ?? 0),
        amount_applied: Number(a.amount_applied),
      }));
    },
    enabled: voucher.data?.adjustment_type === "bill_wise",
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
        <p className="text-muted-foreground mb-4">Payment voucher not found.</p>
        <Link to="/receipt-payment" className="text-primary hover:underline">
          ← Back to list
        </Link>
      </div>
    );
  }

  return (
    <PaymentVoucherView
      voucher={{
        ...voucher.data,
        bill_allocations: billAllocations.data,
      }}
    />
  );
}
