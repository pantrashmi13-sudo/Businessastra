import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { ReactNode } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

export interface FieldDef {
  key: string;
  label: string;
  type?: "text" | "number" | "textarea" | "switch" | "email" | "select" | "category-group" | "pan-search" | "opening-stock";
  colSpan?: 1 | 2;
  placeholder?: string;
  options?: string[];
}

interface MasterFormProps<S extends z.ZodTypeAny> {
  table: string;
  schema: S;
  fields: FieldDef[];
  initial?: Record<string, unknown> | null;
  onSaved?: (row: Record<string, unknown>) => void;
  onCancel?: () => void;
  submitLabel?: string;
  extraFooter?: ReactNode;
}

export function MasterForm<S extends z.ZodTypeAny>({
  table,
  schema,
  fields,
  initial,
  onSaved,
  onCancel,
  submitLabel = "Save",
}: MasterFormProps<S>) {
  const qc = useQueryClient();
  const defaults = Object.fromEntries(
    fields.map((f) => [
      f.key,
      initial?.[f.key] ??
        (f.type === "switch" ? false : f.type === "number" ? 0 : ""),
    ]),
  );
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaults as never,
  });

  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [openingStockOpen, setOpeningStockOpen] = useState(false);

  // Opening stock temp states
  const [tempQty, setTempQty] = useState(0);
  const [tempRate, setTempRate] = useState(0);
  const [tempVal, setTempVal] = useState(0);

  const mutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const payload = { ...values };
      
      // If creating new item, set current qty to opening_qty
      if (!initial?.id && table === "items") {
        payload.qty = Number(payload.opening_qty || 0);
      }

      if (initial?.id) {
        const { data, error } = await supabase
          .from(table as never)
          .update(payload as never)
          .eq("id", initial.id as string)
          .select()
          .single();
        if (error) throw error;
        return data as Record<string, unknown>;
      }
      const { data, error } = await supabase
          .from(table as never)
          .insert(payload as never)
          .select()
          .single();
      if (error) throw error;
      return data as Record<string, unknown>;
    },
    onSuccess: async (row) => {
      if (table === "items") {
        try {
          // Sync opening stock movement in database
          const qty = Number(row.opening_qty || 0);
          const rate = Number(row.opening_rate || 0);
          const val = Number(row.opening_value || 0);
          const itemId = String(row.id);
          const itemCode = String(row.item_code);
          const itemName = String(row.item_name);
          const uom = String(row.uom || "NOS");

          // 1. Get default company
          const { data: companies } = await supabase.from("companies").select("id").eq("is_default", true).limit(1);
          const companyId = companies?.[0]?.id || (await supabase.from("companies").select("id").limit(1))?.data?.[0]?.id;

          if (companyId) {
            // 2. Find or create OPENING-STOCK bill
            let { data: bill } = await supabase
              .from("bills")
              .select("id")
              .eq("bill_number", "OPENING-STOCK")
              .maybeSingle();

            if (!bill) {
              const { data: newBill, error: billErr } = await supabase
                .from("bills")
                .insert({
                  bill_type: "items",
                  bill_number: "OPENING-STOCK",
                  invoice_date: new Date().toISOString().slice(0, 10),
                  status: "approved",
                  company_id: companyId,
                  final_amount: val,
                  taxable_amount: val,
                } as never)
                .select("id")
                .single();
              if (!billErr && newBill) {
                bill = newBill;
              }
            }

            if (bill) {
              // 3. Upsert line in bill_lines
              const { data: existingLine } = await supabase
                .from("bill_lines")
                .select("id")
                .eq("bill_id", bill.id)
                .eq("ref_id", itemId)
                .maybeSingle();

              if (qty === 0) {
                if (existingLine) {
                  await supabase.from("bill_lines").delete().eq("id", existingLine.id);
                }
              } else {
                const linePayload = {
                  bill_id: bill.id,
                  ref_type: "item",
                  ref_id: itemId,
                  code: itemCode,
                  name: itemName,
                  uom: uom,
                  quantity: qty,
                  per_unit: rate,
                  line_amount: val,
                };

                if (existingLine) {
                  await supabase.from("bill_lines").update(linePayload as never).eq("id", existingLine.id);
                } else {
                  await supabase.from("bill_lines").insert(linePayload as never);
                }
              }

              // 4. Update bill totals
              const { data: lines } = await supabase
                .from("bill_lines")
                .select("line_amount")
                .eq("bill_id", bill.id);
              const totalVal = (lines || []).reduce((sum, l) => sum + Number(l.line_amount || 0), 0);
              await supabase.from("bills").update({ final_amount: totalVal, taxable_amount: totalVal } as never).eq("id", bill.id);
            }
          }
        } catch (err) {
          console.error("Failed to sync opening stock movement:", err);
        }
      }

      qc.invalidateQueries({ queryKey: [table] });
      qc.invalidateQueries({ queryKey: ["unified_movements"] });
      toast.success(initial?.id ? "Updated" : "Created");
      onSaved?.(row);
    },
    onError: (e: unknown) => {
      toast.error((e as Error).message ?? "Failed to save");
    },
  });

  return (
    <form
      onSubmit={form.handleSubmit((v) => mutation.mutate(v as Record<string, unknown>))}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((f) => {
          const err = (form.formState.errors as Record<string, { message?: string }>)[f.key];
          return (
            <div
              key={f.key}
              className={f.colSpan === 2 ? "sm:col-span-2" : undefined}
            >
              <Label className="mb-1 block text-xs font-medium text-muted-foreground">
                {f.label}
              </Label>
              {f.type === "textarea" ? (
                <Textarea
                  rows={2}
                  placeholder={f.placeholder}
                  {...form.register(f.key)}
                />
              ) : f.type === "switch" ? (
                <div className="flex h-9 items-center">
                  <Switch
                    checked={!!form.watch(f.key)}
                    onCheckedChange={(v) => form.setValue(f.key, v as never)}
                  />
                </div>
              ) : f.type === "select" ? (
                (() => {
                  const val = (form.watch(f.key) as string) ?? "";
                  const predefinedNoOther = f.options?.filter((o) => o !== "Other") ?? [];
                  const isPredefined = predefinedNoOther.includes(val);
                  const isOtherSelected =
                    Boolean(f.options?.includes("Other")) &&
                    (val === "Other" || (!isPredefined && val.trim() !== ""));

                  return (
                    <div className="space-y-1.5">
                      <Select
                        value={isPredefined ? val : isOtherSelected ? "Other" : val}
                        onValueChange={(v) => {
                          if (v === "Other") {
                            form.setValue(f.key, "Other" as never);
                          } else {
                            form.setValue(f.key, v as never);
                          }
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={f.placeholder ?? `Select ${f.label}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {(f.options ?? []).map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {isOtherSelected ? (
                        <Input
                          placeholder={`Fill custom ${f.label.toLowerCase()}…`}
                          className="mt-1.5 text-xs font-mono"
                          value={val === "Other" ? "" : val}
                          onChange={(e) => form.setValue(f.key, e.target.value as never)}
                        />
                      ) : null}
                      </div>
                    );
                  })()
              ) : f.type === "category-group" ? (
                (() => {
                  const catVal = (form.watch("category") as string) ?? "";
                  return (
                    <div className="space-y-1.5">
                      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
                        <DialogTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-between text-left font-normal"
                          >
                            <span className={catVal ? "" : "text-muted-foreground"}>
                              {catVal || "Select Category"}
                            </span>
                            <span className="text-xs text-muted-foreground">Choose →</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Category Hierarchy</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Category</Label>
                              <Input
                                placeholder="e.g., Electronics, Furniture"
                                value={catVal}
                                onChange={(e) => form.setValue("category", e.target.value as never)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Parent Category</Label>
                              <Input
                                placeholder="e.g., Phones, Chairs"
                                value={(form.watch("parent_category") as string) ?? ""}
                                onChange={(e) => form.setValue("parent_category", e.target.value as never)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Sub-Parent Category</Label>
                              <Input
                                placeholder="e.g., Smartphones, Office Chairs"
                                value={(form.watch("sub_parent_category") as string) ?? ""}
                                onChange={(e) => form.setValue("sub_parent_category", e.target.value as never)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Sub-Category</Label>
                              <Input
                                placeholder="e.g., Android Phones, Ergonomic"
                                value={(form.watch("sub_category") as string) ?? ""}
                                onChange={(e) => form.setValue("sub_category", e.target.value as never)}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button type="button" onClick={() => setCatDialogOpen(false)}>
                              Done
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  );
                })()
              ) : f.type === "opening-stock" ? (
                <div className="space-y-1.5">
                  <Dialog open={openingStockOpen} onOpenChange={(open) => {
                    setOpeningStockOpen(open);
                    if (open) {
                      setTempQty(Number(form.getValues("opening_qty") || 0));
                      setTempRate(Number(form.getValues("opening_rate") || 0));
                      setTempVal(Number(form.getValues("opening_value") || 0));
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between text-left font-normal"
                      >
                        <span>
                          {Number(form.watch("opening_qty") || 0) > 0 ? (
                            `Qty: ${form.watch("opening_qty")} | Rate: ${form.watch("opening_rate")} | Val: ${form.watch("opening_value")}`
                          ) : (
                            "Setup Opening Stock"
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">Setup →</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Setup Opening Stock</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Quantity</Label>
                          <Input
                            type="number"
                            step="any"
                            placeholder="0.00"
                            value={tempQty || ""}
                            onChange={(e) => {
                              const q = Number(e.target.value || 0);
                              setTempQty(q);
                              setTempVal(Number((q * tempRate).toFixed(2)));
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Per Unit Rate (Main UOM)</Label>
                          <Input
                            type="number"
                            step="any"
                            placeholder="0.00"
                            value={tempRate || ""}
                            onChange={(e) => {
                              const r = Number(e.target.value || 0);
                              setTempRate(r);
                              setTempVal(Number((tempQty * r).toFixed(2)));
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Total Stock Value</Label>
                          <Input
                            type="number"
                            step="any"
                            placeholder="0.00"
                            value={tempVal || ""}
                            onChange={(e) => {
                              const v = Number(e.target.value || 0);
                              setTempVal(v);
                              if (tempQty > 0) {
                                setTempRate(Number((v / tempQty).toFixed(2)));
                              }
                            }}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          type="button"
                          onClick={() => {
                            form.setValue("opening_qty", tempQty as never);
                            form.setValue("opening_rate", tempRate as never);
                            form.setValue("opening_value", tempVal as never);
                            setOpeningStockOpen(false);
                          }}
                        >
                          Apply Stock
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  
                  {/* Hidden inputs to make sure react-hook-form validates/sends them */}
                  <input type="hidden" {...form.register("opening_qty")} />
                  <input type="hidden" {...form.register("opening_rate")} />
                  <input type="hidden" {...form.register("opening_value")} />
                </div>
              ) : f.type === "pan-search" ? (
                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    placeholder={f.placeholder}
                    {...form.register(f.key)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    onClick={() => {
                      const pan = String(form.getValues(f.key) ?? "").replace(/\D/g, "").trim();
                      if (!pan) {
                        toast.error("Enter a PAN/VAT number first");
                        return;
                      }
                      window.open(
                        `https://ird.gov.np/pan-search/?pan=${encodeURIComponent(pan)}`,
                        "_blank",
                        "noopener,noreferrer",
                      );
                    }}
                  >
                    <Search className="h-3.5 w-3.5" />
                    Search PAN
                  </Button>
                </div>
              ) : (
                <Input
                  type={f.type === "number" ? "number" : f.type === "email" ? "email" : "text"}
                  step={f.type === "number" ? "any" : undefined}
                  placeholder={f.placeholder}
                  {...form.register(f.key, {
                    valueAsNumber: f.type === "number",
                  })}
                />
              )}
              {err?.message ? (
                <p className="mt-1 text-xs text-destructive">{err.message}</p>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
