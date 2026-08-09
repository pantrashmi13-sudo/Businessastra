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
  Truck,
  Package,
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

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { EntityCombobox, type EntityOption } from "@/components/bills/EntityCombobox";
import { customerSchema, customerFields } from "@/components/masters/schemas";
import { inr, num, toNumber } from "@/lib/format";
import { formatDate, adToBsInput, bsInputToAd } from "@/lib/date-conversion";
import { useDateFormat } from "@/hooks/use-date-format";
import { BsDatePicker } from "@/components/ui/bs-date-picker";

interface ChallanLine {
  id?: string;
  sno: number;
  ref_id: string | null;
  code: string;
  name: string;
  uom: string;
  main_uom?: string;
  alt_uom?: string;
  alt_uom_conversion?: number;
  total_stock?: number;    // total items.qty from master (base UOM)
  available_qty?: number;  // selected lot's available qty (base UOM)
  quantity: number;
  per_unit: number;
  lot_number: string;
  expiry_date: string;
  created_at?: string;
}

interface ChallanFormProps {
  challanId?: string;
  initial?: {
    challan: Record<string, unknown> | null;
    lines: Array<Record<string, unknown>>;
  } | null;
}

const emptyLine = (sno: number): ChallanLine => ({
  sno,
  ref_id: null,
  code: "",
  name: "",
  uom: "NOS",
  quantity: 1,
  per_unit: 0,
  lot_number: "",
  expiry_date: "",
});

