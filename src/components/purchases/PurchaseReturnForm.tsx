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
import { Badge } from "@/components/ui/badge";
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

interface BillLine {
  id: string;
  ref_id: string | null;
  code: string | null;
  name: string;
  uom: string | null;
  quantity: number;
  per_unit: number;
  vat_rate: number;
  line_amount: number;
  lot_number: string | null;
  expiry_date: string | null;
}

export default function PurchaseReturnForm() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [selectedBillId, setSelectedBillId] = useState<string>("");
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<ReturnLine[]>([]);
  const [notes, setNotes] = useState("");

  // Fetch approved bills
  const bills = useQuery({
    queryKey: ["bills-for-return"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select("id, bill_number, internal_bill_number, invoice_date, vendor_id, vendors(name)")
        .eq("status", "approved")
        .eq("bill_type", "items")
        .order("invoice_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch selected bill details
  const selectedBill = useQuery({
    queryKey: ["bill-for-return", selectedBillId],
    queryFn: async () => {
      if (!selectedBillId) return null;
      const { data, error } = await supabase
        .from("bills")
        .select("*, vendors(name, id)")
        .eq("id", selectedBillId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedBillId,
  });

  // Fetch bill lines
  const billLines = useQuery({
    queryKey: ["bill-lines-for-return", selectedBillId],
    queryFn: async () => {
      if (!selectedBillId) return [];
      const { data, error } = await supabase
        .from("bill_lines")
        .select("*")
        .eq("bill_id", selectedBillId)
        .order("sno");
      if (error) throw error;
      return (data || []) as BillLine[];
    },
    enabled: !!selectedBillId,
  });

  // Fetch existing returns for this bill to calculate remaining returnable quantities
  const existingReturns = useQuery({
    queryKey: ["purchase-returns-for-bill", selectedBillId],
    queryFn: async () => {
      if (!selectedBillId) return [];
      const { data, error } = await supabase
        .from("purchase_return_lines")
        .select("ref_id, quantity, purchase_returns!inner(original_bill_id, status)")
        .eq("purchase_returns.original_bill_id", selectedBillId)
        .eq("purchase_returns.status", "approved");
      if (error) throw error;
      return (data || []) as { ref_id: string | null; quantity: number }[];
    },
    enabled: !!selectedBillId,
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
    return {
      taxable_amount: Math.round(subtotal * 100) / 100,
      vat_amount: Math.round(vat * 100) / 100,
      total_amount: Math.round((subtotal + vat) * 100) / 100,
    };
  }, [lines]);

  // Load bill lines into return lines
  const loadBillLines = () => {
    if (!billLines.data) return;
    const returnLines: ReturnLine[] = billLines.data.map((bl, idx) => {
      const returned = returnedQtyMap.get(bl.ref_id || "") || 0;
      const maxQty = Number(bl.quantity || 0) - returned;
      return {
        sno: idx + 1,
        ref_id: bl.ref_id,
        code: bl.code || "",
        name: bl.name,
        uom: bl.uom || "NOS",
        quantity: Math.max(0, maxQty),
        original_per_unit: Number(bl.per_unit || 0),
        per_unit: Number(bl.per_unit || 0),
        vat_rate: Number(bl.vat_rate || 0),
        line_amount: computeLineAmount(Math.max(0, maxQty), bl.per_unit),
        max_quantity: Math.max(0, maxQty),
      };
    }).filter(l => l.max_quantity > 0);
    setLines(returnLines);
  };

  // Generate return number
  const generateReturnNumber = async (): Promise<string> => {
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prefix = `PR-${ym}-`;
    const { data } = await supabase
      .from("purchase_returns")
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
      if (!selectedBillId) throw new Error("Please select a bill");
      if (!selectedBill.data) throw new Error("Bill data not loaded");
      if (lines.length === 0) throw new Error("Add at least one item to return");

      const validLines = lines.filter(l => l.quantity > 0);
      if (validLines.length === 0) throw new Error("Return quantity must be greater than 0");

      const returnNumber = await generateReturnNumber();
      const vendor = selectedBill.data.vendors;

      // Insert purchase_returns header
      const { data: returnRow, error: headerErr } = await supabase
        .from("purchase_returns")
        .insert({
          return_number: returnNumber,
          return_date: returnDate,
          original_bill_id: selectedBillId,
          vendor_id: vendor?.id || selectedBill.data.vendor_id || "",
          company_id: selectedBill.data.company_id,
          taxable_amount: totals.taxable_amount,
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
      const { error: linesErr } = await supabase.from("purchase_return_lines").insert(linePayloads);
      if (linesErr) throw linesErr;

      // On approve: create stock ledger outward entry and ledger debit entry
      if (opts.approve) {
        // Stock ledger outward entries
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
          const newQty = prevQty - Number(lp.quantity || 0);
          const newAmount = prevAmount - Number(lp.per_unit || 0) * Number(lp.quantity || 0);

          stockEntries.push({
            item_id: lp.ref_id,
            movement_type: "outward",
            doc_type: "purchase_return",
            doc_id: returnRow.id,
            doc_number: returnNumber,
            party_name: vendor?.name || "Vendor",
            quantity: lp.quantity,
            uom: lp.uom || "NOS",
            unit_rate: lp.per_unit,
            landing_unit_cost: lp.per_unit,
            line_amount: lp.line_amount,
            landing_total: lp.line_amount,
            running_qty: newQty,
            running_amount: newAmount,
            company_id: selectedBill.data.company_id,
          });
        }
        if (stockEntries.length > 0) {
          const { error: stockErr } = await supabase.from("stock_ledger" as any).insert(stockEntries as never);
          if (stockErr) throw new Error(`Stock ledger failed: ${stockErr.message}`);
        }

        // Update items.qty
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
            .update({ qty: currentQty - Number(lp.quantity || 0) })
            .eq("id", lp.ref_id);
        }

        // Ledger debit entry (reduces what we owe vendor)
        const { error: ledgerErr } = await supabase.from("ledgers").insert({
          vendor_id: vendor?.id || selectedBill.data.vendor_id || "",
          bill_id: selectedBillId,
          date: returnDate,
          description: `Purchase Return #${returnNumber}`,
          debit: totals.total_amount,
          credit: 0,
        });
        if (ledgerErr) throw new Error(`Ledger entry failed: ${ledgerErr.message}`);
      }

      return returnRow.id;
    },
    onSuccess: (id, vars) => {
      qc.invalidateQueries({ queryKey: ["purchase-returns"] });
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["ledgers"] });
      qc.invalidateQueries({ queryKey: ["stock_ledger"] });
      toast.success(vars.approve ? "Purchase Return approved" : "Draft saved");
      navigate({ to: "/purchase-returns" });
    },
    onError: (e: unknown) => {
      toast.error((e as Error).message || "Failed to save");
    },
  });

  const billLabel = (b: any) =>
    `${b.bill_number || b.internal_bill_number || "—"} (${b.vendors?.name || "Vendor"}) — ${b.invoice_date || ""}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Return"
        description="Return items to vendor against an existing bill"
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/purchase-returns" })}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to List
          </Button>
        }
      />

      {/* Bill Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Select Original Bill</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedBillId}
            onValueChange={(v) => {
              setSelectedBillId(v);
              setLines([]);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a bill to return against" />
            </SelectTrigger>
            <SelectContent>
              {(bills.data || []).map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {billLabel(b)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Return Details */}
      {selectedBillId && (
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
                  <Label className="text-xs font-medium text-muted-foreground">Vendor</Label>
                  <Input
                    value={selectedBill.data?.vendors?.name || ""}
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
              <Button onClick={loadBillLines} disabled={billLines.isLoading}>
                {billLines.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Load Bill Items
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
                      <span className="text-muted-foreground">Taxable Amount</span>
                      <span>{inr(totals.taxable_amount)}</span>
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
            <Button variant="ghost" onClick={() => navigate({ to: "/purchase-returns" })}>
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
