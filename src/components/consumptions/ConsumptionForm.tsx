import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  PackageMinus,
} from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { EntityCombobox, type EntityOption } from "@/components/bills/EntityCombobox";
import { itemSchema, itemFields } from "@/components/masters/schemas";
import { inr, num, toNumber } from "@/lib/format";
import { formatDate } from "@/lib/date-conversion";
import { useDateFormat } from "@/hooks/use-date-format";
import { BsDatePicker } from "@/components/ui/bs-date-picker";

interface ConsumptionLine {
  sno: number;
  ref_id: string | null;
  code: string;
  name: string;
  uom: string;
  quantity: number;
  per_unit: number;
}

interface ConsumptionFormProps {
  consumptionId?: string;
  initial?: {
    consumption: Record<string, unknown> | null;
    lines: Array<Record<string, unknown>>;
  } | null;
}

const emptyLine = (sno: number): ConsumptionLine => ({
  sno,
  ref_id: null,
  code: "",
  name: "",
  uom: "NOS",
  quantity: 1,
  per_unit: 0,
});

const lineTotal = (l: ConsumptionLine) => Number(l.quantity || 0) * Number(l.per_unit || 0);

export function ConsumptionForm({ consumptionId, initial }: ConsumptionFormProps) {
  const isNew = !consumptionId;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const dateFormat = useDateFormat();

  const existing = initial?.consumption as Record<string, unknown> | null | undefined;
  const existingLines = (initial?.lines ?? []) as Array<Record<string, unknown>>;

  const [consumptionNumber, setConsumptionNumber] = useState(
    (existing?.consumption_number as string) || `CONS-${new Date().toISOString().slice(0, 7).replace("-", "")}-${String(Math.floor(Math.random() * 900) + 100)}`,
  );
  const [consumptionDate, setConsumptionDate] = useState(
    (existing?.consumption_date as string) || new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState((existing?.notes as string) || "");
  const [lines, setLines] = useState<ConsumptionLine[]>(
    existingLines.length
      ? existingLines.map((r, i) => ({
          sno: (r.sno as number) || i + 1,
          ref_id: (r.ref_id as string) || null,
          code: (r.code as string) || "",
          name: (r.name as string) || "",
          uom: (r.uom as string) || "NOS",
          quantity: Number(r.quantity) || 1,
          per_unit: Number(r.per_unit) || 0,
        }))
      : [emptyLine(1)],
  );

  // Load Other Items (is_inventory = false) from items master
  const items = useQuery({
    queryKey: ["items", "other-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("is_inventory", false)
        .eq("is_service", false)
        .order("item_code");
      if (error) throw error;
      return data ?? [];
    },
  });

  const itemOptions: EntityOption[] = useMemo(
    () =>
      (items.data ?? []).map((i: Record<string, unknown>) => ({
        id: i.id as string,
        label: `${i.item_name} (Stock: ${num(Number(i.qty || 0))} ${i.uom || "NOS"})`,
        sublabel: `${i.item_code} · Available: ${num(Number(i.qty || 0))} ${i.uom || "NOS"}`,
        raw: i,
      })),
    [items.data],
  );

  const updateLine = (idx: number, patch: Partial<ConsumptionLine>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const addLine = () => {
    setLines((prev) => [...prev, emptyLine(prev.length + 1)]);
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx).map((l, i) => ({ ...l, sno: i + 1 })));
  };

  const totalAmount = useMemo(
    () => lines.reduce((sum, l) => sum + lineTotal(l), 0),
    [lines],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const validLines = lines.filter((l) => l.name.trim());
      if (!validLines.length) throw new Error("Add at least one line item.");

      const payload = {
        consumption_number: consumptionNumber,
        consumption_date: consumptionDate || null,
        notes: notes || null,
        company_id: null,
        status: "final",
      };

      let id = consumptionId;
      if (isNew) {
        const { data, error } = await supabase
          .from("consumptions")
          .insert(payload as never)
          .select("id")
          .single();
        if (error) throw error;
        id = (data as any)?.id;
      } else {
        const { error } = await supabase
          .from("consumptions")
          .update(payload as never)
          .eq("id", id!);
        if (error) throw error;
        // Delete old lines
        await supabase.from("consumption_lines").delete().eq("consumption_id", id!);
      }

      // Save line items
      const linePayloads = validLines.map((l) => ({
        consumption_id: id!,
        sno: l.sno,
        ref_id: l.ref_id,
        code: l.code || null,
        name: l.name,
        uom: l.uom || "NOS",
        quantity: toNumber(l.quantity, 1),
        per_unit: toNumber(l.per_unit, 0),
      }));

      if (linePayloads.length) {
        const { error } = await supabase.from("consumption_lines").insert(linePayloads as never);
        if (error) throw error;
      }

      // Decrement stock for consumed items
      for (const line of validLines.filter((l) => l.ref_id)) {
        const { data: currentItem } = await supabase
          .from("items")
          .select("id, qty")
          .eq("id", line.ref_id!)
          .maybeSingle();

        if (currentItem) {
          const newQty = Math.max(0, Number(currentItem.qty || 0) - Number(line.quantity || 0));
          await supabase
            .from("items")
            .update({ qty: newQty } as never)
            .eq("id", currentItem.id);
        }
      }

      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consumptions"] });
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success(`Consumption #${consumptionNumber} recorded & stock updated`);
      navigate({ to: "/consumptions" });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <>
      <PageHeader
        title={isNew ? "New Consumption" : `Consumption ${consumptionNumber}`}
        description="Record internal consumption of Other Items with real-time stock tracking."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              <PackageMinus className="mr-1 h-3.5 w-3.5" /> Internal Consumption
            </Badge>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1 h-4 w-4" />
              )}
              Save &amp; Deduct Stock
            </Button>
          </div>
        }
      />

      <div className="space-y-4 p-6">
        {/* Consumption Details Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PackageMinus className="h-4 w-4 text-primary" /> Consumption Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label className="mb-1 block text-xs font-medium text-muted-foreground">
                Consumption Number
              </Label>
              <Input
                value={consumptionNumber}
                onChange={(e) => setConsumptionNumber(e.target.value)}
                placeholder="CONS-202608-001"
              />
            </div>

            <div>
              <Label className="mb-1 block text-xs font-medium text-muted-foreground">
                Consumption Date
              </Label>
              {dateFormat === "bs" ? (
                <BsDatePicker
                  value={consumptionDate}
                  onChange={(adDate) => setConsumptionDate(adDate)}
                  className="w-full"
                />
              ) : (
                <Input
                  type="date"
                  value={consumptionDate}
                  onChange={(e) => setConsumptionDate(e.target.value)}
                />
              )}
            </div>

            <div className="md:col-span-2">
              <Label className="mb-1 block text-xs font-medium text-muted-foreground">
                Notes
              </Label>
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason for consumption, department, etc."
              />
            </div>
          </CardContent>
        </Card>

        {/* Line Items Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Consumed Items — Other Items
            </CardTitle>
            <Button variant="outline" size="sm" onClick={addLine}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add Item
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table className="table-fixed min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">S.No</TableHead>
                  <TableHead className="w-[260px]">Item</TableHead>
                  <TableHead className="w-[90px]">Code</TableHead>
                  <TableHead className="w-[80px]">UOM</TableHead>
                  <TableHead className="w-[100px] text-right">Qty</TableHead>
                  <TableHead className="w-[110px] text-right">Per Unit</TableHead>
                  <TableHead className="w-[110px] text-right">Amount</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-muted-foreground">{line.sno}</TableCell>
                    <TableCell>
                      <EntityCombobox
                        value={line.ref_id}
                        onChange={(id, row) => {
                          updateLine(idx, {
                            ref_id: id,
                            code: (row?.item_code as string) || "",
                            name: (row?.item_name as string) || "",
                            uom: (row?.uom as string) || "NOS",
                            per_unit: Number(row?.default_rate || 0),
                          });
                        }}
                        options={itemOptions}
                        placeholder="Select item..."
                        addLabel="Add new item"
                        table="items"
                        schema={itemSchema}
                        fields={itemFields}
                        nameKey="item_name"
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{line.code}</TableCell>
                    <TableCell className="text-xs">{line.uom}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={line.quantity}
                        onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                        className="h-8 text-right"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={line.per_unit}
                        onChange={(e) => updateLine(idx, { per_unit: Number(e.target.value) })}
                        className="h-8 text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {num(lineTotal(line))}
                    </TableCell>
                    <TableCell>
                      {lines.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => removeLine(idx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-3 flex justify-end border-t pt-3">
              <span className="text-sm font-semibold">Total: {inr(totalAmount)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}


