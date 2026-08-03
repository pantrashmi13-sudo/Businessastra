import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  Boxes,
  AlertTriangle,
  History,
  Tag,
  Search,
  ArrowUpDown,
  Calendar,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { inr, num } from "@/lib/format";
import { MasterForm } from "./MasterForm";
import { itemSchema, itemFields } from "./schemas";

interface ItemRecord {
  id: string;
  item_code: string;
  item_name: string;
  uom: string;
  category?: string | null;
  parent_category?: string | null;
  sub_parent_category?: string | null;
  hsn_code?: string | null;
  default_rate: number;
  vat_rate: number;
  qty: number;
  selling_price: number;
  reorder_level: number;
  warehouse?: string | null;
  status?: string | null;
  is_service?: boolean | null;
  alt_uom?: string | null;
  alt_uom_conversion?: number | null;
  description?: string | null;
  created_at?: string;
}

interface UnifiedMovement {
  id: string;
  type: "inward" | "outward";
  docNumber: string;
  partyName: string;
  date: string;
  ref_id?: string | null;
  code?: string | null;
  name: string;
  uom?: string | null;
  quantity: number;
  per_unit: number;
  lot_number?: string | null;
  expiry_date?: string | null;
  line_amount: number;
  created_at: string;
}

export function MaterialCentreRegister() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const returnBillId = (search as any)?.returnBillId;

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "goods" | "services">("all");
  const [uomMode, setUomMode] = useState<"main" | "alt">("main");
  const [openNewDialog, setOpenNewDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemRecord | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedItemCode, setSelectedItemCode] = useState<string | null>(null);

  // Fetch all inventory items
  const itemsQuery = useQuery({
    queryKey: ["items", "material-register"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .order("item_code", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ItemRecord[];
    },
  });

  // Fetch all movements (Inward from Bills + Outward from Delivery Challans)
  const movementsQuery = useQuery({
    queryKey: ["unified_movements", "material-register"],
    queryFn: async () => {
      // 1. Inward movements from approved bills
      const { data: billLines } = await supabase
        .from("bill_lines")
        .select(`
          id, bill_id, ref_id, code, name, uom, quantity, per_unit, vat_rate,
          lot_number, expiry_date, line_amount, created_at,
          bills!inner(bill_number, invoice_date, status, bill_type, vendors(name))
        `)
        .eq("bills.status", "approved")
        .order("created_at", { ascending: false });

      // 2. Outward movements from delivery challans
      const { data: challanLines } = await supabase
        .from("delivery_challan_lines" as any)
        .select(`
          id, challan_id, ref_id, code, name, uom, quantity, per_unit,
          lot_number, expiry_date, line_amount, created_at,
          delivery_challans!inner(challan_number, challan_date, status, customers(name))
        `)
        .order("created_at", { ascending: false });

      const list: UnifiedMovement[] = [];

      if (billLines) {
        for (const b of billLines as any[]) {
          list.push({
            id: b.id,
            type: "inward",
            docNumber: b.bills?.bill_number || "Bill",
            partyName: b.bills?.vendors?.name || "Vendor",
            date: b.bills?.invoice_date || b.created_at.slice(0, 10),
            ref_id: b.ref_id,
            code: b.code,
            name: b.name,
            uom: b.uom || "NOS",
            quantity: Number(b.quantity || 0),
            per_unit: Number(b.per_unit || 0),
            lot_number: b.lot_number,
            expiry_date: b.expiry_date,
            line_amount: Number(b.line_amount || 0),
            created_at: b.created_at,
          });
        }
      }

      if (challanLines) {
        for (const c of challanLines as any[]) {
          list.push({
            id: c.id,
            type: "outward",
            docNumber: c.delivery_challans?.challan_number || "Challan",
            partyName: c.delivery_challans?.customers?.name || "Customer",
            date: c.delivery_challans?.challan_date || c.created_at.slice(0, 10),
            ref_id: c.ref_id,
            code: c.code,
            name: c.name,
            uom: c.uom || "NOS",
            quantity: Number(c.quantity || 0),
            per_unit: Number(c.per_unit || 0),
            lot_number: c.lot_number,
            expiry_date: c.expiry_date,
            line_amount: Number(c.line_amount || 0),
            created_at: c.created_at,
          });
        }
      }

      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return list;
    },
  });

  // Delete item mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item deleted");
      qc.invalidateQueries({ queryKey: ["items"] });
      setConfirmDeleteId(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Group items by item_code (Primary Key)
  const groupedItems = useMemo(() => {
    const rawList = itemsQuery.data ?? [];
    const map = new Map<string, { mainItem: ItemRecord; allIds: string[]; totalQty: number }>();

    for (const item of rawList) {
      const codeKey = (item.item_code || item.id).trim().toUpperCase();
      if (!map.has(codeKey)) {
        map.set(codeKey, {
          mainItem: item,
          allIds: [item.id],
          totalQty: Number(item.qty || 0),
        });
      } else {
        const entry = map.get(codeKey)!;
        entry.allIds.push(item.id);
        entry.totalQty += Number(item.qty || 0);
      }
    }

    return Array.from(map.values()).map((entry) => ({
      ...entry.mainItem,
      qty: entry.totalQty,
      allIds: entry.allIds,
    }));
  }, [itemsQuery.data]);

  // Filter items based on search and category
  const filteredItems = useMemo(() => {
    return groupedItems.filter((item) => {
      // Type filter
      if (filterType === "goods" && item.is_service) return false;
      if (filterType === "services" && !item.is_service) return false;

      // Search filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.item_code.toLowerCase().includes(q) ||
        item.item_name.toLowerCase().includes(q) ||
        (item.hsn_code && item.hsn_code.toLowerCase().includes(q)) ||
        (item.warehouse && item.warehouse.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q)) ||
        (item.parent_category && item.parent_category.toLowerCase().includes(q)) ||
        (item.sub_parent_category && item.sub_parent_category.toLowerCase().includes(q))
      );
    });
  }, [groupedItems, filterType, searchQuery]);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalSkus = groupedItems.length;
    let totalQty = 0;
    let totalValuation = 0;
    let lowStockCount = 0;

    for (const item of groupedItems) {
      if (!item.is_service) {
        totalQty += Number(item.qty || 0);
        totalValuation += Number(item.qty || 0) * Number(item.default_rate || 0);
        if (item.reorder_level > 0 && item.qty <= item.reorder_level) {
          lowStockCount++;
        }
      }
    }

    return { totalSkus, totalQty, totalValuation, lowStockCount };
  }, [groupedItems]);

  // Currently inspected item detail
  const activeDetailItem = useMemo(() => {
    if (!selectedItemCode) return null;
    return groupedItems.find((i) => i.item_code.toUpperCase() === selectedItemCode.toUpperCase()) ?? null;
  }, [selectedItemCode, groupedItems]);

  // Movements and lots for selected item_code
  const activeMovements = useMemo(() => {
    if (!activeDetailItem) return [];
    const itemCodeUpper = activeDetailItem.item_code.trim().toUpperCase();
    const itemIdsSet = new Set(activeDetailItem.allIds);

    return (movementsQuery.data ?? []).filter((m) => {
      if (m.ref_id && itemIdsSet.has(m.ref_id)) return true;
      if (m.code && m.code.trim().toUpperCase() === itemCodeUpper) return true;
      if (m.name && m.name.trim().toLowerCase() === activeDetailItem.item_name.trim().toLowerCase()) return true;
      return false;
    });
  }, [activeDetailItem, movementsQuery.data]);

  // Unique Lots & Expiry breakdown for selected item with accurate Net Balance calculation
  const activeLotRegister = useMemo(() => {
    if (!activeDetailItem) return [];

    const altUom = activeDetailItem.alt_uom || "";
    const altConv = Number(activeDetailItem.alt_uom_conversion || 0);

    // Helper to normalize movement quantity to base UOM
    const getBaseQty = (m: UnifiedMovement) => {
      const qty = Number(m.quantity || 0);
      if (altUom && m.uom === altUom && altConv > 0) {
        return qty / altConv;
      }
      return qty;
    };

    const lotMap = new Map<
      string,
      {
        lotNumber: string;
        expiryDate: string;
        totalQty: number; // in base UOM
        rate: number;
        vendorName: string;
        billNumber: string;
        date: string;
      }
    >();

    // 1. Process movements that have explicit lot numbers
    for (const m of activeMovements) {
      const rawLot = m.lot_number?.trim();
      if (!rawLot) continue;

      const lotKey = rawLot.toUpperCase();
      const baseQty = getBaseQty(m);
      const isOutward = m.type === "outward";

      if (!lotMap.has(lotKey)) {
        lotMap.set(lotKey, {
          lotNumber: rawLot,
          expiryDate: m.expiry_date || "—",
          totalQty: isOutward ? -baseQty : baseQty,
          rate: Number(m.per_unit || activeDetailItem.default_rate || 0),
          vendorName: m.partyName || "—",
          billNumber: m.docNumber || "—",
          date: m.date || m.created_at.slice(0, 10),
        });
      } else {
        const lot = lotMap.get(lotKey)!;
        if (isOutward) {
          lot.totalQty -= baseQty;
        } else {
          lot.totalQty += baseQty;
          if (m.expiry_date && lot.expiryDate === "—") {
            lot.expiryDate = m.expiry_date;
          }
        }
      }
    }

    // 2. Sum explicit lot quantities
    let explicitLotTotal = 0;
    for (const lot of lotMap.values()) {
      if (lot.totalQty > 0) {
        explicitLotTotal += lot.totalQty;
      }
    }

    // 3. Handle unassigned remaining stock
    const totalMasterQty = Number(activeDetailItem.qty || 0);
    const unassignedQty = Math.max(0, totalMasterQty - explicitLotTotal);
    const masterLotNum = ((activeDetailItem as Record<string, unknown>).lot_number as string)?.trim();

    if (unassignedQty > 0 || lotMap.size === 0) {
      const fallbackLotNum =
        masterLotNum ||
        (lotMap.size > 0 ? "General Stock" : `LOT-${activeDetailItem.item_code.trim().toUpperCase()}`);

      const fallbackKey = fallbackLotNum.toUpperCase();
      if (lotMap.has(fallbackKey)) {
        const existing = lotMap.get(fallbackKey)!;
        existing.totalQty += unassignedQty;
      } else {
        lotMap.set(fallbackKey, {
          lotNumber: fallbackLotNum,
          expiryDate: ((activeDetailItem as Record<string, unknown>).expiry_date as string) || "—",
          totalQty: unassignedQty > 0 ? unassignedQty : totalMasterQty,
          rate: Number(activeDetailItem.default_rate || 0),
          vendorName: "Master Entry",
          billNumber: "Unassigned Stock",
          date: (activeDetailItem.created_at as string)?.slice(0, 10) || "—",
        });
      }
    }

    return Array.from(lotMap.values());
  }, [activeMovements, activeDetailItem]);

  const calculateAge = (createdAtStr?: string) => {
    if (!createdAtStr) return null;
    const createdDate = new Date(createdAtStr);
    const today = new Date();
    const ageDays = Math.max(0, Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 3600 * 24)));
    return ageDays;
  };

  const getExpiryBadge = (expiryDateStr: string) => {
    if (expiryDateStr === "—" || !expiryDateStr) return null;
    const expDate = new Date(expiryDateStr);
    const today = new Date();
    const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

    if (diffDays < 0) {
      return <Badge variant="destructive" className="text-xs">Expired</Badge>;
    } else if (diffDays <= 60) {
      return <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400 text-xs">Expiring in {diffDays}d</Badge>;
    }
    return <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs">Good</Badge>;
  };

  return (
    <div className="space-y-6 p-6">
      {returnBillId && (
        <div className="flex items-center justify-between p-4 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 shadow-sm">
          <div className="flex items-center space-x-3">
            <span className="flex h-3 w-3 rounded-full bg-blue-600 animate-pulse" />
            <p className="text-sm font-medium">
              Editing synced master records from Bill approval. Update item details below and return anytime.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => navigate({ to: "/bills/$id", params: { id: returnBillId } })}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Bill
          </Button>
        </div>
      )}

      <PageHeader
        title="Material Centre Register"
        description="Comprehensive Inventory Stock Register grouped by Item Code with Lot, Expiry & Movement Tracking."
        actions={
          <Dialog open={openNewDialog} onOpenChange={setOpenNewDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingItem(null)}>
                <Plus className="mr-1 h-4 w-4" /> Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingItem ? "Edit Item Master" : "New Inventory Item"}</DialogTitle>
              </DialogHeader>
              <MasterForm
                table="items"
                schema={itemSchema}
                fields={itemFields}
                initial={editingItem as unknown as Record<string, unknown>}
                onSaved={() => {
                  setOpenNewDialog(false);
                  setEditingItem(null);
                  qc.invalidateQueries({ queryKey: ["items"] });
                }}
                onCancel={() => {
                  setOpenNewDialog(false);
                  setEditingItem(null);
                }}
              />
            </DialogContent>
          </Dialog>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Material SKUs</CardTitle>
            <Boxes className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSkus}</div>
            <p className="text-xs text-muted-foreground mt-1">Unique item codes registered</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Stock Units</CardTitle>
            <Package className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{num(stats.totalQty)}</div>
            <p className="text-xs text-muted-foreground mt-1">Units available in warehouse</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Stock Valuation</CardTitle>
            <Tag className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inr(stats.totalValuation)}</div>
            <p className="text-xs text-muted-foreground mt-1">Based on purchase cost</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reorder Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.lowStockCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Items at or below reorder level</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar with UOM Mode Toggle */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search code, name, HSN, warehouse…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* UOM View Mode Toggle */}
          <div className="flex items-center gap-1 border rounded-lg p-1 bg-muted/40 text-xs">
            <span className="text-muted-foreground px-1.5 font-medium">Display UOM:</span>
            <Button
              size="sm"
              type="button"
              variant={uomMode === "main" ? "default" : "ghost"}
              className="h-7 text-xs px-2.5"
              onClick={() => setUomMode("main")}
            >
              Main UOM
            </Button>
            <Button
              size="sm"
              type="button"
              variant={uomMode === "alt" ? "default" : "ghost"}
              className="h-7 text-xs px-2.5"
              onClick={() => setUomMode("alt")}
            >
              Alt UOM
            </Button>
          </div>

          <Tabs value={filterType} onValueChange={(v) => setFilterType(v as any)} className="w-auto">
            <TabsList>
              <TabsTrigger value="all">All ({groupedItems.length})</TabsTrigger>
              <TabsTrigger value="goods">Inventory Goods</TabsTrigger>
              <TabsTrigger value="services">Services</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Primary Material Register Table */}
      <div className="rounded-md border bg-card shadow-sm overflow-hidden">
        <Table className="min-w-[900px]">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[120px]">Item Code</TableHead>
              <TableHead className="min-w-[200px]">Item / Material Name</TableHead>
              <TableHead className="w-[90px]">UOM ({uomMode === "alt" ? "Alt" : "Main"})</TableHead>
              <TableHead className="w-[110px] text-right">Stock Qty</TableHead>
              <TableHead className="w-[120px] text-right">Purchase Rate</TableHead>
              <TableHead className="w-[120px] text-right">Selling Price</TableHead>
              <TableHead className="w-[130px] text-right">Total Value</TableHead>
              <TableHead className="w-[120px]">Warehouse</TableHead>
              <TableHead className="w-[90px]">Status</TableHead>
              <TableHead className="w-[130px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itemsQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                  Loading Material Centre Register…
                </TableCell>
              </TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-12 text-center text-muted-foreground">
                  No items found. Click <b>Add Item</b> to register a new material.
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => {
                const isLowStock = item.reorder_level > 0 && item.qty <= item.reorder_level;
                const totalValue = Number(item.qty || 0) * Number(item.default_rate || 0);

                const isAltMode = uomMode === "alt" && Boolean(item.alt_uom) && Number(item.alt_uom_conversion || 0) > 0;
                const displayQty = isAltMode
                  ? num(Number(item.qty || 0) * Number(item.alt_uom_conversion!))
                  : num(item.qty);
                const displayUom = isAltMode ? item.alt_uom! : (item.uom || "NOS");

                return (
                  <TableRow
                    key={item.id}
                    className="hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedItemCode(item.item_code)}
                  >
                    <TableCell className="font-semibold text-primary">
                      {item.item_code}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{item.item_name}</div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                        {item.hsn_code ? <span>HSN: {item.hsn_code}</span> : null}
                        {item.category ? (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                            {item.category}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {displayUom}
                      </Badge>
                      {item.alt_uom && !isAltMode ? (
                        <div className="text-[9px] text-muted-foreground mt-0.5 font-mono">Alt: {item.alt_uom}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <span className={isLowStock ? "text-amber-600 font-bold" : ""}>
                        {displayQty}
                      </span>
                      {isLowStock ? (
                        <div className="text-[10px] text-amber-600 font-normal">Reorder alert</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">{inr(item.default_rate)}</TableCell>
                    <TableCell className="text-right">{inr(item.selling_price)}</TableCell>
                    <TableCell className="text-right font-semibold">{inr(totalValue)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {item.warehouse || "Main"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.status === "Inactive" ? "secondary" : "default"}>
                        {item.status || "Active"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs gap-1"
                          onClick={() => setSelectedItemCode(item.item_code)}
                        >
                          <History className="h-3.5 w-3.5" /> Movements
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingItem(item);
                            setOpenNewDialog(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setConfirmDeleteId(item.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Item Detail / Lot / Stock Movement Drawer */}
      <Sheet open={!!selectedItemCode} onOpenChange={(v) => !v && setSelectedItemCode(null)}>
        <SheetContent side="right" className="w-[90vw] sm:max-w-2xl overflow-y-auto p-6">
          {activeDetailItem ? (
            <div className="space-y-6">
              <SheetHeader className="pb-4 border-b">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="font-mono text-sm">
                    {activeDetailItem.item_code}
                  </Badge>
                  <Badge variant={activeDetailItem.status === "Inactive" ? "secondary" : "default"}>
                    {activeDetailItem.status || "Active"}
                  </Badge>
                </div>
                <SheetTitle className="text-2xl mt-2">{activeDetailItem.item_name}</SheetTitle>
                <SheetDescription className="flex items-center gap-4 text-sm mt-1">
                  <span>UOM: <b>{activeDetailItem.uom}</b></span>
                  <span>Warehouse: <b>{activeDetailItem.warehouse || "Main"}</b></span>
                  <span>Stock: <b className="text-primary">{num(activeDetailItem.qty)} {activeDetailItem.uom}</b></span>
                </SheetDescription>
              </SheetHeader>

              {/* Tabs for Stock Movements & Closing Balance, and Master Specs */}
              <Tabs defaultValue="movements" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="movements">Stock Movements &amp; Closing Balance</TabsTrigger>
                  <TabsTrigger value="details">Item Specs</TabsTrigger>
                </TabsList>

                {/* Tab 1: Stock Movement History / Ledger with Lot & Age details */}
                <TabsContent value="movements" className="pt-4 space-y-6">
                  <div className="text-xs text-muted-foreground flex items-center justify-between">
                    <span>Audit trail of inward purchases (Bills) and outward dispatches (Delivery Challans)</span>
                    <span>Total Transactions: <b>{activeMovements.length}</b></span>
                  </div>

                  <div className="rounded-md border bg-card overflow-x-auto">
                    <Table className="min-w-[800px]">
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="w-[90px]">Type</TableHead>
                          <TableHead className="w-[90px]">Date</TableHead>
                          <TableHead className="w-[110px]">Doc / Ref #</TableHead>
                          <TableHead className="w-[130px]">Party Name</TableHead>
                          <TableHead className="w-[90px]">Lot #</TableHead>
                          <TableHead className="w-[90px]">Expiry</TableHead>
                          <TableHead className="w-[70px]">Age</TableHead>
                          <TableHead className="w-[100px] text-right">Qty &amp; UOM</TableHead>
                          <TableHead className="w-[80px] text-right">Rate</TableHead>
                          <TableHead className="w-[90px] text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeMovements.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={10} className="py-6 text-center text-muted-foreground text-sm">
                              No stock movements recorded yet.
                            </TableCell>
                          </TableRow>
                        ) : (
                          activeMovements.map((m) => {
                            const ageDays = calculateAge(m.created_at);
                            return (
                              <TableRow key={m.id}>
                                <TableCell>
                                  <Badge
                                    variant={m.type === "inward" ? "default" : "outline"}
                                    className={m.type === "inward" ? "bg-emerald-600 text-white text-[10px]" : "border-blue-500 text-blue-600 text-[10px]"}
                                  >
                                    {m.type === "inward" ? "Inward" : "Outward"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs">{m.date}</TableCell>
                                <TableCell className="font-medium text-xs font-mono">{m.docNumber}</TableCell>
                                <TableCell className="text-xs font-medium">{m.partyName}</TableCell>
                                <TableCell className="font-mono text-xs">{m.lot_number || "—"}</TableCell>
                                <TableCell className="text-xs">{m.expiry_date || "—"}</TableCell>
                                <TableCell className="text-xs">
                                  {ageDays !== null ? (
                                    <Badge variant="secondary" className="text-[10px]">
                                      {ageDays}d
                                    </Badge>
                                  ) : (
                                    "—"
                                  )}
                                </TableCell>
                                <TableCell className={`text-right font-medium font-mono ${m.type === "inward" ? "text-emerald-600" : "text-blue-600"}`}>
                                  {m.type === "inward" ? `+${num(m.quantity)}` : `-${num(m.quantity)}`}{" "}
                                  <span className="text-[10px] font-normal text-muted-foreground">{m.uom || "NOS"}</span>
                                </TableCell>
                                <TableCell className="text-right text-xs">{inr(m.per_unit)}</TableCell>
                                <TableCell className="text-right font-semibold text-xs">{inr(m.line_amount)}</TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Final Closing Balance Summary Section */}
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-4">
                    <div className="flex items-center justify-between border-b border-primary/20 pb-3">
                      <div>
                        <h4 className="font-semibold text-sm text-foreground">Final Closing Stock Summary</h4>
                        <p className="text-xs text-muted-foreground">Current physical stock in material centre based on movements</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-muted-foreground block">Closing Valuation</span>
                        <span className="text-xl font-bold text-primary">
                          {inr(Number(activeDetailItem.qty || 0) * Number(activeDetailItem.default_rate || 0))}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="rounded-md bg-background p-3 border">
                        <span className="text-xs text-muted-foreground block">Final Closing Quantity</span>
                        <span className="text-2xl font-bold text-foreground">
                          {num(activeDetailItem.qty)} <span className="text-sm font-medium text-muted-foreground">{activeDetailItem.uom}</span>
                        </span>
                      </div>
                      <div className="rounded-md bg-background p-3 border">
                        <span className="text-xs text-muted-foreground block">Purchase Default Rate</span>
                        <span className="text-2xl font-bold text-foreground">
                          {inr(activeDetailItem.default_rate)}
                        </span>
                      </div>
                    </div>

                    {/* Active Lots Breakdown */}
                    {activeLotRegister.filter((lot) => lot.totalQty > 0).length > 0 ? (
                      <div className="space-y-2 pt-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                          Active Stock by Lot &amp; Expiry
                        </span>
                        <div className="rounded-md border bg-background overflow-hidden">
                          <Table>
                            <TableHeader className="bg-muted/40">
                              <TableRow>
                                <TableHead className="text-xs">Lot Number</TableHead>
                                <TableHead className="text-xs">Expiry Date</TableHead>
                                <TableHead className="text-xs">Status</TableHead>
                                <TableHead className="text-xs text-right">Remaining Stock</TableHead>
                                <TableHead className="text-xs text-right">Estimated Value</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {activeLotRegister
                                .filter((lot) => lot.totalQty > 0)
                                .map((lot, idx) => {
                                  const isAltMode = uomMode === "alt" && Boolean(activeDetailItem.alt_uom) && Number(activeDetailItem.alt_uom_conversion || 0) > 0;
                                  const lotQty = isAltMode
                                    ? lot.totalQty * Number(activeDetailItem.alt_uom_conversion!)
                                    : lot.totalQty;
                                  const lotUom = isAltMode ? activeDetailItem.alt_uom! : (activeDetailItem.uom || "NOS");

                                  return (
                                    <TableRow key={idx}>
                                      <TableCell className="font-mono text-xs font-medium">{lot.lotNumber}</TableCell>
                                      <TableCell className="text-xs">{lot.expiryDate}</TableCell>
                                      <TableCell>{getExpiryBadge(lot.expiryDate)}</TableCell>
                                      <TableCell className="text-right font-mono font-semibold text-xs text-primary">
                                        {num(lotQty)} {lotUom}
                                      </TableCell>
                                      <TableCell className="text-right text-xs font-medium">
                                        {inr(lot.totalQty * lot.rate)}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </TabsContent>

                {/* Tab 3: Detailed Master Specifications */}
                <TabsContent value="details" className="pt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Item Code</span>
                      <p className="font-medium">{activeDetailItem.item_code}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">HSN Code</span>
                      <p className="font-medium">{activeDetailItem.hsn_code || "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Category</span>
                      <p className="font-medium">{activeDetailItem.category || "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Parent Category</span>
                      <p className="font-medium">{activeDetailItem.parent_category || "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Sub-Parent Category</span>
                      <p className="font-medium">{activeDetailItem.sub_parent_category || "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Warehouse</span>
                      <p className="font-medium">{activeDetailItem.warehouse || "Main"}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Purchase Rate</span>
                      <p className="font-medium">{inr(activeDetailItem.default_rate)}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Selling Price</span>
                      <p className="font-medium">{inr(activeDetailItem.selling_price)}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Reorder Level</span>
                      <p className="font-medium">{activeDetailItem.reorder_level || 0} {activeDetailItem.uom}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">VAT %</span>
                      <p className="font-medium">{activeDetailItem.vat_rate}%</p>
                    </div>
                  </div>
                  {activeDetailItem.description ? (
                    <div className="pt-2 border-t text-sm">
                      <span className="text-xs text-muted-foreground block mb-1">Description</span>
                      <p className="text-muted-foreground">{activeDetailItem.description}</p>
                    </div>
                  ) : null}
                </TabsContent>
              </Tabs>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(v) => !v && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Material Item?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this item from Masters? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteId && deleteMutation.mutate(confirmDeleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
