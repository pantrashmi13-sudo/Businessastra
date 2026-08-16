import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, FileText, ArrowDownCircle, ArrowUpCircle } from "lucide-react";

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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/date-conversion";
import { useDateFormat } from "@/hooks/use-date-format";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/receipt-payment/")({
  component: ReceiptPaymentPage,
});

const MODES: Record<string, string> = {
  petty_cash: "Petty Cash",
  qr: "QR",
  cheque: "Cheque",
  online_banking: "Online Banking",
  ips: "IPS",
  mobile_banking: "Mobile Banking",
  cards: "Cards",
  other: "Other",
};

type VoucherRow = {
  id: string;
  type: "payment" | "receipt";
  voucher_number: string;
  date: string;
  party_name: string;
  mode: string;
  reference_number: string | null;
  amount: number;
  status: string;
};

function ReceiptPaymentPage() {
  const [q, setQ] = useState("");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [tab, setTab] = useState<"all" | "payment" | "receipt">("all");
  const dateFormat = useDateFormat();

  const paymentVouchers = useQuery({
    queryKey: ["payment-vouchers", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_vouchers")
        .select("*, vendors(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((v: any) => ({
        id: v.id,
        type: "payment" as const,
        voucher_number: v.voucher_number,
        date: v.payment_date,
        party_name: v.payee_type === "vendor"
          ? (v.vendors as { name?: string })?.name ?? "—"
          : v.payee_name || "—",
        mode: v.payment_mode,
        reference_number: v.reference_number,
        amount: Number(v.total_amount ?? 0),
        status: v.status,
      }));
    },
  });

  const receiptVouchers = useQuery({
    queryKey: ["receipt-vouchers", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receipt_vouchers" as any)
        .select("*, customers(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((v: any) => ({
        id: v.id,
        type: "receipt" as const,
        voucher_number: v.voucher_number,
        date: v.receipt_date,
        party_name: v.payer_type === "customer"
          ? (v.customers as { name?: string })?.name ?? "—"
          : v.payer_name || "—",
        mode: v.receipt_mode,
        reference_number: v.reference_number,
        amount: Number(v.total_amount ?? 0),
        status: v.status,
      }));
    },
  });

  const allRows = useMemo(() => {
    const combined = [...(paymentVouchers.data ?? []), ...(receiptVouchers.data ?? [])];
    let list = combined.sort((a, b) => b.date.localeCompare(a.date));

    if (tab !== "all") {
      list = list.filter((r) => r.type === tab);
    }
    if (modeFilter !== "all") {
      list = list.filter((r) => r.mode === modeFilter);
    }
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter((r) =>
        [r.voucher_number, r.party_name, r.reference_number]
          .filter(Boolean)
          .some((s) => String(s).toLowerCase().includes(needle))
      );
    }
    return list;
  }, [paymentVouchers.data, receiptVouchers.data, tab, modeFilter, q]);

  const totalAmount = allRows.reduce((s, r) => s + r.amount, 0);
  const isLoading = paymentVouchers.isLoading || receiptVouchers.isLoading;

  return (
    <>
      <PageHeader
        title="Receipt & Payment"
        description="View and manage payment vouchers and receipt vouchers."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/receipt-payment/receipt-voucher/new">
                <Plus className="mr-2 h-4 w-4" />
                New Receipt Voucher
              </Link>
            </Button>
            <Button asChild>
              <Link to="/receipt-payment/payment-voucher/new">
                <Plus className="mr-2 h-4 w-4" />
                New Payment Voucher
              </Link>
            </Button>
          </div>
        }
      />
      <div className="space-y-4 p-6">
        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="payment">Payments</TabsTrigger>
            <TabsTrigger value="receipt">Receipts</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filters */}
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
              {Object.entries(MODES).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto text-sm text-muted-foreground">
            {allRows.length} voucher{allRows.length !== 1 ? "s" : ""} • Total:{" "}
            <span className="font-medium text-foreground">{inr(totalAmount)}</span>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Type</TableHead>
                <TableHead className="w-36">Voucher No.</TableHead>
                <TableHead className="w-28">Date</TableHead>
                <TableHead>Party</TableHead>
                <TableHead className="w-32">Mode</TableHead>
                <TableHead className="w-28">Ref. No.</TableHead>
                <TableHead className="w-36 text-right">Amount</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="w-20">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : allRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                    <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
                    No vouchers found.
                  </TableCell>
                </TableRow>
              ) : (
                allRows.map((r) => (
                  <TableRow key={`${r.type}-${r.id}`}>
                    <TableCell>
                      <Badge
                        variant={r.type === "receipt" ? "default" : "secondary"}
                        className="text-xs gap-1"
                      >
                        {r.type === "receipt" ? (
                          <ArrowDownCircle className="h-3 w-3" />
                        ) : (
                          <ArrowUpCircle className="h-3 w-3" />
                        )}
                        {r.type === "receipt" ? "Receipt" : "Payment"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium font-mono">
                      {r.voucher_number}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(r.date, dateFormat)}
                    </TableCell>
                    <TableCell>{r.party_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {MODES[r.mode] || r.mode}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.reference_number || "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {inr(r.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === "final" ? "default" : "secondary"}>
                        {r.status === "final" ? "Final" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link
                          to={r.type === "receipt"
                            ? "/receipt-payment/receipt-voucher/$id"
                            : "/receipt-payment/payment-voucher/$id"}
                          params={{ id: r.id }}
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
