import React, { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Package2, Wrench, ArrowLeft } from "lucide-react";
import { itemSchema } from "./schemas";
import { cn } from "@/lib/utils";

// Extended form schema — TDS/Ledger are UI-only until DB migration adds those columns
const formSchema = itemSchema.extend({
  sales_ledger: z.string().optional(),
  purchase_ledger: z.string().optional(),
  tds_applicable: z.boolean().optional().default(false),
  tds_rate: z.coerce.number().min(0).max(100).optional(),
});

type FormValues = z.infer<typeof formSchema>;
type ItemType = "item" | "service";

export interface ItemFormDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Existing item record for editing */
  initial?: Record<string, unknown> | null;
  /** Pre-fill fields from OCR extracted line data */
  ocrPrefill?: {
    item_code?: string;
    item_name?: string;
    uom?: string;
    hsn_code?: string;
    vat_rate?: number;
    per_unit?: number;
    warehouse?: string;
  } | null;
  onSaved?: (row: Record<string, unknown>) => void;
}

export function ItemFormDialog({
  open,
  onOpenChange,
  initial,
  ocrPrefill,
  onSaved,
}: ItemFormDialogProps) {
  const qc = useQueryClient();

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouses").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const getInitialType = (): ItemType | null => {
    if (!initial) return null;
    return initial.is_service ? "service" : "item";
  };

  const [selectedType, setSelectedType] = useState<ItemType | null>(getInitialType);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [openingStockOpen, setOpeningStockOpen] = useState(false);
  const [tempQty, setTempQty] = useState(0);
  const [tempRate, setTempRate] = useState(0);
  const [tempVal, setTempVal] = useState(0);
  const [warehouseOtherSelected, setWarehouseOtherSelected] = useState(false);
  const [customWarehouse, setCustomWarehouse] = useState("");
  const [tempCategory, setTempCategory] = useState("");
  const [tempParentCategory, setTempParentCategory] = useState("");
  const [tempSubParentCategory, setTempSubParentCategory] = useState("");
  const [tempSubCategory, setTempSubCategory] = useState("");

  const handleCatDialogOpenChange = React.useCallback((open: boolean) => {
    setCatDialogOpen(open);
    if (open) {
      setTempCategory((form.getValues("category") as string) ?? "");
      setTempParentCategory((form.getValues("parent_category") as string) ?? "");
      setTempSubParentCategory((form.getValues("sub_parent_category") as string) ?? "");
      setTempSubCategory((form.getValues("sub_category") as string) ?? "");
    }
  }, []);

  const buildDefaults = (): Partial<FormValues> => ({
    item_code: ((initial?.item_code ?? ocrPrefill?.item_code ?? "") as string),
    item_name: ((initial?.item_name ?? ocrPrefill?.item_name ?? "") as string),
    uom: ((initial?.uom ?? ocrPrefill?.uom ?? "NOS") as string),
    hsn_code: ((initial?.hsn_code ?? ocrPrefill?.hsn_code ?? "") as string),
    vat_rate: Number(initial?.vat_rate ?? ocrPrefill?.vat_rate ?? 13),
    selling_price: Number(initial?.selling_price ?? 0),
    default_rate: Number(initial?.default_rate ?? ocrPrefill?.per_unit ?? 0),
    reorder_level: Number(initial?.reorder_level ?? 0),
    qty: Number(initial?.qty ?? 0),
    opening_qty: Number(initial?.opening_qty ?? 0),
    opening_rate: Number(initial?.opening_rate ?? 0),
    opening_value: Number(initial?.opening_value ?? 0),
    warehouse: ((initial?.warehouse ?? ocrPrefill?.warehouse ?? "") as string),
    warehouse_id: ((initial?.warehouse_id ?? "") as string),
    rag_number: ((initial?.rag_number ?? "") as string),
    status: ((initial?.status ?? "Active") as string),
    category: ((initial?.category ?? "") as string),
    parent_category: ((initial?.parent_category ?? "") as string),
    sub_parent_category: ((initial?.sub_parent_category ?? "") as string),
    sub_category: ((initial?.sub_category ?? "") as string),
    alt_uom: ((initial?.alt_uom ?? "") as string),
    alt_uom_conversion: Number(initial?.alt_uom_conversion ?? 0),
    description: ((initial?.description ?? "") as string),
    is_inventory: initial?.is_inventory !== false,
    is_service: Boolean(initial?.is_service),
    sales_ledger: ((initial?.sales_ledger ?? "") as string),
    purchase_ledger: ((initial?.purchase_ledger ?? "") as string),
    tds_applicable: Boolean(initial?.tds_applicable),
    tds_rate: Number(initial?.tds_rate ?? 0),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: buildDefaults(),
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: Record<string, unknown> = { ...values };

      // Remove client-only virtual fields
      delete payload.opening_stock;

      // Set type flags from selected type
      payload.is_service = selectedType === "service";
      payload.is_inventory =
        selectedType === "item" ? Boolean(values.is_inventory) : false;

      // Set current qty to opening_qty for new records
      if (!initial?.id) {
        payload.qty = Number(payload.opening_qty || 0);
      }

      if (initial?.id) {
        const { data, error } = await supabase
          .from("items" as never)
          .update(payload as never)
          .eq("id", initial.id as string)
          .select()
          .single();
        if (error) throw error;
        return data as Record<string, unknown>;
      }

      const { data, error } = await supabase
        .from("items" as never)
        .insert(payload as never)
        .select()
        .single();
      if (error) throw error;
      return data as Record<string, unknown>;
    },
    onSuccess: async (row) => {
      // Sync opening stock movement
      try {
        const qty = Number(row.opening_qty || 0);
        const rate = Number(row.opening_rate || 0);
        const val = Number(row.opening_value || 0);
        const itemId = String(row.id);
        const itemCode = String(row.item_code);
        const itemName = String(row.item_name);
        const uom = String(row.uom || "NOS");

        const { data: companies } = await supabase
          .from("companies")
          .select("id")
          .eq("is_default", true)
          .limit(1);
        const companyId =
          companies?.[0]?.id ||
          (await supabase.from("companies").select("id").limit(1))?.data?.[0]?.id;

        if (companyId) {
          let { data: bill } = await supabase
            .from("bills")
            .select("id")
            .eq("bill_number", "OPENING-STOCK")
            .maybeSingle();

          if (!bill) {
            const { data: newBill } = await supabase
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
            if (newBill) bill = newBill;
          }

          if (bill) {
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
                uom,
                quantity: qty,
                per_unit: rate,
                line_amount: val,
              };
              if (existingLine) {
                await supabase
                  .from("bill_lines")
                  .update(linePayload as never)
                  .eq("id", existingLine.id);
              } else {
                await supabase.from("bill_lines").insert(linePayload as never);
              }
            }

            const { data: lines } = await supabase
              .from("bill_lines")
              .select("line_amount")
              .eq("bill_id", bill.id);
            const totalVal = (lines || []).reduce(
              (sum, l) => sum + Number(l.line_amount || 0),
              0
            );
            await supabase
              .from("bills")
              .update({ final_amount: totalVal, taxable_amount: totalVal } as never)
              .eq("id", bill.id);
          }
        }
      } catch (err) {
        console.error("Failed to sync opening stock:", err);
      }

      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["unified_movements"] });
      toast.success(initial?.id ? "Item updated" : "Item created");
      onSaved?.(row);
      handleClose();
    },
    onError: (e: unknown) => {
      toast.error((e as Error).message ?? "Failed to save");
    },
  });

  const handleClose = () => {
    form.reset(buildDefaults());
    setSelectedType(getInitialType());
    setWarehouseOtherSelected(false);
    setCustomWarehouse("");
    onOpenChange(false);
  };

  const isInventory = form.watch("is_inventory");
  const tdsApplicable = form.watch("tds_applicable");
  const catVal = (form.watch("category") as string) ?? "";
  const openingQty = form.watch("opening_qty");

  // ─── Helper Components ─────────────────────────────────────────────────
  const Field = ({
    label,
    name,
    placeholder,
    type = "text",
  }: {
    label: string;
    name: keyof FormValues;
    placeholder?: string;
    type?: string;
  }) => {
    const err = form.formState.errors[name];
    return (
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
        <Input
          type={type}
          step={type === "number" ? "any" : undefined}
          placeholder={placeholder}
          {...form.register(name, { valueAsNumber: type === "number" })}
        />
        {err?.message && (
          <p className="text-xs text-destructive">{err.message as string}</p>
        )}
      </div>
    );
  };

  const SelectField = ({
    label,
    name,
    options,
    placeholder,
  }: {
    label: string;
    name: keyof FormValues;
    options: string[];
    placeholder?: string;
  }) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Select
        value={(form.watch(name) as string) ?? ""}
        onValueChange={(v) => form.setValue(name, v as never)}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder ?? `Select ${label}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const SwitchRow = ({
    label,
    name,
    description,
  }: {
    label: string;
    name: keyof FormValues;
    description?: string;
  }) => (
    <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <Switch
        checked={!!form.watch(name)}
        onCheckedChange={(v) => form.setValue(name, v as never)}
      />
    </div>
  );

  // ─── Type Selector ─────────────────────────────────────────────────────
  const TypeSelector = () => (
    <div className="space-y-6 py-4">
      <p className="text-sm text-center text-muted-foreground">
        What would you like to add?
      </p>
      <div className="grid grid-cols-2 gap-4">
        {[
          {
            type: "item" as ItemType,
            label: "Item",
            sublabel: "Physical goods, materials or consumables",
            Icon: Package2,
            iconBg: "bg-emerald-100 dark:bg-emerald-950",
            iconColor: "text-emerald-600 dark:text-emerald-400",
            onSelect: () => {
              setSelectedType("item");
              form.setValue("is_service", false);
            },
          },
          {
            type: "service" as ItemType,
            label: "Service",
            sublabel: "Professional services, labour, charges",
            Icon: Wrench,
            iconBg: "bg-violet-100 dark:bg-violet-950",
            iconColor: "text-violet-600 dark:text-violet-400",
            onSelect: () => {
              setSelectedType("service");
              form.setValue("is_service", true);
              form.setValue("is_inventory", false);
            },
          },
        ].map(({ type, label, sublabel, Icon, iconBg, iconColor, onSelect }) => (
          <button
            key={type}
            type="button"
            onClick={onSelect}
            className="group flex flex-col items-center gap-3 rounded-xl border-2 border-border bg-card p-6 text-center transition-all hover:border-primary hover:bg-primary/5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <div
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full transition-transform group-hover:scale-110",
                iconBg
              )}
            >
              <Icon className={cn("h-7 w-7", iconColor)} />
            </div>
            <div>
              <p className="font-semibold text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  // ─── Item Tabs ─────────────────────────────────────────────────────────
  const ItemTabs = () => (
    <Tabs defaultValue="basic" className="w-full">
      <TabsList className="grid w-full grid-cols-4 text-xs h-9">
        <TabsTrigger value="basic">Basic Info</TabsTrigger>
        <TabsTrigger value="config">Configuration</TabsTrigger>
        <TabsTrigger value="description">Description</TabsTrigger>
        <TabsTrigger value="ledger">Ledger & TDS</TabsTrigger>
      </TabsList>

      {/* ── Basic Info ── */}
      <TabsContent value="basic" className="space-y-3 pt-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Item Code" name="item_code" placeholder="ITEM-001" />
          <Field label="Item Name" name="item_name" placeholder="Enter item name" />
          <Field label="Unit (UOM)" name="uom" placeholder="Kg, Piece, Box…" />
          <Field label="HSN Code" name="hsn_code" placeholder="e.g. 8517" />
          <Field label="VAT %" name="vat_rate" type="number" />
          <Field label="Selling Price" name="selling_price" type="number" />
        </div>

        {/* Category picker */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Category</Label>
          <Dialog
            open={catDialogOpen}
            onOpenChange={handleCatDialogOpenChange}
          >
            <button
              type="button"
              onClick={() => setCatDialogOpen(true)}
              className="w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              <span className={catVal ? "" : "text-muted-foreground"}>
                {catVal || "Select Category"}
              </span>
              <span className="text-xs text-muted-foreground">Choose →</span>
            </button>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Category Hierarchy</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1">
                  <Label className="text-xs">Category</Label>
                  <Input
                    placeholder="e.g., Electronics"
                    value={tempCategory}
                    onChange={(e) => setTempCategory(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Parent Category</Label>
                  <Input
                    placeholder="e.g., Phones"
                    value={tempParentCategory}
                    onChange={(e) => setTempParentCategory(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Sub-Parent Category</Label>
                  <Input
                    placeholder="e.g., Smartphones"
                    value={tempSubParentCategory}
                    onChange={(e) => setTempSubParentCategory(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Sub-Category</Label>
                  <Input
                    placeholder="e.g., Android"
                    value={tempSubCategory}
                    onChange={(e) => setTempSubCategory(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  onClick={() => {
                    form.setValue("category", tempCategory as never);
                    form.setValue("parent_category", tempParentCategory as never);
                    form.setValue("sub_parent_category", tempSubParentCategory as never);
                    form.setValue("sub_category", tempSubCategory as never);
                    setCatDialogOpen(false);
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Alt UOM" name="alt_uom" placeholder="BOX, CASE, DOZEN…" />
          <Field label="1 Main = X Alt" name="alt_uom_conversion" type="number" placeholder="e.g., 12" />
        </div>

        {/* Opening Stock */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Opening Stock</Label>
          <Dialog
            open={openingStockOpen}
            onOpenChange={(open) => {
              setOpeningStockOpen(open);
              if (open) {
                setTempQty(Number(form.getValues("opening_qty") || 0));
                setTempRate(Number(form.getValues("opening_rate") || 0));
                setTempVal(Number(form.getValues("opening_value") || 0));
              }
            }}
          >
            <button
              type="button"
              onClick={() => setOpeningStockOpen(true)}
              className="w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              <span>
                {Number(openingQty || 0) > 0
                  ? `Qty: ${openingQty} | Rate: ${form.watch("opening_rate")} | Val: ${form.watch("opening_value")}`
                  : "Setup Opening Stock"}
              </span>
              <span className="text-xs text-muted-foreground">Setup →</span>
            </button>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Setup Opening Stock</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
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
                      setTempVal(+(q * tempRate).toFixed(2));
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Per Unit Rate</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={tempRate || ""}
                    onChange={(e) => {
                      const r = Number(e.target.value || 0);
                      setTempRate(r);
                      setTempVal(+(tempQty * r).toFixed(2));
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
                      if (tempQty > 0) setTempRate(+(v / tempQty).toFixed(2));
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
          <input type="hidden" {...form.register("opening_qty")} />
          <input type="hidden" {...form.register("opening_rate")} />
          <input type="hidden" {...form.register("opening_value")} />
        </div>
      </TabsContent>

      {/* ── Configuration ── */}
      <TabsContent value="config" className="space-y-3 pt-3">
        <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
          <div>
            <h4 className="text-sm font-semibold">Transaction Flow</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Controls how this item appears in purchase and sales transactions
            </p>
          </div>

          <SwitchRow
            name="is_inventory"
            label="Inventory Item"
            description={
              isInventory
                ? "✓ Stock is tracked — goes to Delivery Challans on sale"
                : "✓ Non-tracked — goes to Consumption / Expense entries"
            }
          />

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div
              className={cn(
                "rounded-md p-3 border transition-all",
                isInventory
                  ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800"
                  : "bg-muted/30 border-transparent opacity-50"
              )}
            >
              <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                Inventory ON
              </p>
              <p className="text-muted-foreground mt-1">
                Stock tracked · Delivery Challan on dispatch
              </p>
            </div>
            <div
              className={cn(
                "rounded-md p-3 border transition-all",
                !isInventory
                  ? "bg-orange-50 border-orange-200 dark:bg-orange-950/40 dark:border-orange-800"
                  : "bg-muted/30 border-transparent opacity-50"
              )}
            >
              <p className="font-semibold text-orange-700 dark:text-orange-400">
                Inventory OFF
              </p>
              <p className="text-muted-foreground mt-1">
                No stock tracking · Goes to Consumption
              </p>
            </div>
          </div>
        </div>

          <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Warehouse</Label>
            <Select
              value={(form.watch("warehouse_id") as string) || (form.watch("warehouse") as string) || ""}
              onValueChange={(v) => {
                const wh = warehouses?.find((w: any) => w.id === v);
                form.setValue("warehouse_id", v as never);
                form.setValue("warehouse", (wh ? wh.name : "") as never);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select warehouse" />
              </SelectTrigger>
              <SelectContent>
                {warehouses?.map((wh: any) => (
                  <SelectItem key={wh.id} value={wh.id}>
                    {wh.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {(form.watch("warehouse_id") || form.watch("warehouse")) && (
            <Field label="RAG Number (Rack, Aisle, Grid)" name="rag_number" placeholder="e.g. Rack A, Row 2" />
          )}

          <SelectField
            label="Status"
            name="status"
            options={["Active", "Inactive"]}
          />
          <Field label="Reorder Level" name="reorder_level" type="number" />
          <Field label="Default Purchase Rate" name="default_rate" type="number" />
        </div>
      </TabsContent>

      {/* ── Description ── */}
      <TabsContent value="description" className="pt-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Description</Label>
          <Textarea
            rows={7}
            placeholder="Item description, specifications, notes…"
            {...form.register("description")}
          />
        </div>
      </TabsContent>

      {/* ── Ledger & TDS ── */}
      <TabsContent value="ledger" className="space-y-3 pt-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Sales Ledger</Label>
            <Input placeholder="e.g., Sales A/c" {...form.register("sales_ledger")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Purchase Ledger</Label>
            <Input placeholder="e.g., Purchase A/c" {...form.register("purchase_ledger")} />
          </div>
        </div>
        <SwitchRow
          name="tds_applicable"
          label="TDS Applicable"
          description="Enable if Tax Deducted at Source applies to this item"
        />
        {tdsApplicable && (
          <Field label="TDS Rate (%)" name="tds_rate" type="number" placeholder="e.g., 2" />
        )}
      </TabsContent>
    </Tabs>
  );

  // ─── Service Tabs ──────────────────────────────────────────────────────
  const ServiceTabs = () => (
    <Tabs defaultValue="basic" className="w-full">
      <TabsList className="grid w-full grid-cols-3 text-xs h-9">
        <TabsTrigger value="basic">Basic Info</TabsTrigger>
        <TabsTrigger value="description">Description</TabsTrigger>
        <TabsTrigger value="ledger">Ledger & TDS</TabsTrigger>
      </TabsList>

      <TabsContent value="basic" className="space-y-3 pt-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Service Code" name="item_code" placeholder="SRV-001" />
          <Field label="Service Name" name="item_name" placeholder="Enter service name" />
          <Field label="SAC Code" name="hsn_code" placeholder="e.g. 998314" />
          <Field label="VAT %" name="vat_rate" type="number" />
          <Field label="Selling Price" name="selling_price" type="number" />
          <SelectField label="Status" name="status" options={["Active", "Inactive"]} />
        </div>
      </TabsContent>

      <TabsContent value="description" className="pt-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Description</Label>
          <Textarea
            rows={7}
            placeholder="Service description, scope of work, terms…"
            {...form.register("description")}
          />
        </div>
      </TabsContent>

      <TabsContent value="ledger" className="space-y-3 pt-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Sales Ledger</Label>
          <Input
            placeholder="e.g., Service Revenue A/c"
            {...form.register("sales_ledger")}
          />
        </div>
        <SwitchRow
          name="tds_applicable"
          label="TDS Applicable"
          description="Enable if TDS applies to this service"
        />
        {tdsApplicable && (
          <Field label="TDS Rate (%)" name="tds_rate" type="number" placeholder="e.g., 2" />
        )}
      </TabsContent>
    </Tabs>
  );

  // ─── Dialog title ──────────────────────────────────────────────────────
  const dialogTitle = initial?.id
    ? initial.is_service
      ? "Edit Service"
      : "Edit Item"
    : selectedType === "service"
    ? "New Service"
    : selectedType === "item"
    ? "New Item"
    : "Add to Masters";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background text-foreground">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {selectedType && !initial?.id && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 -ml-1"
                onClick={() => setSelectedType(null)}
                title="Back to type selection"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle className="flex items-center gap-2 text-base">
              {selectedType === "service" ? (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-950">
                  <Wrench className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                </span>
              ) : selectedType === "item" ? (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
                  <Package2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </span>
              ) : null}
              {dialogTitle}
            </DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
          {!selectedType ? (
            <TypeSelector />
          ) : selectedType === "item" ? (
            <ItemTabs />
          ) : (
            <ServiceTabs />
          )}

          {selectedType && (
            <div className="flex justify-end gap-2 pt-4 border-t mt-4">
              <Button type="button" variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving…" : initial?.id ? "Update" : "Save"}
              </Button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
