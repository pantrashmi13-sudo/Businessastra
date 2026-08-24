import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { inr } from "@/lib/format";
import { formatDate } from "@/lib/date-conversion";
import { useDateFormat } from "@/hooks/use-date-format";
import { BsDatePicker } from "@/components/ui/bs-date-picker";
import { ArrowDownLeft, ArrowUpRight, Scale, Info } from "lucide-react";

export const Route = createFileRoute("/vat-register")({
  component: VATRegisterPage,
});

interface PurchaseBillRow {
  id: string;
  bill_number: string | null;
  invoice_date: string | null;
  vendor_id: string | null;
  vendors: { name: string } | null;
  taxable_amount: number;
  vat_amount: number;
  final_amount: number;
  tax_type: string;
  status: string;
}

interface SalesInvoiceRow {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_id: string | null;
  customers: { name: string; vat_number?: string | null } | null;
  subtotal: number;
  discount: number;
  vat_amount: number;
  total_amount: number;
  invoice_type: "pan" | "vat";
  status: string;
}

interface PurchaseReturnRow {
  id: string;
  return_number: string;
  return_date: string;
  vendor_id: string | null;
  vendors: { name: string } | null;
  taxable_amount: number;
  vat_amount: number;
  total_amount: number;
  status: string;
}

interface SalesReturnRow {
  id: string;
  return_number: string;
  return_date: string;
  customer_id: string | null;
  customers: { name: string } | null;
  subtotal: number;
  discount: number;
  vat_amount: number;
  total_amount: number;
  status: string;
}

