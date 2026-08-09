import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
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

const PAYMENT_MODES: Record<string, string> = {
  petty_cash: "Petty Cash",
  qr: "QR",
  cheque: "Cheque",
  online_banking: "Online Banking",
  ips: "IPS",
  mobile_banking: "Mobile Banking",
  cards: "Cards",
  other: "Other",
};

interface BillAllocation {
  bill_id: string;
  bill_number: string | null;
  internal_bill_number: string | null;
  outstanding: number;
  amount_applied: number;
}

interface PaymentVoucherData {
  id: string;
  voucher_number: string;
  payee_type: string;
  vendor_id: string | null;
  payee_name: string | null;
  payment_mode: string;
  reference_number: string | null;
  payment_date: string;
  total_amount: number;
  adjustment_type: string;
  remarks: string | null;
  status: string;
  created_at: string;
  vendors?: { name: string } | null;
  bill_allocations?: BillAllocation[];
}

interface Props {
  voucher: PaymentVoucherData;
}

export function PaymentVoucherView({ voucher }: Props) {
  const dateFormat = useDateFormat();

  const payeeDisplay = useMemo(() => {
    if (voucher.payee_type === "vendor") {
      return (voucher.vendors as { name?: string })?.name ?? "—";
    }
    return voucher.payee_name || "—";
  }, [voucher]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header with back button and print */}
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/receipt-payment">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Payment Voucher</h1>
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

      {/* Voucher Content - printable */}
      <div className="print-area">
        <Card className="print:shadow-none print:border-black">
          <CardContent className="pt-6 space-y-6">
            {/* Company header placeholder for print */}
            <div className="text-center border-b pb-4 print:block hidden">
              <h2 className="text-xl font-bold">Payment Voucher</h2>
            </div>

            {/* Voucher info grid */}
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
                  {formatDate(voucher.payment_date, dateFormat)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Payment Mode
                </p>
                <p className="font-semibold">
                  {PAYMENT_MODES[voucher.payment_mode] || voucher.payment_mode}
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
            </div>

            {/* Payee info */}
            <div className="border-t pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Payee Type
                  </p>
                  <p className="font-medium capitalize">
                    {voucher.payee_type === "vendor" ? "Vendor" : "Other"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {voucher.payee_type === "vendor" ? "Vendor Name" : "Payee Name"}
                  </p>
                  <p className="font-medium">{payeeDisplay}</p>
                </div>
              </div>
            </div>

            {/* Amount */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Total Amount Paid</p>
                <p className="text-3xl font-bold text-primary">
                  {inr(voucher.total_amount)}
                </p>
              </div>
            </div>

            {/* Bill-wise allocations */}
            {voucher.adjustment_type === "bill_wise" &&
              voucher.bill_allocations &&
              voucher.bill_allocations.length > 0 && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-3">
                    Bill-wise Payment Details
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bill Number</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                        <TableHead className="text-right">Amount Applied</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {voucher.bill_allocations.map((alloc) => (
                        <TableRow key={alloc.bill_id}>
                          <TableCell className="font-medium">
                            {alloc.bill_number || alloc.internal_bill_number || "—"}
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

            {/* Remarks */}
            {voucher.remarks && (
              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Remarks
                </p>
                <p className="text-sm">{voucher.remarks}</p>
              </div>
            )}

            {/* Signature lines for print */}
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

      {/* No-edit notice */}
      <div className="no-print">
        <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground text-center">
          This payment voucher is final and cannot be edited or deleted.
        </div>
      </div>
    </div>
  );
}
