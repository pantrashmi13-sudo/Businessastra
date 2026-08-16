import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/date-conversion";
import { useDateFormat } from "@/hooks/use-date-format";
import { inr } from "@/lib/format";

const RECEIPT_MODES: Record<string, string> = {
  petty_cash: "Petty Cash",
  qr: "QR",
  cheque: "Cheque",
  online_banking: "Online Banking",
  ips: "IPS",
  mobile_banking: "Mobile Banking",
  cards: "Cards",
  other: "Other",
};

interface InvoiceAllocation {
  invoice_id: string;
  invoice_number: string;
  outstanding: number;
  amount_applied: number;
}

interface ReceiptVoucherData {
  id: string;
  voucher_number: string;
  payer_type: string;
  customer_id: string | null;
  payer_name: string | null;
  receipt_mode: string;
  reference_number: string | null;
  receipt_date: string;
  total_amount: number;
  adjustment_type: string;
  remarks: string | null;
  received_in_type: string | null;
  received_in_id: string | null;
  status: string;
  created_at: string;
  customers?: { name: string } | null;
  invoice_allocations?: InvoiceAllocation[];
}

interface Props {
  voucher: ReceiptVoucherData;
}

export function ReceiptVoucherView({ voucher }: Props) {
  const dateFormat = useDateFormat();

  const payerDisplay = useMemo(() => {
    if (voucher.payer_type === "customer") {
      return (voucher.customers as { name?: string })?.name ?? "—";
    }
    return voucher.payer_name || "—";
  }, [voucher]);

  // Fetch received in account name
  const receivedInQuery = useQuery({
    queryKey: ["received-in", voucher.received_in_type, voucher.received_in_id],
    queryFn: async () => {
      if (!voucher.received_in_type || !voucher.received_in_id) return null;
      if (voucher.received_in_type === "petty_cash") {
        const { data } = await supabase
          .from("petty_cash_accounts")
          .select("name")
          .eq("id", voucher.received_in_id)
          .single();
        return data ? `Petty Cash - ${data.name}` : null;
      } else if (voucher.received_in_type === "bank") {
        const { data } = await supabase
          .from("bank_accounts")
          .select("bank_name, account_number")
          .eq("id", voucher.received_in_id)
          .single();
        return data ? `Bank - ${data.bank_name} (${data.account_number})` : null;
      }
      return null;
    },
    enabled: !!voucher.received_in_type && !!voucher.received_in_id,
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/receipt-payment">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Receipt Voucher</h1>
            <p className="text-muted-foreground">{voucher.voucher_number}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={voucher.status === "final" ? "default" : "secondary"}>
            {voucher.status === "final" ? "Final" : "Draft"}
          </Badge>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      <div className="print-area">
        <Card className="print:shadow-none print:border-black">
          <CardContent className="pt-6 space-y-6">
            <div className="text-center border-b pb-4 print:block hidden">
              <h2 className="text-xl font-bold">Receipt Voucher</h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Voucher No.
                </p>
                <p className="font-semibold">{voucher.voucher_number}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Date
                </p>
                <p className="font-semibold">
                  {formatDate(voucher.receipt_date, dateFormat)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Receipt Mode
                </p>
                <p className="font-semibold">
                  {RECEIPT_MODES[voucher.receipt_mode] || voucher.receipt_mode}
                </p>
              </div>
              {voucher.reference_number && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Reference No.
                  </p>
                  <p className="font-semibold">{voucher.reference_number}</p>
                </div>
              )}
              {receivedInQuery.data && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Received In
                  </p>
                  <p className="font-semibold">{receivedInQuery.data}</p>
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Payer Type
                  </p>
                  <p className="font-medium capitalize">
                    {voucher.payer_type === "customer" ? "Customer" : "Other"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {voucher.payer_type === "customer" ? "Customer Name" : "Payer Name"}
                  </p>
                  <p className="font-medium">{payerDisplay}</p>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Total Amount Received</p>
                <p className="text-3xl font-bold text-primary">
                  {inr(voucher.total_amount)}
                </p>
              </div>
            </div>

            {voucher.adjustment_type === "invoice_wise" &&
              voucher.invoice_allocations &&
              voucher.invoice_allocations.length > 0 && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-3">
                    Invoice-wise Receipt Details
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice Number</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                        <TableHead className="text-right">Amount Applied</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {voucher.invoice_allocations.map((alloc) => (
                        <TableRow key={alloc.invoice_id}>
                          <TableCell className="font-medium font-mono">
                            {alloc.invoice_number}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {inr(alloc.outstanding)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {inr(alloc.amount_applied)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

            {voucher.remarks && (
              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Remarks
                </p>
                <p className="text-sm">{voucher.remarks}</p>
              </div>
            )}

            <div className="hidden print:block border-t pt-8 mt-8">
              <div className="flex justify-between px-8">
                <div className="text-center">
                  <div className="border-t border-black w-40 mt-12" />
                  <p className="text-xs mt-1">Prepared By</p>
                </div>
                <div className="text-center">
                  <div className="border-t border-black w-40 mt-12" />
                  <p className="text-xs mt-1">Approved By</p>
                </div>
                <div className="text-center">
                  <div className="border-t border-black w-40 mt-12" />
                  <p className="text-xs mt-1">Received By</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="no-print">
        <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground text-center">
          This receipt voucher is final and cannot be edited or deleted.
        </div>
      </div>
    </div>
  );
}