export function ChallanForm({ challanId, initial }: ChallanFormProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const dateFormat = useDateFormat();

  const existing = initial?.challan;
  const isNew = !challanId;

  // Form states
  const [customerId, setCustomerId] = useState<string | null>(
    (existing?.customer_id as string) ?? null,
  );
  const [customerRow, setCustomerRow] = useState<Record<string, unknown> | null>(null);

  const [challanNumber, setChallanNumber] = useState<string>(
    (existing?.challan_number as string) ?? "",
  );
  const [challanDate, setChallanDate] = useState<string>(
    (existing?.challan_date as string) ?? new Date().toISOString().slice(0, 10),
  );
  const [poReference, setPoReference] = useState<string>(
    (existing?.po_reference as string) ?? "",
  );
  const [deliveryAddress, setDeliveryAddress] = useState<string>(
    (existing?.delivery_address as string) ?? "",
  );
  const [vehicleNumber, setVehicleNumber] = useState<string>(
    (existing?.vehicle_number as string) ?? "",
  );
  const [driverContact, setDriverContact] = useState<string>(
    (existing?.driver_contact as string) ?? "",
  );
  const [notes, setNotes] = useState<string>((existing?.notes as string) ?? "");

  const [lines, setLines] = useState<ChallanLine[]>(() => {
    if (initial?.lines?.length) {
      return initial.lines.map((l, i) => ({
        id: l.id as string,
        sno: (l.sno as number) ?? i + 1,
        ref_id: (l.ref_id as string) ?? null,
        code: (l.code as string) ?? "",
        name: (l.name as string) ?? "",
        uom: (l.uom as string) ?? "NOS",
        quantity: Number(l.quantity ?? 1),
        per_unit: Number(l.per_unit ?? 0),
        lot_number: (l.lot_number as string) ?? "",
        expiry_date: (l.expiry_date as string) ?? "",
        created_at: (l.created_at as string) ?? "",
      }));
    }
    return [emptyLine(1)];
  });

  // Auto-generate running Challan Number for new challans
  useEffect(() => {
    if (!isNew) return;
    if (challanNumber) return;
    const d = new Date();
    const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
    setChallanNumber(`DC-${ym}-${Math.floor(Math.random() * 900 + 100)}`);
  }, [isNew, challanNumber]);

  // Load Customers Master query
  const customers = useQuery({
    queryKey: ["customers", "list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Load Items Master query (Goods only for physical dispatch)
  const items = useQuery({
    queryKey: ["items", "list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("items").select("*").order("item_code");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Load purchase bill lines query to extract lots per item
  const billLines = useQuery({
    queryKey: ["bill_lines", "lots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bill_lines")
        .select("id, ref_id, lot_number, expiry_date, quantity, per_unit, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Array<Record<string, unknown>>) ?? [];
    },
  });

  // Load outward dispatch lines to subtract from lot stock
  const challanLines = useQuery({
    queryKey: ["delivery_challan_lines", "lots"],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as { from: (t: string) => { select: (s: string) => { order: (c: string, o: { ascending: boolean }) => Promise<{ data: unknown[]; error: unknown }> } } })
        .from("delivery_challan_lines")
        .select("id, ref_id, lot_number, quantity, uom, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Array<Record<string, unknown>>) ?? [];
    },
  });

  // Helper: get available lots for a selected item (inward − outward = net per lot)
  const getAvailableLotsForItem = (itemId: string | null) => {
    if (!itemId) return [];
    const itemMaster = (items.data ?? []).find((i) => i.id === itemId) as Record<string, unknown> | undefined;
    if (!itemMaster) return [];

    const itemCode = (itemMaster.item_code as string)?.trim().toUpperCase() || "DEFAULT";
    const masterStock = Number(itemMaster.qty || 0);
    const masterLotNum = (itemMaster.lot_number as string)?.trim();
    const defaultLotLabel = masterLotNum || `LOT-${itemCode}`;
    const altUom = (itemMaster.alt_uom as string) || "";
    const altConv = Number(itemMaster.alt_uom_conversion || 0);

    const matchingBillLines = (billLines.data ?? []).filter((b) => b.ref_id === itemId);
    const matchingChallanLines = (challanLines.data ?? []).filter((c) => c.ref_id === itemId);

    const lotsMap = new Map<
      string,
      { lot_number: string; expiry_date: string; created_at: string; qty: number; per_unit: number }
    >();

    // 1. Process inward purchase bill lines
    for (const bl of matchingBillLines) {
      const rawLot = (bl.lot_number as string)?.trim() || defaultLotLabel;
      const lotKey = rawLot.toUpperCase();
      const existing = lotsMap.get(lotKey);
      if (existing) {
        existing.qty += Number(bl.quantity || 0);
      } else {
        lotsMap.set(lotKey, {
          lot_number: rawLot,
          expiry_date: (bl.expiry_date as string) || (itemMaster.expiry_date as string) || "",
          created_at: (bl.created_at as string) || (itemMaster.created_at as string) || new Date().toISOString(),
          qty: Number(bl.quantity || 0),
          per_unit: Number(bl.per_unit || itemMaster.default_rate || 0),
        });
      }
    }

    // 2. Subtract outward dispatch challan lines
    for (const cl of matchingChallanLines) {
      const rawLot = (cl.lot_number as string)?.trim() || defaultLotLabel;
      const lotKey = rawLot.toUpperCase();
      let dispatchQty = Number(cl.quantity || 0);

      // Convert Alt UOM dispatches to base UOM
      const clUom = (cl.uom as string) || "";
      if (altUom && clUom === altUom && altConv > 0) {
        dispatchQty = dispatchQty / altConv;
      }

      const existing = lotsMap.get(lotKey);
      if (existing) {
        existing.qty -= dispatchQty;
      }
    }

    // 3. If no bill lines exist, seed from master stock
    if (matchingBillLines.length === 0) {
      const fallbackKey = defaultLotLabel.toUpperCase();
      if (!lotsMap.has(fallbackKey)) {
        lotsMap.set(fallbackKey, {
          lot_number: defaultLotLabel,
          expiry_date: (itemMaster.expiry_date as string) || "",
          created_at: (itemMaster.created_at as string) || new Date().toISOString(),
          qty: masterStock,
          per_unit: Number(itemMaster.default_rate || 0),
        });
      }
    } else {
      // 4. Handle unassigned remaining stock (master qty minus sum of lot net balances)
      let lotNetTotal = 0;
      for (const lot of lotsMap.values()) {
        if (lot.qty > 0) lotNetTotal += lot.qty;
      }
      const unassignedQty = Math.max(0, masterStock - lotNetTotal);

      if (unassignedQty > 0) {
        const fallbackLotNum = masterLotNum || "General Stock";
        const fallbackKey = fallbackLotNum.toUpperCase();
        if (lotsMap.has(fallbackKey)) {
          const existing = lotsMap.get(fallbackKey)!;
          existing.qty += unassignedQty;
        } else {
          lotsMap.set(fallbackKey, {
            lot_number: fallbackLotNum,
            expiry_date: (itemMaster.expiry_date as string) || "",
            created_at: (itemMaster.created_at as string) || new Date().toISOString(),
            qty: unassignedQty,
            per_unit: Number(itemMaster.default_rate || 0),
          });
        }
      }
    }

    return Array.from(lotsMap.values()).filter((lot) => lot.qty > 0);
  };

  // Customer options for combobox
  const customerOptions: EntityOption[] = useMemo(
    () =>
      (customers.data ?? []).map((c: Record<string, unknown>) => ({
        id: c.id as string,
        label: c.name as string,
        sublabel: [(c.vat_number as string), (c.phone as string), (c.city as string)].filter(Boolean).join(" · "),
        raw: c,
      })),
    [customers.data],
  );

  // Item options for combobox — displaying real-time available stock
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

  // Update customer row & auto-fill delivery address when selected
  useEffect(() => {
    if (customerId && !customerRow) {
      const found = (customers.data ?? []).find((c) => c.id === customerId);
      if (found) {
        setCustomerRow(found as Record<string, unknown>);
        if (!deliveryAddress && (found.billing_address as string)) {
          setDeliveryAddress(found.billing_address as string);
        }
      }
    }
  }, [customerId, customerRow, customers.data, deliveryAddress]);

  // Total Challan Amount
  const totalAmount = useMemo(() => {
    return lines.reduce((acc, l) => acc + (Number(l.quantity || 0) * Number(l.per_unit || 0)), 0);
  }, [lines]);

  // Line item handlers
  const updateLine = (i: number, patch: Partial<ChallanLine>) => {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };
  const addLine = () => setLines((prev) => [...prev, emptyLine(prev.length + 1)]);
  const removeLine = (i: number) =>
    setLines((prev) => prev.filter((_, idx) => idx !== i).map((l, idx) => ({ ...l, sno: idx + 1 })));

  // Calculate Item Age = difference from system entry date (created_at) to today
  const calculateAge = (createdAtStr?: string) => {
    if (!createdAtStr) return null;
    const createdDate = new Date(createdAtStr);
    const today = new Date();
    const ageDays = Math.max(0, Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 3600 * 24)));
    return ageDays;
  };

  // Save / Dispatch Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!customerId) throw new Error("Please select a Customer.");
      if (!challanNumber.trim()) throw new Error("Delivery Challan Number is required.");

      // 1. Validate available stock BEFORE creating records
      for (const l of lines.filter((line) => line.ref_id && line.name.trim())) {
        const { data: currentItem } = await supabase
          .from("items")
          .select("id, item_name, qty")
          .eq("id", l.ref_id!)
          .maybeSingle();

        if (currentItem) {
          const currentStock = Number(currentItem.qty || 0);
          const isAlt = l.alt_uom && l.uom === l.alt_uom && Number(l.alt_uom_conversion || 0) > 0;
          const reqBaseQty = isAlt ? Number(l.quantity || 0) / Number(l.alt_uom_conversion) : Number(l.quantity || 0);

          if (reqBaseQty > currentStock) {
            const availInSelUom = isAlt ? currentStock * Number(l.alt_uom_conversion) : currentStock;
            throw new Error(
              `Cannot dispatch line #${l.sno} (${l.name}): Dispatched quantity (${l.quantity} ${l.uom}) exceeds available stock (${num(availInSelUom)} ${l.uom}).`
            );
          }
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      const payload: Record<string, unknown> = {
        customer_id: customerId,
        company_id: null,
        challan_number: challanNumber.trim(),
        challan_date: challanDate || new Date().toISOString().slice(0, 10),
        po_reference: poReference || null,
        delivery_address: deliveryAddress || null,
        vehicle_number: vehicleNumber || null,
        driver_contact: driverContact || null,
        total_amount: totalAmount,
        status: "dispatched",
        notes: notes || null,
        dispatched_at: new Date().toISOString(),
      };

      let id = challanId;
      if (id) {
        const { error } = await supabase.from("delivery_challans" as any).update(payload as never).eq("id", id);
        if (error) throw error;
        await supabase.from("delivery_challan_lines" as any).delete().eq("challan_id", id);
      } else {
        const { data, error } = await supabase
          .from("delivery_challans" as any)
          .insert(payload as never)
          .select("id")
          .single();
        if (error) throw error;
        id = (data as any)?.id;
      }

      // Save line items
      const linePayloads = lines
        .filter((l) => l.name.trim())
        .map((l) => ({
          challan_id: id!,
          sno: l.sno,
          ref_id: l.ref_id,
          code: l.code || null,
          name: l.name,
          uom: l.uom || "NOS",
          quantity: toNumber(l.quantity, 1),
          per_unit: toNumber(l.per_unit, 0),
          lot_number: l.lot_number || null,
          expiry_date: l.expiry_date || null,
          line_amount: Number(l.quantity || 0) * Number(l.per_unit || 0),
        }));

      if (linePayloads.length) {
        const { error } = await supabase.from("delivery_challan_lines" as any).insert(linePayloads as never);
        if (error) throw error;
      }

      // Decrement Inventory Stock (qty) in items master with Alt UOM conversion support
      for (const line of lines.filter((l) => l.ref_id && l.name.trim())) {
        const { data: currentItem } = await supabase
          .from("items")
          .select("id, qty")
          .eq("id", line.ref_id!)
          .maybeSingle();

        if (currentItem) {
          const isAlt = line.alt_uom && line.uom === line.alt_uom && Number(line.alt_uom_conversion || 0) > 0;
          const baseDeduction = isAlt
            ? Number(line.quantity || 0) / Number(line.alt_uom_conversion)
            : Number(line.quantity || 0);

          const newQty = Math.max(0, Number(currentItem.qty || 0) - baseDeduction);
          await supabase
            .from("items")
            .update({ qty: newQty } as never)
            .eq("id", currentItem.id);
        }
      }

      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["delivery_challans"] });
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success(`Delivery Challan #${challanNumber} Dispatched & Stock Updated`);
      navigate({ to: "/challans" });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const customerSublabel = customerRow
    ? [(customerRow.vat_number as string), (customerRow.phone as string), (customerRow.city as string)]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <>
      <PageHeader
        title={isNew ? "New Delivery Challan" : `Challan ${challanNumber}`}
        description="Outward Goods Dispatch Notes validated against Customer Master with Real-Time Stock Tracking."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-primary text-primary-foreground">
              <Truck className="mr-1 h-3.5 w-3.5" /> Outward Dispatch
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
              Dispatch &amp; Deduct Stock
            </Button>
          </div>
        }
      />

      <div className="space-y-4 p-6">
        {/* Customer & Dispatch Details Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" /> Customer &amp; Outward Logistics Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label className="mb-1 block text-xs font-medium text-muted-foreground">
                Customer (Validated from Master)
              </Label>
              <EntityCombobox
                value={customerId}
                onChange={(id, row) => {
                  setCustomerId(id);
                  setCustomerRow(row);
                  if (row && (row.billing_address as string)) {
                    setDeliveryAddress(row.billing_address as string);
                  }
                }}
                options={customerOptions}
                placeholder="Select customer from Master..."
                addLabel="Add new customer"
                table="customers"
                schema={customerSchema}
                fields={customerFields}
                nameKey="name"
              />
              {customerSublabel ? (
                <p className="mt-1 text-xs text-muted-foreground">{customerSublabel}</p>
              ) : null}
            </div>

            <div>
              <Label className="mb-1 block text-xs font-medium text-muted-foreground">
                Challan Number
              </Label>
              <Input
                value={challanNumber}
                onChange={(e) => setChallanNumber(e.target.value)}
                placeholder="DC-202607-001"
              />
            </div>

            <div>
              <Label className="mb-1 block text-xs font-medium text-muted-foreground">
                Dispatch Date
              </Label>
              {dateFormat === "bs" ? (
                <BsDatePicker
                  value={challanDate}
                  onChange={(adDate) => setChallanDate(adDate)}
                  className="w-full"
                />
              ) : (
                <Input
                  type="date"
                  value={challanDate}
                  onChange={(e) => setChallanDate(e.target.value)}
                />
              )}
            </div>

            <div>
              <Label className="mb-1 block text-xs font-medium text-muted-foreground">
                Order / PO Reference
              </Label>
              <Input
                value={poReference}
                onChange={(e) => setPoReference(e.target.value)}
                placeholder="PO-88492"
              />
            </div>

            <div>
              <Label className="mb-1 block text-xs font-medium text-muted-foreground">
                Vehicle Number
              </Label>
              <Input
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                placeholder="Ba 2 Kha 4910"
              />
            </div>

            <div>
              <Label className="mb-1 block text-xs font-medium text-muted-foreground">
                Driver Contact
              </Label>
              <Input
                value={driverContact}
                onChange={(e) => setDriverContact(e.target.value)}
                placeholder="+977-9800000000"
              />
            </div>

            <div className="md:col-span-2">
              <Label className="mb-1 block text-xs font-medium text-muted-foreground">
                Delivery Address
              </Label>
              <Textarea
                rows={2}
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Destination warehouse or customer site address..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Outward Line Items Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" /> Dispatched Items (From Inventory Master)
            </CardTitle>
            <Button size="sm" variant="outline" onClick={addLine}>
              <Plus className="mr-1 h-4 w-4" /> Add Item
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table className="table-fixed min-w-[1260px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">S.No</TableHead>
                  <TableHead className="w-[280px]">Material / Item Name</TableHead>
                  <TableHead className="w-[100px]">Code</TableHead>
                  <TableHead className="w-[90px]">UOM</TableHead>
                  <TableHead className="w-[110px] text-right">Dispatch Qty</TableHead>
                  <TableHead className="w-[100px] text-right">Per Unit</TableHead>
                  <TableHead className="w-[160px]">Lot Number</TableHead>
                  <TableHead className="w-[130px]">Expiry Date</TableHead>
                  <TableHead className="w-[90px]">Age (Days)</TableHead>
                  <TableHead className="w-[110px] text-right">Line Amount</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l, i) => {
                  const lineAmt = Number(l.quantity || 0) * Number(l.per_unit || 0);
                  const ageDays = calculateAge(l.created_at);

                  return (
                    <TableRow key={i}>
                      <TableCell className="w-[50px] text-muted-foreground align-middle">{l.sno}</TableCell>

                      {/* Item Combobox */}
                      <TableCell className="w-[280px] align-middle">
                        <EntityCombobox
                          value={l.ref_id}
                          onChange={(id, row) => {
                            if (row) {
                              const availableLots = getAvailableLotsForItem(id);
                              const firstLot = availableLots[0];
                              const mainUom = (row.uom as string) || "NOS";
                              const altUom = (row.alt_uom as string) || "";
                              const altConv = Number(row.alt_uom_conversion || 0);
                              const totalStock = Number(row.qty || 0);

                              updateLine(i, {
                                ref_id: id,
                                code: (row.item_code as string) || "",
                                name: (row.item_name as string) || "",
                                uom: mainUom,
                                main_uom: mainUom,
                                alt_uom: altUom,
                                alt_uom_conversion: altConv,
                                total_stock: totalStock,
                                available_qty: firstLot?.qty ?? totalStock,
                                per_unit: firstLot?.per_unit || Number(row.default_rate) || l.per_unit,
                                lot_number: firstLot?.lot_number || (row.lot_number as string) || "",
                                expiry_date: firstLot?.expiry_date || (row.expiry_date as string) || "",
                                created_at: firstLot?.created_at || (row.created_at as string) || "",
                              });
                            } else {
                              updateLine(i, { ref_id: null });
                            }
                          }}
                          options={itemOptions}
                          placeholder={l.name || "Select material…"}
                          addLabel="Add new inventory item"
                          table="items"
                          schema={customerSchema}
                          fields={customerFields}
                          nameKey="item_name"
                        />
                        {l.ref_id ? (
                          <div className="mt-1 space-y-0.5">
                            {(() => {
                              const isAlt = l.alt_uom && l.uom === l.alt_uom && Number(l.alt_uom_conversion || 0) > 0;
                              const conv = isAlt ? Number(l.alt_uom_conversion) : 1;
                              const totalDisp = Number(l.total_stock || 0) * conv;
                              const lotDisp = Number(l.available_qty || 0) * conv;
                              const uomLabel = l.uom;
                              return (
                                <>
                                  <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                                    <span>Total Stock:</span>
                                    <Badge variant="outline" className="text-[10px] h-4 py-0 px-1 font-mono">
                                      {num(totalDisp)} {uomLabel}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                                    <span>Lot Stock:</span>
                                    <Badge variant="secondary" className="text-[10px] h-4 py-0 px-1 font-mono">
                                      {num(lotDisp)} {uomLabel}
                                    </Badge>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        ) : null}
                      </TableCell>

                      {/* Item Code */}
                      <TableCell className="w-[100px] align-middle">
                        <Input
                          className="w-full font-mono text-xs"
                          value={l.code}
                          onChange={(e) => updateLine(i, { code: e.target.value })}
                        />
                      </TableCell>

                      {/* UOM Selector (Main vs Alt UOM) */}
                      <TableCell className="w-[90px] align-middle">
                        {l.alt_uom ? (
                          <Select
                            value={l.uom}
                            onValueChange={(selectedUom) => updateLine(i, { uom: selectedUom })}
                          >
                            <SelectTrigger className="h-9 w-full text-xs font-mono px-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={l.main_uom || "NOS"}>
                                {l.main_uom || "NOS"}
                              </SelectItem>
                              <SelectItem value={l.alt_uom}>
                                {l.alt_uom}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            className="w-full text-xs font-mono"
                            value={l.uom}
                            onChange={(e) => updateLine(i, { uom: e.target.value })}
                          />
                        )}
                      </TableCell>

                      {/* Quantity Issued & Stock Validation */}
                      <TableCell className="w-[110px] align-middle">
                        {(() => {
                          const isAlt = l.alt_uom && l.uom === l.alt_uom && Number(l.alt_uom_conversion || 0) > 0;
                          const reqBaseQty = isAlt
                            ? Number(l.quantity || 0) / Number(l.alt_uom_conversion)
                            : Number(l.quantity || 0);
                          const availBaseQty = Number(l.available_qty || 0);
                          const isOverStock = l.ref_id && availBaseQty > 0 && reqBaseQty > availBaseQty;

                          return (
                            <div>
                              <Input
                                type="number"
                                step="any"
                                className={`w-full text-right font-semibold ${
                                  isOverStock ? "border-destructive text-destructive" : ""
                                }`}
                                value={l.quantity}
                                onChange={(e) =>
                                  updateLine(i, { quantity: toNumber(e.target.value, 1) })
                                }
                              />
                              {isOverStock ? (
                                <div className="text-[9px] text-destructive mt-0.5 text-right font-medium">
                                  Exceeds stock!
                                </div>
                              ) : null}
                            </div>
                          );
                        })()}
                      </TableCell>

                      {/* Per Unit */}
                      <TableCell className="w-[100px] align-middle">
                        <Input
                          type="number"
                          step="any"
                          className="w-full text-right"
                          value={l.per_unit}
                          onChange={(e) =>
                            updateLine(i, { per_unit: toNumber(e.target.value, 0) })
                          }
                        />
                      </TableCell>

                      {/* Lot Number — Interactive Lot Selector updating lot stock & dates */}
                      <TableCell className="w-[160px] align-middle">
                        {(() => {
                          const availableLots = getAvailableLotsForItem(l.ref_id);
                          if (availableLots.length > 0) {
                            return (
                              <Select
                                value={l.lot_number || undefined}
                                onValueChange={(selectedLotNum) => {
                                  const selectedLot = availableLots.find(
                                    (lot) => lot.lot_number === selectedLotNum,
                                  );
                                  if (selectedLot) {
                                    updateLine(i, {
                                      lot_number: selectedLot.lot_number,
                                      expiry_date: selectedLot.expiry_date,
                                      created_at: selectedLot.created_at,
                                      available_qty: selectedLot.qty,
                                      per_unit: selectedLot.per_unit || l.per_unit,
                                    });
                                  } else {
                                    updateLine(i, { lot_number: selectedLotNum });
                                  }
                                }}
                              >
                                <SelectTrigger className="h-9 w-full text-xs font-mono truncate">
                                  <SelectValue placeholder="Select Lot…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableLots.map((lot) => {
                                    const lotAge = calculateAge(lot.created_at);
                                    const isAlt = l.alt_uom && l.uom === l.alt_uom && Number(l.alt_uom_conversion || 0) > 0;
                                    const displayQty = isAlt ? lot.qty * Number(l.alt_uom_conversion) : lot.qty;

                                    return (
                                      <SelectItem
                                        key={lot.lot_number}
                                        value={lot.lot_number}
                                        className="text-xs"
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="font-mono font-semibold">{lot.lot_number}</span>
                                          <span className="text-[10px] text-muted-foreground">
                                            {displayQty > 0 ? `${num(displayQty)} ${l.uom}` : ""}
                                            {lot.expiry_date ? ` · Exp: ${formatDate(lot.expiry_date, dateFormat)}` : ""}
                                            {lotAge !== null ? ` · Age: ${lotAge}d` : ""}
                                          </span>
                                        </div>
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            );
                          }

                          return (
                            <Input
                              className="w-full font-mono text-xs"
                              placeholder="LOT-102"
                              value={l.lot_number}
                              onChange={(e) => updateLine(i, { lot_number: e.target.value })}
                            />
                          );
                        })()}
                      </TableCell>

                      {/* Expiry Date — auto-filled from master */}
                      <TableCell className="w-[140px] align-middle">
                        <Input
                          type="date"
                          className="w-full text-xs"
                          value={l.expiry_date}
                          onChange={(e) => updateLine(i, { expiry_date: e.target.value })}
                        />
                      </TableCell>

                      {/* Age = today - created_at (system entry date) */}
                      <TableCell className="w-[100px] align-middle text-center">
                        {ageDays !== null ? (
                          <Badge
                            variant={ageDays > 180 ? "destructive" : ageDays > 90 ? "outline" : "secondary"}
                            className={`text-xs ${
                              ageDays > 180
                                ? ""
                                : ageDays > 90
                                  ? "border-amber-500 text-amber-600"
                                  : ""
                            }`}
                          >
                            {ageDays}d
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>

                      {/* Line Amount */}
                      <TableCell className="w-[110px] text-right font-semibold align-middle">
                        {inr(lineAmt)}
                      </TableCell>

                      {/* Remove Button */}
                      <TableCell className="w-[40px] align-middle">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeLine(i)}
                          disabled={lines.length === 1}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Notes & Summary Card */}
        <Card>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="mb-1 block text-xs font-medium text-muted-foreground">
                Dispatch &amp; Transporter Notes
              </Label>
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Handling instructions, seal numbers, or delivery notes..."
              />
            </div>
            <div className="flex flex-col justify-end space-y-2 border-t md:border-t-0 md:border-l md:pl-6 pt-4 md:pt-0">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Dispatched Units:</span>
                <span className="font-semibold">{num(lines.reduce((a, b) => a + Number(b.quantity || 0), 0))}</span>
              </div>
              <div className="flex items-center justify-between text-lg font-bold">
                <span>Total Goods Value:</span>
                <span className="text-primary">{inr(totalAmount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