function DateFilterInput({
  label,
  value,
  onChange,
  isBS,
}: {
  label: string;
  value: string;
  onChange: (adDate: string) => void;
  isBS: boolean;
}) {
  if (isBS) {
    return (
      <div className="space-y-1">
        <Label className="text-xs">{label} (BS)</Label>
        <BsDatePicker value={value} onChange={onChange} className="w-44 h-9" />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs">{label} (AD)</Label>
      <Input
        type="date"
        className="w-44 h-9"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function VATRegisterPage() {
  const [tab, setTab] = useState("summary");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const dateFormat = useDateFormat();
  const isBS = dateFormat === "bs";

  // Query Purchase Bills (Input VAT)
  const { data: purchases, isLoading: purchasesLoading } = useQuery({
    queryKey: ["vat-register", "purchases", fromDate, toDate],
    queryFn: async () => {
      let query = supabase
        .from("bills")
        .select("*, vendors(name)")
        .eq("status", "approved");

      if (fromDate) {
        query = query.gte("invoice_date", fromDate);
      }
      if (toDate) {
        query = query.lte("invoice_date", toDate);
      }

      const { data, error } = await query.order("invoice_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PurchaseBillRow[];
    },
  });

  // Query Sales Invoices (Output VAT)
  const { data: sales, isLoading: salesLoading } = useQuery({
    queryKey: ["vat-register", "sales", fromDate, toDate],
    queryFn: async () => {
      let query = supabase
        .from("sales_invoices" as any)
        .select("*, customers(name, vat_number)")
        .eq("status", "final"); // approved invoices have status = 'final'

      if (fromDate) {
        query = query.gte("invoice_date", fromDate);
      }
      if (toDate) {
        query = query.lte("invoice_date", toDate);
      }

      const { data, error } = await query.order("invoice_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SalesInvoiceRow[];
    },
  });

  // Query Purchase Returns (reduces Input VAT)
  const { data: purchaseReturns, isLoading: purchaseReturnsLoading } = useQuery({
    queryKey: ["vat-register", "purchase-returns", fromDate, toDate],
    queryFn: async () => {
      let query = supabase
        .from("purchase_returns")
        .select("*, vendors(name)")
        .eq("status", "approved");

      if (fromDate) {
        query = query.gte("return_date", fromDate);
      }
      if (toDate) {
        query = query.lte("return_date", toDate);
      }

      const { data, error } = await query.order("return_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PurchaseReturnRow[];
    },
  });

  // Query Sales Returns (reduces Output VAT)
  const { data: salesReturns, isLoading: salesReturnsLoading } = useQuery({
    queryKey: ["vat-register", "sales-returns", fromDate, toDate],
    queryFn: async () => {
      let query = supabase
        .from("sales_returns")
        .select("*, customers(name)")
        .eq("status", "approved");

      if (fromDate) {
        query = query.gte("return_date", fromDate);
      }
      if (toDate) {
        query = query.lte("return_date", toDate);
      }

      const { data, error } = await query.order("return_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SalesReturnRow[];
    },
  });

  // Input VAT calculations (from Purchases minus Purchase Returns)
  const purchaseTotals = useMemo(() => {
    if (!purchases) return { taxable: 0, vat: 0, total: 0 };
    const purchaseSum = purchases.reduce(
      (acc, b) => ({
        taxable: acc.taxable + (Number(b.taxable_amount) || 0),
        vat: acc.vat + (Number(b.vat_amount) || 0),
        total: acc.total + (Number(b.final_amount) || 0),
      }),
      { taxable: 0, vat: 0, total: 0 }
    );
    // Subtract purchase returns
    const returnSum = (purchaseReturns || []).reduce(
      (acc, r) => ({
        taxable: acc.taxable + (Number(r.taxable_amount) || 0),
        vat: acc.vat + (Number(r.vat_amount) || 0),
        total: acc.total + (Number(r.total_amount) || 0),
      }),
      { taxable: 0, vat: 0, total: 0 }
    );
    return {
      taxable: purchaseSum.taxable - returnSum.taxable,
      vat: purchaseSum.vat - returnSum.vat,
      total: purchaseSum.total - returnSum.total,
    };
  }, [purchases, purchaseReturns]);

  // Output VAT calculations (from Sales minus Sales Returns)
  const salesTotals = useMemo(() => {
    if (!sales) return { taxable: 0, vat: 0, total: 0 };
    const salesSum = sales.reduce(
      (acc, s) => ({
        taxable: acc.taxable + (Number(s.subtotal || 0) - Number(s.discount || 0)),
        vat: acc.vat + (Number(s.vat_amount) || 0),
        total: acc.total + (Number(s.total_amount) || 0),
      }),
      { taxable: 0, vat: 0, total: 0 }
    );
    // Subtract sales returns
    const returnSum = (salesReturns || []).reduce(
      (acc, r) => ({
        taxable: acc.taxable + (Number(r.subtotal || 0) - Number(r.discount || 0)),
        vat: acc.vat + (Number(r.vat_amount) || 0),
        total: acc.total + (Number(r.total_amount) || 0),
      }),
      { taxable: 0, vat: 0, total: 0 }
    );
    return {
      taxable: salesSum.taxable - returnSum.taxable,
      vat: salesSum.vat - returnSum.vat,
      total: salesSum.total - returnSum.total,
    };
  }, [sales, salesReturns]);

  // Net VAT Balance calculations
  const netVat = useMemo(() => {
    const diff = salesTotals.vat - purchaseTotals.vat;
    return {
      amount: Math.abs(diff),
      isPayable: diff >= 0,
    };
  }, [salesTotals.vat, purchaseTotals.vat]);

  const isLoading = purchasesLoading || salesLoading || purchaseReturnsLoading || salesReturnsLoading;

  return (
    <>
      <PageHeader
        title="VAT Register"
        description="Consolidated Tax Register showing Input VAT from purchases, Output VAT from approved sales, and the net tax balance."
      />

      <div className="p-6 space-y-6">
        {/* Date Filter Controls */}
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-4">
              <DateFilterInput
                label="From Date"
                value={fromDate}
                onChange={setFromDate}
                isBS={isBS}
              />
              <DateFilterInput
                label="To Date"
                value={toDate}
                onChange={setToDate}
                isBS={isBS}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                }}
                className="h-9"
              >
                Clear Filters
              </Button>
              {(fromDate || toDate) && (
                <Badge variant="secondary" className="mb-1 py-1 px-2.5">
                  Range: {fromDate ? formatDate(fromDate, dateFormat) : "Start"} — {toDate ? formatDate(toDate, dateFormat) : "End"}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dashboard KPI cards */}
        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Input VAT Card */}
            <Card className="shadow-sm border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Input VAT (Purchases)</CardTitle>
                <ArrowDownLeft className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{inr(purchaseTotals.vat)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  From {purchases?.length || 0} bills
                  {purchaseReturns?.length ? ` (${purchaseReturns.length} returns)` : ""}
                </p>
                <div className="text-xs text-muted-foreground/80 mt-0.5">
                  Taxable Purchase: <span className="font-mono">{inr(purchaseTotals.taxable)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Output VAT Card */}
            <Card className="shadow-sm border-l-4 border-l-amber-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Output VAT (Sales)</CardTitle>
                <ArrowUpRight className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{inr(salesTotals.vat)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  From {sales?.length || 0} invoices
                  {salesReturns?.length ? ` (${salesReturns.length} returns)` : ""}
                </p>
                <div className="text-xs text-muted-foreground/80 mt-0.5">
                  Taxable Sales: <span className="font-mono">{inr(salesTotals.taxable)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Net Balance Card */}
            <Card className={`shadow-sm border-l-4 ${netVat.isPayable ? "border-l-red-500 bg-red-50/20" : "border-l-emerald-500 bg-emerald-50/20"}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Net VAT Balance</CardTitle>
                <Scale className={`h-4 w-4 ${netVat.isPayable ? "text-red-500" : "text-emerald-500"}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold font-mono ${netVat.isPayable ? "text-red-600" : "text-emerald-600"}`}>
                  {inr(netVat.amount)}
                </div>
                <Badge variant={netVat.isPayable ? "destructive" : "default"} className="mt-1">
                  {netVat.isPayable ? "VAT Payable to Govt." : "VAT Credit/Receivable"}
                </Badge>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Formula: Output VAT - Input VAT
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Loading VAT registers…</p>
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="summary">Summary Sheet</TabsTrigger>
              <TabsTrigger value="sales">Sales Register (Output)</TabsTrigger>
              <TabsTrigger value="purchases">Purchase Register (Input)</TabsTrigger>
            </TabsList>

            {/* Tab 1: Summary Sheet */}
            <TabsContent value="summary" className="space-y-4">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-1.5">
                    <Info className="h-4 w-4 text-primary" /> Tax Reconciliation Statement
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="w-1/2">Particulars</TableHead>
                          <TableHead className="text-right">Taxable Amount</TableHead>
                          <TableHead className="text-right">VAT Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* Sales Section */}
                        <TableRow className="bg-amber-50/30">
                          <TableCell className="font-medium">
                            Sales (Output VAT from Approved Invoices)
                          </TableCell>
                          <TableCell className="text-right font-mono">{inr(salesTotals.taxable + (salesReturns || []).reduce((acc, r) => acc + (Number(r.subtotal || 0) - Number(r.discount || 0)), 0))}</TableCell>
                          <TableCell className="text-right font-mono text-amber-600 font-semibold">{inr(salesTotals.vat + (salesReturns || []).reduce((acc, r) => acc + (Number(r.vat_amount) || 0), 0))}</TableCell>
                        </TableRow>
                        <TableRow className="bg-red-50/30">
                          <TableCell className="font-medium pl-8 text-red-600">
                            Less: Sales Returns
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-600">-{inr((salesReturns || []).reduce((acc, r) => acc + (Number(r.subtotal || 0) - Number(r.discount || 0)), 0))}</TableCell>
                          <TableCell className="text-right font-mono text-red-600">-{inr((salesReturns || []).reduce((acc, r) => acc + (Number(r.vat_amount) || 0), 0))}</TableCell>
                        </TableRow>
                        <TableRow className="border-b-2 bg-muted/30">
                          <TableCell className="font-semibold">
                            Net Output VAT (Sales - Returns)
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">{inr(salesTotals.taxable)}</TableCell>
                          <TableCell className="text-right font-mono text-amber-600 font-semibold">{inr(salesTotals.vat)}</TableCell>
                        </TableRow>

                        {/* Purchases Section */}
                        <TableRow className="bg-blue-50/30">
                          <TableCell className="font-medium">
                            Purchases (Input VAT from Approved Bills)
                          </TableCell>
                          <TableCell className="text-right font-mono">{inr(purchaseTotals.taxable + (purchaseReturns || []).reduce((acc, r) => acc + (Number(r.taxable_amount) || 0), 0))}</TableCell>
                          <TableCell className="text-right font-mono text-blue-600 font-semibold">{inr(purchaseTotals.vat + (purchaseReturns || []).reduce((acc, r) => acc + (Number(r.vat_amount) || 0), 0))}</TableCell>
                        </TableRow>
                        <TableRow className="bg-red-50/30">
                          <TableCell className="font-medium pl-8 text-red-600">
                            Less: Purchase Returns
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-600">-{inr((purchaseReturns || []).reduce((acc, r) => acc + (Number(r.taxable_amount) || 0), 0))}</TableCell>
                          <TableCell className="text-right font-mono text-red-600">-{inr((purchaseReturns || []).reduce((acc, r) => acc + (Number(r.vat_amount) || 0), 0))}</TableCell>
                        </TableRow>
                        <TableRow className="border-b-2 bg-muted/30">
                          <TableCell className="font-semibold">
                            Net Input VAT (Purchases - Returns)
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">{inr(purchaseTotals.taxable)}</TableCell>
                          <TableCell className="text-right font-mono text-blue-600 font-semibold">{inr(purchaseTotals.vat)}</TableCell>
                        </TableRow>

                        {/* Net Balance */}
                        <TableRow className="bg-muted/40 font-bold text-base">
                          <TableCell>
                            {netVat.isPayable ? "Net VAT Payable (Output > Input)" : "Net VAT Receivable / Credit (Input > Output)"}
                          </TableCell>
                          <TableCell className="text-right">—</TableCell>
                          <TableCell className={`text-right font-mono ${netVat.isPayable ? "text-red-600" : "text-emerald-600"}`}>
                            {inr(netVat.amount)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-3">
                    Formula: Net Output VAT - Net Input VAT = {netVat.isPayable ? "VAT Payable" : "VAT Credit/Receivable"}
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 2: Sales Register */}
            <TabsContent value="sales" className="space-y-4">
              <Card className="shadow-sm">
                <CardContent className="pt-6">
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Taxable Sales</TableHead>
                          <TableHead className="text-right">VAT Amount</TableHead>
                          <TableHead className="text-right">Total Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(!sales || sales.length === 0) && (!salesReturns || salesReturns.length === 0) ? (
                          <TableRow>
                            <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                              No approved sales invoices or returns found for this period.
                            </TableCell>
                          </TableRow>
                        ) : (
                          <>
                            {sales?.map((s) => (
                              <TableRow key={s.id}>
                                <TableCell className="font-medium font-mono text-primary">{s.invoice_number}</TableCell>
                                <TableCell className="text-xs">{formatDate(s.invoice_date, dateFormat)}</TableCell>
                                <TableCell>
                                  <div className="font-normal text-sm">{s.customers?.name || "—"}</div>
                                  {s.customers?.vat_number && (
                                    <div className="text-[10px] text-muted-foreground">PAN/VAT: {s.customers.vat_number}</div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={s.invoice_type === "vat" ? "default" : "secondary"} className="text-[10px] py-0 px-1.5 uppercase">
                                    {s.invoice_type}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-mono tabular-nums text-sm">
                                  {inr(Number(s.subtotal || 0) - Number(s.discount || 0))}
                                </TableCell>
                                <TableCell className="text-right font-mono tabular-nums text-sm text-amber-600">
                                  {inr(s.vat_amount)}
                                </TableCell>
                                <TableCell className="text-right font-mono tabular-nums text-sm font-semibold">
                                  {inr(s.total_amount)}
                                </TableCell>
                              </TableRow>
                            ))}
                            {salesReturns?.map((r) => (
                              <TableRow key={r.id} className="bg-red-50/30">
                                <TableCell className="font-medium font-mono text-red-600">{r.return_number}</TableCell>
                                <TableCell className="text-xs">{formatDate(r.return_date, dateFormat)}</TableCell>
                                <TableCell>
                                  <div className="font-normal text-sm">{r.customers?.name || "—"}</div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                                    Sales Return
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-mono tabular-nums text-sm text-red-600">
                                  -{inr(Number(r.subtotal || 0) - Number(r.discount || 0))}
                                </TableCell>
                                <TableCell className="text-right font-mono tabular-nums text-sm text-red-600">
                                  -{inr(r.vat_amount)}
                                </TableCell>
                                <TableCell className="text-right font-mono tabular-nums text-sm font-semibold text-red-600">
                                  -{inr(r.total_amount)}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/50 font-semibold text-sm">
                              <TableCell colSpan={4}>Net Sales (After Returns)</TableCell>
                              <TableCell className="text-right font-mono">{inr(salesTotals.taxable)}</TableCell>
                              <TableCell className="text-right font-mono text-amber-600">{inr(salesTotals.vat)}</TableCell>
                              <TableCell className="text-right font-mono">{inr(salesTotals.total)}</TableCell>
                            </TableRow>
                          </>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 3: Purchase Register */}
            <TabsContent value="purchases" className="space-y-4">
              <Card className="shadow-sm">
                <CardContent className="pt-6">
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Bill #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Taxable Purchases</TableHead>
                          <TableHead className="text-right">VAT Amount</TableHead>
                          <TableHead className="text-right">Total Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(!purchases || purchases.length === 0) && (!purchaseReturns || purchaseReturns.length === 0) ? (
                          <TableRow>
                            <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                              No approved purchase bills or returns found for this period.
                            </TableCell>
                          </TableRow>
                        ) : (
                          <>
                            {purchases?.map((b) => (
                              <TableRow key={b.id}>
                                <TableCell className="font-medium font-mono text-primary">{b.bill_number || "—"}</TableCell>
                                <TableCell className="text-xs">{formatDate(b.invoice_date, dateFormat)}</TableCell>
                                <TableCell className="text-sm">{b.vendors?.name || "—"}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 uppercase">
                                    {b.tax_type || "vat"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-mono tabular-nums text-sm">
                                  {inr(b.taxable_amount)}
                                </TableCell>
                                <TableCell className="text-right font-mono tabular-nums text-sm text-blue-600">
                                  {inr(b.vat_amount)}
                                </TableCell>
                                <TableCell className="text-right font-mono tabular-nums text-sm font-semibold">
                                  {inr(b.final_amount)}
                                </TableCell>
                              </TableRow>
                            ))}
                            {purchaseReturns?.map((r) => (
                              <TableRow key={r.id} className="bg-red-50/30">
                                <TableCell className="font-medium font-mono text-red-600">{r.return_number}</TableCell>
                                <TableCell className="text-xs">{formatDate(r.return_date, dateFormat)}</TableCell>
                                <TableCell className="text-sm">{r.vendors?.name || "—"}</TableCell>
                                <TableCell>
                                  <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                                    Purchase Return
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-mono tabular-nums text-sm text-red-600">
                                  -{inr(r.taxable_amount)}
                                </TableCell>
                                <TableCell className="text-right font-mono tabular-nums text-sm text-red-600">
                                  -{inr(r.vat_amount)}
                                </TableCell>
                                <TableCell className="text-right font-mono tabular-nums text-sm font-semibold text-red-600">
                                  -{inr(r.total_amount)}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/50 font-semibold text-sm">
                              <TableCell colSpan={4}>Net Purchases (After Returns)</TableCell>
                              <TableCell className="text-right font-mono">{inr(purchaseTotals.taxable)}</TableCell>
                              <TableCell className="text-right font-mono text-blue-600">{inr(purchaseTotals.vat)}</TableCell>
                              <TableCell className="text-right font-mono">{inr(purchaseTotals.total)}</TableCell>
                            </TableRow>
                          </>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </>
  );
}
