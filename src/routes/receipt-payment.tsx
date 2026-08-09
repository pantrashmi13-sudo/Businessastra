import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, FileText } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/date-conversion";
import { useDateFormat } from "@/hooks/use-date-format";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/receipt-payment")({
  component: ReceiptPaymentPage,
});

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

function ReceiptPaymentPage() {
  const [q, setQ] = useState("");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const dateFormat = useDateFormat();

  const vouchers = useQuery({
    queryKey: ["payment-vouchers", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_vouchers")
        .select("*, vendors(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    let list = vouchers.data ?? [];
    if (modeFilter !== "all") {
      list = list.filter((v) => v.payment_mode === modeFilter);
    }
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter((v) =>
        [
          v.voucher_number,
          v.payee_name,
          (v.vendors as { name?: string })?.name,
          v.reference_number,
          v.remarks,
        ]
          .filter(Boolean)
          .some((s) => String(s).toLowerCase().includes(needle))
      );
    }
    return list;
  }, [vouchers.data, modeFilter, q]);

  const totalAmount = rows.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Receipt & Payment"
        description="View and manage payment vouchers."
        actions={
          <Button asChild>
            <Link to="/receipt-payment/payment-voucher/new">
              <Plus className="mr-2 h-4 w-4" />
              New Payment Voucher
            </Link>
          </Button>
        }
      />
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search vouchers…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-sm"
          />
          <Select value={modeFilter} onValueChange={setModeFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Modes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modes</SelectItem>
              {Object.entries(PAYMENT_MODES).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto text-sm text-muted-foreground">
            {rows.length} voucher{rows.length !== 1 ? "s" : ""} • Total:{" "}
            <span className="font-medium text-foreground">{inr(totalAmount)}</span>
          </div>
        </div>

        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Voucher No.</TableHead>
                <TableHead className="w-28">Date</TableHead>
                <TableHead>Payee</TableHead>
                <TableHead className="w-32">Mode</TableHead>
                <TableHead className="w-28">Ref. No.</TableHead>
                <TableHead className="w-36 text-right">Amount</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="w-20">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vouchers.isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
                    No payment vouchers found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.voucher_number}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(v.payment_date, dateFormat)}
                    </TableCell>
                    <TableCell>
                      {v.payee_type === "vendor"
                        ? (v.vendors as { name?: string })?.name ?? "—"
                        : v.payee_name || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {PAYMENT_MODES[v.payment_mode] || v.payment_mode}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {v.reference_number || "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {inr(v.total_amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={v.status === "final" ? "default" : "secondary"}>
                        {v.status === "final" ? "Final" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link
                          to="/receipt-payment/payment-voucher/$id"
                          params={{ id: v.id }}
                        >
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
