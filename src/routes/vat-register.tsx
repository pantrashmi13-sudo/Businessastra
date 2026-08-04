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
import { Card, CardContent } from "@/components/ui/card";
import { inr } from "@/lib/format";
import { formatDate } from "@/lib/date-conversion";
import { useDateFormat } from "@/hooks/use-date-format";
import { BsDatePicker } from "@/components/ui/bs-date-picker";

export const Route = createFileRoute("/vat-register")({
  component: VATRegisterPage,
});

interface BillRow {
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

interface BillLineRow {
  id: string;
  bill_id: string;
  name: string;
  quantity: number;
  per_unit: number;
  vat_rate: number;
  line_amount: number;
  bills: {
    bill_number: string | null;
    invoice_date: string | null;
    vendors: { name: string } | null;
  } | null;
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
        <BsDatePicker value={value} onChange={onChange} />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs">{label} (AD)</Label>
      <Input
        type="date"
        className="w-44"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function VATRegisterPage() {
  const [tab, setTab] = useState("invoice");
  // fromDate/toDate always store AD dates internally
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const dateFormat = useDateFormat();
  const isBS = dateFormat === "bs";

  const { data: bills, isLoading: billsLoading } = useQuery({
    queryKey: ["vat-register", "bills", fromDate, toDate],
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
      return (data ?? []) as BillRow[];
    },
  });

  const { data: lines, isLoading: linesLoading } = useQuery({
    queryKey: ["vat-register", "lines", fromDate, toDate],
    queryFn: async () => {
      let query = supabase
        .from("bill_lines")
        .select("*, bills(bill_number, invoice_date, vendors(name))")
        .gt("vat_rate", 0);

      if (fromDate) {
        query = query.gte("bills.invoice_date", fromDate);
      }
      if (toDate) {
        query = query.lte("bills.invoice_date", toDate);
      }

      const { data, error } = await query.order("vat_rate", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BillLineRow[];
    },
  });

  const invoiceSummary = useMemo(() => {
    if (!bills) return [];
    return bills.map((b) => ({
      id: b.id,
      bill_number: b.bill_number || "—",
      invoice_date: b.invoice_date || "—",
      vendor: b.vendors?.name || "—",
      taxable_amount: Number(b.taxable_amount) || 0,
      vat_amount: Number(b.vat_amount) || 0,
      final_amount: Number(b.final_amount) || 0,
      tax_type: b.tax_type || "vat",
    }));
  }, [bills]);

  const invoiceTotals = useMemo(() => {
    return invoiceSummary.reduce(
      (acc, r) => ({
        taxable: acc.taxable + r.taxable_amount,
        vat: acc.vat + r.vat_amount,
        total: acc.total + r.final_amount,
      }),
      { taxable: 0, vat: 0, total: 0 },
    );
  }, [invoiceSummary]);

  const itemSummary = useMemo(() => {
    if (!lines) return [];
    const grouped = new Map<string, { name: string; vat_rate: number; total_qty: number; total_amount: number; total_vat: number }>();

    for (const l of lines) {
      const key = `${l.name}_${l.vat_rate}`;
      const existing = grouped.get(key);
      const lineVat = (Number(l.line_amount) * Number(l.vat_rate)) / 100;
      if (existing) {
        existing.total_qty += Number(l.quantity);
        existing.total_amount += Number(l.line_amount);
        existing.total_vat += lineVat;
      } else {
        grouped.set(key, {
          name: l.name,
          vat_rate: Number(l.vat_rate),
          total_qty: Number(l.quantity),
          total_amount: Number(l.line_amount),
          total_vat: lineVat,
        });
      }
    }

    return Array.from(grouped.values()).sort((a, b) => b.vat_rate - a.vat_rate);
  }, [lines]);

  const itemTotals = useMemo(() => {
    return itemSummary.reduce(
      (acc, r) => ({
        amount: acc.amount + r.total_amount,
        vat: acc.vat + r.total_vat,
      }),
      { amount: 0, vat: 0 },
    );
  }, [itemSummary]);

  const isLoading = billsLoading || linesLoading;

  return (
    <>
      <PageHeader
        title="VAT Register"
        description="Tax summary for approved invoices — invoice-wise and item-wise breakdown."
      />

      <div className="p-6 space-y-4">
        <Card>
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
              >
                Clear
              </Button>
              {(fromDate || toDate) && (
                <Badge variant="secondary" className="ml-2">
                  Filtered: {formatDate(fromDate, dateFormat)} — {formatDate(toDate, dateFormat)}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Loading VAT data…</p>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="invoice">Invoice-wise</TabsTrigger>
              <TabsTrigger value="item">Item-wise</TabsTrigger>
            </TabsList>

            <TabsContent value="invoice" className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Bill #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead className="text-right">Taxable</TableHead>
                          <TableHead className="text-right">VAT</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoiceSummary.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                              No approved bills found for the selected date range.
                            </TableCell>
                          </TableRow>
                        ) : (
                          <>
                            {invoiceSummary.map((r) => (
                              <TableRow key={r.id}>
                                <TableCell className="font-medium">{r.bill_number}</TableCell>
                                <TableCell>{formatDate(r.invoice_date, dateFormat)}</TableCell>
                                <TableCell>{r.vendor}</TableCell>
                                <TableCell className="text-right tabular-nums">{inr(r.taxable_amount)}</TableCell>
                                <TableCell className="text-right tabular-nums">{inr(r.vat_amount)}</TableCell>
                                <TableCell className="text-right tabular-nums font-medium">{inr(r.final_amount)}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/50 font-semibold">
                              <TableCell colSpan={3}>Total</TableCell>
                              <TableCell className="text-right tabular-nums">{inr(invoiceTotals.taxable)}</TableCell>
                              <TableCell className="text-right tabular-nums">{inr(invoiceTotals.vat)}</TableCell>
                              <TableCell className="text-right tabular-nums">{inr(invoiceTotals.total)}</TableCell>
                            </TableRow>
                          </>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="item" className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item Name</TableHead>
                          <TableHead className="text-right">VAT %</TableHead>
                          <TableHead className="text-right">Total Qty</TableHead>
                          <TableHead className="text-right">Total Amount</TableHead>
                          <TableHead className="text-right">Total VAT</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itemSummary.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                              No items with VAT found for the selected date range.
                            </TableCell>
                          </TableRow>
                        ) : (
                          <>
                            {itemSummary.map((r, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium">{r.name}</TableCell>
                                <TableCell className="text-right">
                                  <Badge variant="outline">{r.vat_rate}%</Badge>
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{r.total_qty}</TableCell>
                                <TableCell className="text-right tabular-nums">{inr(r.total_amount)}</TableCell>
                                <TableCell className="text-right tabular-nums font-medium">{inr(r.total_vat)}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/50 font-semibold">
                              <TableCell>Total</TableCell>
                              <TableCell />
                              <TableCell />
                              <TableCell className="text-right tabular-nums">{inr(itemTotals.amount)}</TableCell>
                              <TableCell className="text-right tabular-nums">{inr(itemTotals.vat)}</TableCell>
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
