import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, ArrowLeft, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { inr, num, toNumber } from "@/lib/format";
import { computeLineAmount } from "@/lib/vat";

interface ReturnLine {
  sno: number;
  ref_id: string | null;
  code: string;
  name: string;
  uom: string;
  quantity: number;
  original_per_unit: number;
  per_unit: number;
  vat_rate: number;
  line_amount: number;
  max_quantity: number;
}

interface InvoiceLine {
  id: string;
  ref_id: string | null;
  code: string | null;
  name: string;
  uom: string | null;
  quantity: number;
  per_unit: number;
  vat_rate: number;
  line_amount: number;
}

export default function SalesReturnForm() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<ReturnLine[]>([]);
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState(0);

  // Fetch final sales invoices
  const invoices = useQuery({
    queryKey: ["sales-invoices-for-return"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_invoices" as any)
        .select("id, invoice_number, invoice_date, customer_id, customers(name)")
        .eq("status", "final")
        .order("invoice_date", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Fetch selected invoice details
  const selectedInvoice = useQuery({
    queryKey: ["sales-invoice-for-return", selectedInvoiceId],
    queryFn: async () => {
      if (!selectedInvoiceId) return null;
      const { data, error } = await supabase
        .from("sales_invoices" as any)
        .select("*, customers(name, id)")
        .eq("id", selectedInvoiceId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!selectedInvoiceId,
  });

  // Fetch invoice lines
  const invoiceLines = useQuery({
    queryKey: ["sales-invoice-lines-for-return", selectedInvoiceId],
    queryFn: async () => {
      if (!selectedInvoiceId) return [];
      const { data, error } = await supabase
        .from("sales_invoice_lines" as any)
        .select("*")
        .eq("invoice_id", selectedInvoiceId)
        .order("sno");
      if (error) throw error;
      return (data || []) as unknown as InvoiceLine[];
    },
    enabled: !!selectedInvoiceId,
  });

  // Fetch existing returns for this invoice
  const existingReturns = useQuery({
    queryKey: ["sales-returns-for-invoice", selectedInvoiceId],
    queryFn: async () => {
      if (!selectedInvoiceId) return [];
      const { data, error } = await supabase
        .from("sales_return_lines")
        .select("ref_id, quantity, sales_returns!inner(original_invoice_id, status)")
        .eq("sales_returns.original_invoice_id", selectedInvoiceId)
        .eq("sales_returns.status", "approved");
      if (error) throw error;
      return (data || []) as { ref_id: string | null; quantity: number }[];
    },
    enabled: !!selectedInvoiceId,
  });

  // Calculate already returned quantities per item
  const returnedQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of existingReturns.data || []) {
      if (r.ref_id) {
        map.set(r.ref_id, (map.get(r.ref_id) || 0) + Number(r.quantity || 0));
      }
    }
    return map;
  }, [existingReturns.data]);

  // Compute totals
  const totals = useMemo(() => {
    let subtotal = 0;
    let vat = 0;
    for (const l of lines) {
      const amt = computeLineAmount(l.quantity, l.per_unit);
      subtotal += amt;
      vat += amt * (l.vat_rate || 0) / 100;
    }
    const taxable = Math.round((subtotal - discount) * 100) / 100;
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      discount,
      taxable,
      vat_amount: Math.round(vat * 100) / 100,
      total_amount: Math.round((taxable + vat) * 100) / 100,
    };
  }, [lines, discount]);

  // Load invoice lines into return lines
  const loadInvoiceLines = () => {
    if (!invoiceLines.data) return;
    const returnLines: ReturnLine[] = invoiceLines.data.map((il, idx) => {
      const returned = returnedQtyMap.get(il.ref_id || "") || 0;
      const maxQty = Number(il.quantity || 0) - returned;
      return {
        sno: idx + 1,
        ref_id: il.ref_id,
        code: il.code || "",
        name: il.name,
        uom: il.uom || "NOS",
        quantity: Math.max(0, maxQty),
        original_per_unit: Number(il.per_unit || 0),
        per_unit: Number(il.per_unit || 0),
        vat_rate: Number(il.vat_rate || 0),
        line_amount: computeLineAmount(Math.max(0, maxQty), il.per_unit),
        max_quantity: Math.max(0, maxQty),
      };
    }).filter(l => l.max_quantity > 0);
    setLines(returnLines);
  };

  // Generate return number
  const generateReturnNumber = async (): Promise<string> => {
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prefix = `SR-${ym}-`;
    const { data } = await supabase
      .from("sales_returns")
      .select("return_number")
      .like("return_number", `${prefix}%`)
      .order("return_number", { ascending: false })
      .limit(1);
    const lastNum = data?.[0]?.return_number?.split("-").pop();
    const nextNum = lastNum ? String(parseInt(lastNum) + 1).padStart(3, "0") : "001";
    return `${prefix}${nextNum}`;
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (opts: { approve?: boolean } = {}) => {
      if (!selectedInvoiceId) throw new Error("Please select an invoice");
      if (!selectedInvoice.data) throw new Error("Invoice data not loaded");
      if (lines.length === 0) throw new Error("Add at least one item to return");

      const validLines = lines.filter(l => l.quantity > 0);
      if (validLines.length === 0) throw new Error("Return quantity must be greater than 0");

      const returnNumber = await generateReturnNumber();
      const customer = selectedInvoice.data.customers;

      // Insert sales_returns header
      const { data: returnRow, error: headerErr } = await supabase
        .from("sales_returns")
        .insert({
          return_number: returnNumber,
          return_date: returnDate,
          original_invoice_id: selectedInvoiceId,
          customer_id: customer?.id || selectedInvoice.data.customer_id,
          company_id: selectedInvoice.data.company_id,
          subtotal: totals.subtotal,
          discount: totals.discount,
          vat_amount: totals.vat_amount,
          total_amount: totals.total_amount,
          status: opts.approve ? "approved" : "draft",
          notes,
        })
        .select("id")
        .single();
      if (headerErr) throw headerErr;

      // Insert lines
      const linePayloads = validLines.map((l, idx) => ({
        return_id: returnRow.id,
        sno: idx + 1,
        ref_id: l.ref_id,
        code: l.code,
        name: l.name,
        uom: l.uom,
        quantity: l.quantity,
        original_per_unit: l.original_per_unit,
        per_unit: l.per_unit,
        vat_rate: l.vat_rate,
        line_amount: computeLineAmount(l.quantity, l.per_unit),
      }));
      const { error: linesErr } = await supabase.from("sales_return_lines").insert(linePayloads);
      if (linesErr) throw linesErr;

      // On approve: create stock ledger inward entry and update items.qty
      if (opts.approve) {
        const stockEntries = [];
        for (const lp of linePayloads) {
          if (!lp.ref_id) continue;
          const { data: lastEntry } = await supabase
            .from("stock_ledger" as any)
            .select("running_qty, running_amount")
            .eq("item_id", lp.ref_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const prevQty = Number((lastEntry as any)?.running_qty || 0);
          const prevAmount = Number((lastEntry as any)?.running_amount || 0);
          const newQty = prevQty + Number(lp.quantity || 0);
          const newAmount = prevAmount + Number(lp.per_unit || 0) * Number(lp.quantity || 0);

          stockEntries.push({
            item_id: lp.ref_id,
            movement_type: "inward",
            doc_type: "sales_return",
            doc_id: returnRow.id,
            doc_number: returnNumber,
            party_name: customer?.name || "Customer",
            quantity: lp.quantity,
            uom: lp.uom || "NOS",
            unit_rate: lp.per_unit,
            landing_unit_cost: lp.per_unit,
            line_amount: lp.line_amount,
            landing_total: lp.line_amount,
            running_qty: newQty,
            running_amount: newAmount,
            company_id: selectedInvoice.data.company_id,
          });
        }
        if (stockEntries.length > 0) {
          const { error: stockErr } = await supabase.from("stock_ledger" as any).insert(stockEntries as never);
          if (stockErr) throw new Error(`Stock ledger failed: ${stockErr.message}`);
        }

        // Update items.qty (increase)
        for (const lp of linePayloads) {
          if (!lp.ref_id) continue;
          const { data: item } = await supabase
            .from("items")
            .select("qty")
            .eq("id", lp.ref_id)
            .single();
          const currentQty = Number(item?.qty || 0);
          await supabase
            .from("items")
            .update({ qty: currentQty + Number(lp.quantity || 0) })
            .eq("id", lp.ref_id);
        }
      }

      return returnRow.id;
    },
    onSuccess: (id, vars) => {
      qc.invalidateQueries({ queryKey: ["sales-returns"] });
      qc.invalidateQueries({ queryKey: ["sales_invoices"] });
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["stock_ledger"] });
      toast.success(vars.approve ? "Sales Return approved" : "Draft saved");
      navigate({ to: "/sales-returns" });
    },
    onError: (e: unknown) => {
      toast.error((e as Error).message || "Failed to save");
    },
  });

  const invoiceLabel = (inv: { invoice_number: string; customers?: { name?: string } | null; invoice_date?: string }) =>
    `${inv.invoice_number} (${inv.customers?.name || "Customer"}) — ${inv.invoice_date || ""}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Return"
        description="Accept returned items from customer against an existing invoice"
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/sales-returns" })}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to List
          </Button>
        }
      />

      {/* Invoice Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Select Original Invoice</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedInvoiceId}
            onValueChange={(v) => {
              setSelectedInvoiceId(v);
              setLines([]);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose an invoice to return against" />
            </SelectTrigger>
            <SelectContent>
              {(invoices.data || []).map((inv) => (
                <SelectItem key={inv.id} value={inv.id}>
                  {invoiceLabel(inv)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Return Details */}
      {selectedInvoiceId && (
        <>
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Return Date</Label>
                  <Input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Customer</Label>
                  <Input
                    value={selectedInvoice.data?.customers?.name || ""}
                    disabled
                  />
                </div>
              </div>
              <div className="mt-4 space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
                <Textarea
                  rows={2}
                  placeholder="Return notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Load Items Button */}
          {lines.length === 0 && (
            <div className="flex justify-center">
              <Button onClick={loadInvoiceLines} disabled={invoiceLines.isLoading}>
                {invoiceLines.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Load Invoice Items
              </Button>
            </div>
          )}

          {/* Line Items */}
          {lines.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Return Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">S.No</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead className="w-20">UOM</TableHead>
                        <TableHead className="w-24">Max Qty</TableHead>
                        <TableHead className="w-24">Return Qty</TableHead>
                        <TableHead className="w-28">Orig. Price</TableHead>
                        <TableHead className="w-28">Return Price</TableHead>
                        <TableHead className="w-16">VAT %</TableHead>
                        <TableHead className="w-28 text-right">Amount</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((line, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-muted-foreground">{line.sno}</TableCell>
                          <TableCell>
                            <div>
                              <span className="font-medium">{line.name}</span>
                              {line.code && <span className="text-xs text-muted-foreground ml-1">({line.code})</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{line.uom}</TableCell>
                          <TableCell className="text-xs">{num(line.max_quantity, 3)}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="any"
                              min={0}
                              max={line.max_quantity}
                              value={line.quantity || ""}
                              onChange={(e) => {
                                const qty = Math.min(Number(e.target.value || 0), line.max_quantity);
                                const updated = [...lines];
                                updated[idx] = { ...line, quantity: qty };
                                setLines(updated);
                              }}
                              className="h-8 w-24"
                            />
                          </TableCell>
                          <TableCell className="text-xs">{inr(line.original_per_unit)}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="any"
                              min={0}
                              value={line.per_unit || ""}
                              onChange={(e) => {
                                const updated = [...lines];
                                updated[idx] = { ...line, per_unit: Number(e.target.value || 0) };
                                setLines(updated);
                              }}
                              className="h-8 w-28"
                            />
                          </TableCell>
                          <TableCell className="text-xs">{line.vat_rate}%</TableCell>
                          <TableCell className="text-right font-medium">
                            {inr(computeLineAmount(line.quantity, line.per_unit))}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Totals */}
                <div className="mt-4 flex justify-end">
                  <div className="w-72 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{inr(totals.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Discount</span>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="any"
                          min={0}
                          value={discount || ""}
                          onChange={(e) => setDiscount(Number(e.target.value || 0))}
                          className="h-7 w-24 text-right"
                        />
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">VAT Amount</span>
                      <span>{inr(totals.vat_amount)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold border-t pt-2">
                      <span>Total Return Value</span>
                      <span>{inr(totals.total_amount)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => navigate({ to: "/sales-returns" })}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => saveMutation.mutate({ approve: false })}
              disabled={saveMutation.isPending}
            >
              Save Draft
            </Button>
            <Button
              onClick={() => saveMutation.mutate({ approve: true })}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Approve & Post
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
