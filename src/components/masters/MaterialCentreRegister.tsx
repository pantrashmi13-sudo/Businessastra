import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
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
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { inr, num } from "@/lib/format";
import { formatDate } from "@/lib/date-conversion";
import { useDateFormat } from "@/hooks/use-date-format";
import { MasterForm } from "./MasterForm";
import { itemSchema, itemFields } from "./schemas";
import { ItemFormDialog } from "./ItemFormDialog";

interface ItemRecord {
  id: string;
  item_code: string;
  item_name: string;
  uom: string;
  category?: string | null;
  parent_category?: string | null;
  sub_parent_category?: string | null;
  sub_category?: string | null;
  hsn_code?: string | null;
  default_rate: number;
  vat_rate: number;
  qty: number;
  selling_price: number;
  reorder_level: number;
  warehouse?: string | null;
  status?: string | null;
  is_service?: boolean | null;
  is_inventory?: boolean | null;
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
  landing_cost?: number;
  created_at: string;
  source?: "bill" | "challan" | "purchase_return" | "sales_return";
}

export function MaterialCentreRegister() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const returnBillId = (search as any)?.returnBillId;
  const dateFormat = useDateFormat();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"inventory" | "other" | "services">("inventory");
  const [uomMode, setUomMode] = useState<"main" | "alt">("main");
  const [openNewDialog, setOpenNewDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemRecord | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedItemCode, setSelectedItemCode] = useState<string | null>(null);

  // Category filters (multi-select)
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterParentCategory, setFilterParentCategory] = useState<string>("all");
  const [filterSubParentCategory, setFilterSubParentCategory] = useState<string>("all");
  const [filterSubCategory, setFilterSubCategory] = useState<string>("all");
  
  // Import state
  const [openImportDialog, setOpenImportDialog] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    newItems: { itemCode: string; itemName: string; openingQty: number; openingValue: number }[];
    existingItems: { itemCode: string; itemName: string; openingQty: number; openingValue: number }[];
    parsedRows: any[];
    headers: string[];
    companyId: string;
  } | null>(null);
  const [previewing, setPreviewing] = useState(false);

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


  // Fetch all movements (Inward from Bills + Outward from Challans + Returns)
  const movementsQuery = useQuery({
    queryKey: ["unified_movements", "material-register"],
    queryFn: async () => {
      // 1. Inward movements from approved bills
      const { data: billLines } = await supabase
        .from("bill_lines")
        .select(`
          id, bill_id, ref_id, code, name, uom, quantity, per_unit, vat_rate,
          lot_number, expiry_date, line_amount, landing_cost, created_at,
          bills!inner(bill_number, invoice_date, status, bill_type, vendors(name))
        `)
        .eq("bills.status", "approved")
        .order("created_at", { ascending: false });

      // 2. Outward movements from delivery challans
      const { data: challanLines } = await supabase
        .from("delivery_challan_lines" as any)
        .select(`
          id, challan_id, ref_id, code, name, uom, quantity, per_unit,
          lot_number, expiry_date, line_amount, landing_cost, created_at,
          delivery_challans!inner(challan_number, challan_date, status, customers(name))
        `)
        .order("created_at", { ascending: false });

      // 3. Outward movements from purchase returns (items returned to vendors)
      const { data: purchaseReturnLines } = await supabase
        .from("purchase_return_lines")
        .select(`
          id, return_id, ref_id, code, name, uom, quantity, per_unit,
          line_amount, created_at,
          purchase_returns!inner(return_number, return_date, status, vendors(name))
        `)
        .eq("purchase_returns.status", "approved")
        .order("created_at", { ascending: false });

      // 4. Inward movements from sales returns (items returned by customers)
      const { data: salesReturnLines } = await supabase
        .from("sales_return_lines")
        .select(`
          id, return_id, ref_id, code, name, uom, quantity, per_unit,
          line_amount, created_at,
          sales_returns!inner(return_number, return_date, status, customers(name))
        `)
        .eq("sales_returns.status", "approved")
        .order("created_at", { ascending: false });

      const list: UnifiedMovement[] = [];

      if (billLines) {
        for (const b of billLines as any[]) {
          list.push({
            id: b.id,
            type: "inward",
            docNumber: b.bills?.bill_number || "Bill",
            partyName: b.bills?.bill_number === "OPENING-STOCK" ? "Opening Stock" : (b.bills?.vendors?.name || "Vendor"),
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
            landing_cost: Number(b.landing_cost || b.per_unit || 0),
            created_at: b.created_at,
            source: "bill",
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
            landing_cost: Number(c.landing_cost || c.per_unit || 0),
            created_at: c.created_at,
            source: "challan",
          });
        }
      }

      if (purchaseReturnLines) {
        for (const pr of purchaseReturnLines as any[]) {
          list.push({
            id: pr.id,
            type: "outward",
            docNumber: pr.purchase_returns?.return_number || "Purchase Return",
            partyName: pr.purchase_returns?.vendors?.name || "Vendor",
            date: pr.purchase_returns?.return_date || pr.created_at.slice(0, 10),
            ref_id: pr.ref_id,
            code: pr.code,
            name: pr.name,
            uom: pr.uom || "NOS",
            quantity: Number(pr.quantity || 0),
            per_unit: Number(pr.per_unit || 0),
            line_amount: Number(pr.line_amount || 0),
            landing_cost: Number(pr.per_unit || 0),
            created_at: pr.created_at,
            source: "purchase_return",
          });
        }
      }

      if (salesReturnLines) {
        for (const sr of salesReturnLines as any[]) {
          list.push({
            id: sr.id,
            type: "inward",
            docNumber: sr.sales_returns?.return_number || "Sales Return",
            partyName: sr.sales_returns?.customers?.name || "Customer",
            date: sr.sales_returns?.return_date || sr.created_at.slice(0, 10),
            ref_id: sr.ref_id,
            code: sr.code,
            name: sr.name,
            uom: sr.uom || "NOS",
            quantity: Number(sr.quantity || 0),
            per_unit: Number(sr.per_unit || 0),
            line_amount: Number(sr.line_amount || 0),
            landing_cost: Number(sr.per_unit || 0),
            created_at: sr.created_at,
            source: "sales_return",
          });
        }
      }

      list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
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
          totalQty: 0,
        });
      } else {
        const entry = map.get(codeKey)!;
        entry.allIds.push(item.id);
      }
    }

    return Array.from(map.values()).map((entry) => ({
      ...entry.mainItem,
      qty: 0,
      allIds: entry.allIds,
    }));
  }, [itemsQuery.data]);

  // Compute movement-based qty per item code (separate memo for clean dependency)
  const movementQtyByCode = useMemo(() => {
    const movements = movementsQuery.data ?? [];
    const qtyMap = new Map<string, number>();
    for (const m of movements) {
      const codeKey = (m.code || "").trim().toUpperCase();
      if (!codeKey) continue;
      const qty = Number(m.quantity || 0);
      qtyMap.set(codeKey, (qtyMap.get(codeKey) || 0) + (m.type === "inward" ? qty : -qty));
    }
    return qtyMap;
  }, [movementsQuery.data]);

  // Build name -> code mapping for name-based matching
  const nameToCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of (itemsQuery.data ?? [])) {
      const codeKey = (item.item_code || item.id).trim().toUpperCase();
      const nameKey = (item.item_name || "").trim().toLowerCase();
      if (nameKey) map.set(nameKey, codeKey);
    }
    return map;
  }, [itemsQuery.data]);

  // Compute qty from movements by name (fallback for when code is null)
  const movementQtyByName = useMemo(() => {
    const movements = movementsQuery.data ?? [];
    const qtyMap = new Map<string, number>();
    for (const m of movements) {
      if (m.code) continue; // already counted in movementQtyByCode
      const nameKey = (m.name || "").trim().toLowerCase();
      if (!nameKey) continue;
      const codeKey = nameToCode.get(nameKey);
      if (!codeKey) continue;
      const qty = Number(m.quantity || 0);
      qtyMap.set(codeKey, (qtyMap.get(codeKey) || 0) + (m.type === "inward" ? qty : -qty));
    }
    return qtyMap;
  }, [movementsQuery.data, nameToCode]);

  // Compute qty from movements by ref_id (fallback for when code and name don't match)
  const movementQtyByRefId = useMemo(() => {
    const movements = movementsQuery.data ?? [];
    const qtyMap = new Map<string, number>();
    for (const m of movements) {
      if (m.code || m.name) continue; // already counted above
      if (!m.ref_id) continue;
      const qty = Number(m.quantity || 0);
      qtyMap.set(m.ref_id, (qtyMap.get(m.ref_id) || 0) + (m.type === "inward" ? qty : -qty));
    }
    return qtyMap;
  }, [movementsQuery.data]);

  // Merge movement-based qty into groupedItems
  const groupedItemsWithQty = useMemo(() => {
    return groupedItems.map((item) => {
      const codeKey = (item.item_code || item.id).trim().toUpperCase();
      let qty = (movementQtyByCode.get(codeKey) ?? 0) + (movementQtyByName.get(codeKey) ?? 0);
      // Also sum by ref_id for each item ID in this group
      for (const id of item.allIds) {
        qty += movementQtyByRefId.get(id) ?? 0;
      }
      return { ...item, qty };
    });
  }, [groupedItems, movementQtyByCode, movementQtyByName, movementQtyByRefId]);

  // Filter items based on search, type, and category hierarchy
  const filteredItems = useMemo(() => {
    return groupedItemsWithQty.filter((item) => {
      // Type filter
      if (filterType === "inventory" && (item.is_service || item.is_inventory === false)) return false;
      if (filterType === "other" && (item.is_service || item.is_inventory !== false)) return false;
      if (filterType === "services" && !item.is_service) return false;

      // Category hierarchy filters
      if (filterCategory !== "all" && item.category !== filterCategory) return false;
      if (filterParentCategory !== "all" && item.parent_category !== filterParentCategory) return false;
      if (filterSubParentCategory !== "all" && item.sub_parent_category !== filterSubParentCategory) return false;
      if (filterSubCategory !== "all" && item.sub_category !== filterSubCategory) return false;

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
        (item.sub_parent_category && item.sub_parent_category.toLowerCase().includes(q)) ||
        (item.sub_category && item.sub_category.toLowerCase().includes(q))
      );
    });
  }, [groupedItemsWithQty, filterType, searchQuery, filterCategory, filterParentCategory, filterSubParentCategory, filterSubCategory]);

  // Unique category values for filter dropdowns
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    for (const item of groupedItemsWithQty) {
      if (item.category) set.add(item.category);
    }
    return Array.from(set).sort();
  }, [groupedItemsWithQty]);

  const uniqueParentCategories = useMemo(() => {
    const set = new Set<string>();
    for (const item of groupedItemsWithQty) {
      if (item.parent_category) set.add(item.parent_category);
    }
    return Array.from(set).sort();
  }, [groupedItemsWithQty]);

  const uniqueSubParentCategories = useMemo(() => {
    const set = new Set<string>();
    for (const item of groupedItemsWithQty) {
      if (item.sub_parent_category) set.add(item.sub_parent_category);
    }
    return Array.from(set).sort();
  }, [groupedItemsWithQty]);

  const uniqueSubCategories = useMemo(() => {
    const set = new Set<string>();
    for (const item of groupedItemsWithQty) {
      if (item.sub_category) set.add(item.sub_category);
    }
    return Array.from(set).sort();
  }, [groupedItemsWithQty]);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalSkus = groupedItemsWithQty.length;
    let totalQty = 0;
    let totalValuation = 0;
    let lowStockCount = 0;

    for (const item of groupedItemsWithQty) {
      if (!item.is_service) {
        totalQty += Number(item.qty || 0);
        totalValuation += Number(item.qty || 0) * Number(item.default_rate || 0);
        if (item.reorder_level > 0 && item.qty <= item.reorder_level) {
          lowStockCount++;
        }
      }
    }

    return { totalSkus, totalQty, totalValuation, lowStockCount };
  }, [groupedItemsWithQty]);

  // Category counts for tabs
  const categoryCounts = useMemo(() => {
    let inventoryCount = 0;
    let otherCount = 0;
    let servicesCount = 0;
    for (const item of groupedItemsWithQty) {
      if (item.is_service) {
        servicesCount++;
      } else if (item.is_inventory === false) {
        otherCount++;
      } else {
        inventoryCount++;
      }
    }
    return { inventoryCount, otherCount, servicesCount };
  }, [groupedItemsWithQty]);

  // Currently inspected item detail
  const activeDetailItem = useMemo(() => {
    if (!selectedItemCode) return null;
    return groupedItemsWithQty.find((i) => i.item_code.toUpperCase() === selectedItemCode.toUpperCase()) ?? null;
  }, [selectedItemCode, groupedItemsWithQty]);

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

    // 1. Process ALL movements (including those without lot numbers)
    for (const m of activeMovements) {
      const rawLot = m.lot_number?.trim();
      const lotKey = (rawLot || "NO-LOT").toUpperCase();
      const displayName = rawLot || "No Lot / General Stock";
      const baseQty = getBaseQty(m);
      const isOutward = m.type === "outward";

      // Use landing_cost for inward movements (includes transportation/other charges)
      const unitRate = isOutward 
        ? Number(m.per_unit || activeDetailItem.default_rate || 0)
        : Number(m.landing_cost || m.per_unit || activeDetailItem.default_rate || 0);

      if (!lotMap.has(lotKey)) {
        lotMap.set(lotKey, {
          lotNumber: displayName,
          expiryDate: m.expiry_date || "—",
          totalQty: isOutward ? -baseQty : baseQty,
          rate: unitRate,
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
          lot.rate = unitRate;
          if (m.expiry_date && lot.expiryDate === "—") {
            lot.expiryDate = m.expiry_date;
          }
        }
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
          <div className="flex gap-2">
            <Dialog open={openImportDialog} onOpenChange={(open) => { setOpenImportDialog(open); if (!open) setImportPreview(null); }}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  Import Opening Stocks
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Import Opening Stocks</DialogTitle>
                  <DialogDescription>
                    Upload a CSV file containing opening stock and item details.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs font-semibold">Step 1: Download Format Template</Label>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          const headers = [
                            "Item Code", "Item Name", "Unit", "HSN Code", "VAT Rate",
                            "Selling Price", "Category", "Parent Category", "Sub Parent Category",
                            "Sub Category", "Warehouse", "Status", "Alt UOM", "Alt UOM Conversion",
                            "Opening Qty", "Opening Rate", "Opening Value", "Lot Number", "Expiry Date"
                          ];
                          const sampleRow = [
                            "ITEM-001", "Example Item Name", "NOS", "8517", "13", "1500",
                            "Electronics", "Phones", "Smartphones", "Android", "Main Warehouse",
                            "Active", "BOX", "10", "50", "1000", "50000", "LOT-1029", "2027-12-31"
                          ];
                          const csvContent = [headers.join(","), sampleRow.join(",")].join("\n");
                          const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement("a");
                          link.setAttribute("href", url);
                          link.setAttribute("download", "opening_stock_import_template.csv");
                          link.style.visibility = "hidden";
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                      >
                        ↓ CSV Template
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        onClick={async () => {
                          const headers = [
                            "Item Code", "Item Name", "Unit", "HSN Code", "VAT Rate",
                            "Selling Price", "Category", "Parent Category", "Sub Parent Category",
                            "Sub Category", "Warehouse", "Status", "Alt UOM", "Alt UOM Conversion",
                            "Opening Qty", "Opening Rate", "Opening Value", "Lot Number", "Expiry Date"
                          ];
                          const sampleRow = [
                            "ITEM-001", "Example Item Name", "NOS", "8517", "13", "1500",
                            "Electronics", "Phones", "Smartphones", "Android", "Main Warehouse",
                            "Active", "BOX", "10", "50", "1000", "50000", "LOT-1029", "2027-12-31"
                          ];
                          const XLSX = await import("xlsx");
                          const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
                          const wb = XLSX.utils.book_new();
                          XLSX.utils.book_append_sheet(wb, ws, "Opening Stock");
                          XLSX.writeFile(wb, "opening_stock_import_template.xlsx");
                        }}
                      >
                        ↓ Excel Template
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 pt-2 border-t">
                    <Label className="text-xs font-semibold">Step 2: Upload Completed CSV or Excel</Label>
                    <Input
                      type="file"
                      accept=".csv, .xlsx, .xls"
                      disabled={previewing || importing}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setImportPreview(null);
                        setPreviewing(true);
                        const reader = new FileReader();
                        const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
                        reader.onload = async (evt) => {
                          try {
                            let rows: any[][] = [];
                            if (isExcel) {
                              const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                              const XLSX = await import("xlsx");
                              const workbook = XLSX.read(data, { type: "array" });
                              const sheet = workbook.Sheets[workbook.SheetNames[0]];
                              rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
                            } else {
                              const text = evt.target?.result as string;
                              if (!text) throw new Error("File empty");
                              const rawRows = text.split(/\r?\n/);
                              for (const rawRow of rawRows) {
                                if (!rawRow.trim()) continue;
                                const values: string[] = [];
                                let insideQuote = false;
                                let currentValue = "";
                                for (let i = 0; i < rawRow.length; i++) {
                                  const char = rawRow[i];
                                  if (char === '"') { insideQuote = !insideQuote; }
                                  else if (char === ',' && !insideQuote) { values.push(currentValue.trim()); currentValue = ""; }
                                  else { currentValue += char; }
                                }
                                values.push(currentValue.trim());
                                rows.push(values);
                              }
                            }
                            if (rows.length < 2) throw new Error("No data rows found in template");
                            const headers = rows[0].map(h => String(h || "").toLowerCase().replace(/\s+/g, ""));
                            const dataRows = rows.slice(1);
                            const getVal = (row: any[], colName: string) => {
                              const idx = headers.findIndex(h => h.includes(colName.replace(/\s+/g, "").toLowerCase()));
                              return idx !== -1 ? String(row[idx] ?? "").trim() : "";
                            };

                            // Get company
                            const { data: companies } = await supabase.from("companies").select("id").eq("is_default", true).limit(1);
                            const companyId = companies?.[0]?.id || (await supabase.from("companies").select("id").limit(1))?.data?.[0]?.id;
                            if (!companyId) throw new Error("Please configure a company first");

                            // Fetch existing item codes in one query
                            const itemCodes = dataRows.map(r => getVal(r, "itemcode")).filter(Boolean);
                            const { data: existingItems } = await supabase
                              .from("items")
                              .select("item_code")
                              .in("item_code", itemCodes);
                            const existingCodes = new Set((existingItems || []).map(i => i.item_code));

                            const newItems: any[] = [];
                            const existingItemsPrev: any[] = [];
                            for (const row of dataRows) {
                              const itemCode = getVal(row, "itemcode");
                              const itemName = getVal(row, "itemname");
                              if (!itemCode || !itemName) continue;
                              const openingQty = Number(getVal(row, "openingqty") || 0);
                              const openingRate = Number(getVal(row, "openingrate") || 0);
                              const openingValue = Number(getVal(row, "openingvalue") || (openingQty * openingRate));
                              const entry = { itemCode, itemName, openingQty, openingValue };
                              if (existingCodes.has(itemCode)) existingItemsPrev.push(entry);
                              else newItems.push(entry);
                            }
                            setImportPreview({ newItems, existingItems: existingItemsPrev, parsedRows: dataRows, headers, companyId });
                          } catch (err) {
                            toast.error((err as Error).message);
                          } finally {
                            setPreviewing(false);
                          }
                        };
                        if (isExcel) reader.readAsArrayBuffer(file);
                        else reader.readAsText(file);
                      }}
                    />
                    {previewing && <p className="text-xs text-muted-foreground animate-pulse">Analysing file…</p>}
                    {importPreview && (
                      <div className="rounded-lg border bg-muted/40 p-3 space-y-3 text-sm">
                        <div className="flex gap-4">
                          <div className="flex-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-2 text-center">
                            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{importPreview.newItems.length}</p>
                            <p className="text-xs text-emerald-600 dark:text-emerald-400">New Items</p>
                          </div>
                          <div className="flex-1 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-2 text-center">
                            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{importPreview.existingItems.length}</p>
                            <p className="text-xs text-amber-600 dark:text-amber-400">Existing (will update)</p>
                          </div>
                        </div>
                        {importPreview.newItems.length + importPreview.existingItems.length > 0 && (
                          <div className="max-h-36 overflow-y-auto rounded border text-xs">
                            <table className="w-full">
                              <thead className="sticky top-0 bg-muted">
                                <tr>
                                  <th className="text-left p-1 font-semibold">Code</th>
                                  <th className="text-left p-1 font-semibold">Name</th>
                                  <th className="text-right p-1 font-semibold">Qty</th>
                                  <th className="text-right p-1 font-semibold">Value</th>
                                  <th className="text-center p-1 font-semibold">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {[...importPreview.newItems.map(i => ({...i, isNew: true})), ...importPreview.existingItems.map(i => ({...i, isNew: false}))].map((item, idx) => (
                                  <tr key={idx} className={idx % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                                    <td className="p-1">{item.itemCode}</td>
                                    <td className="p-1 max-w-[100px] truncate">{item.itemName}</td>
                                    <td className="p-1 text-right">{item.openingQty}</td>
                                    <td className="p-1 text-right">{item.openingValue.toLocaleString()}</td>
                                    <td className="p-1 text-center">
                                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                        item.isNew ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                                      }`}>{item.isNew ? "NEW" : "UPDATE"}</span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <Button
                          className="w-full"
                          disabled={importing}
                          onClick={async () => {
                            setImporting(true);
                            try {
                              const { parsedRows, headers, companyId } = importPreview;
                              const getVal = (row: any[], colName: string) => {
                                const idx = headers.findIndex(h => h.includes(colName.replace(/\s+/g, "").toLowerCase()));
                                return idx !== -1 ? String(row[idx] ?? "").trim() : "";
                              };
                              let successCount = 0, errorCount = 0;
                              for (const row of parsedRows) {
                                try {
                                  const itemCode = getVal(row, "itemcode");
                                  const itemName = getVal(row, "itemname");
                                  if (!itemCode || !itemName) continue;
                                  const uom = getVal(row, "unit") || "NOS";
                                  const hsnCode = getVal(row, "hsncode") || null;
                                  const vatRate = Number(getVal(row, "vatrate") || 5);
                                  const sellingPrice = Number(getVal(row, "sellingprice") || 0);
                                  const category = getVal(row, "category") || null;
                                  const parentCategory = getVal(row, "parentcategory") || null;
                                  const subParentCategory = getVal(row, "subparentcategory") || null;
                                  const subCategory = getVal(row, "subcategory") || null;
                                  const warehouse = getVal(row, "warehouse") || "Main Warehouse";
                                  const status = getVal(row, "status") || "Active";
                                  const altUom = getVal(row, "altuom") || null;
                                  const altUomConversion = getVal(row, "altuomconversion") ? Number(getVal(row, "altuomconversion")) : null;
                                  const openingQty = Number(getVal(row, "openingqty") || 0);
                                  const openingRate = Number(getVal(row, "openingrate") || 0);
                                  const openingValue = Number(getVal(row, "openingvalue") || (openingQty * openingRate));
                                  const lotNumber = getVal(row, "lotnumber") || null;
                                  const expiryDate = getVal(row, "expirydate") || getVal(row, "expiry") || null;

                                  const { data: existingItem } = await supabase.from("items").select("id, qty").eq("item_code", itemCode).maybeSingle();
                                  let itemId = "";
                                  const itemPayload = {
                                    item_code: itemCode, item_name: itemName, uom, hsn_code: hsnCode,
                                    vat_rate: vatRate, selling_price: sellingPrice, category,
                                    parent_category: parentCategory, sub_parent_category: subParentCategory,
                                    sub_category: subCategory, warehouse, status, alt_uom: altUom,
                                    alt_uom_conversion: altUomConversion, opening_qty: openingQty,
                                    opening_rate: openingRate, opening_value: openingValue,
                                    qty: existingItem ? undefined : openingQty
                                  };
                                  if (existingItem) {
                                    itemId = existingItem.id;
                                    await supabase.from("items").update(itemPayload as never).eq("id", itemId);
                                  } else {
                                    const { data: newItem, error: insertErr } = await supabase.from("items").insert(itemPayload as never).select("id").single();
                                    if (insertErr) throw insertErr;
                                    itemId = newItem.id;
                                  }
                                  if (openingQty > 0) {
                                    let { data: bill } = await supabase.from("bills").select("id").eq("bill_number", "OPENING-STOCK").maybeSingle();
                                    if (!bill) {
                                      const { data: newBill } = await supabase.from("bills").insert({
                                        bill_type: "items", bill_number: "OPENING-STOCK",
                                        invoice_date: new Date().toISOString().slice(0, 10),
                                        status: "approved", company_id: companyId,
                                        final_amount: openingValue, taxable_amount: openingValue,
                                      } as never).select("id").single();
                                      if (newBill) bill = newBill;
                                    }
                                    if (bill) {
                                      const { data: existingLine } = await supabase.from("bill_lines").select("id").eq("bill_id", bill.id).eq("ref_id", itemId).maybeSingle();
                                      const linePayload = {
                                        bill_id: bill.id, ref_type: "item", ref_id: itemId,
                                        code: itemCode, name: itemName, uom,
                                        quantity: openingQty, per_unit: openingRate, line_amount: openingValue,
                                        lot_number: lotNumber, expiry_date: expiryDate,
                                      };
                                      if (existingLine) await supabase.from("bill_lines").update(linePayload as never).eq("id", existingLine.id);
                                      else await supabase.from("bill_lines").insert(linePayload as never);
                                    }
                                  }
                                  successCount++;
                                } catch (err) { console.error("Row import failed:", err); errorCount++; }
                              }
                              // Recalculate OPENING-STOCK total
                              const { data: bill } = await supabase.from("bills").select("id").eq("bill_number", "OPENING-STOCK").maybeSingle();
                              if (bill) {
                                const { data: lines } = await supabase.from("bill_lines").select("line_amount").eq("bill_id", bill.id);
                                const totalVal = (lines || []).reduce((sum, l) => sum + Number(l.line_amount || 0), 0);
                                await supabase.from("bills").update({ final_amount: totalVal, taxable_amount: totalVal } as never).eq("id", bill.id);
                              }
                              toast.success(`Import completed: ${successCount} saved, ${errorCount} failed`);
                              setImportPreview(null);
                              setOpenImportDialog(false);
                              qc.invalidateQueries({ queryKey: ["items"] });
                              qc.invalidateQueries({ queryKey: ["unified_movements"] });
                            } catch (err) {
                              toast.error((err as Error).message);
                            } finally {
                              setImporting(false);
                            }
                          }}
                        >
                          {importing ? "Importing…" : `Confirm & Import ${importPreview.newItems.length + importPreview.existingItems.length} Items`}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button onClick={() => { setEditingItem(null); setOpenNewDialog(true); }}>
              <Plus className="mr-1 h-4 w-4" /> Add Item
            </Button>
            <ItemFormDialog
              open={openNewDialog}
              onOpenChange={(v) => {
                setOpenNewDialog(v);
                if (!v) setEditingItem(null);
              }}
              initial={editingItem as unknown as Record<string, unknown> | undefined}
              onSaved={() => {
                setOpenNewDialog(false);
                setEditingItem(null);
                qc.invalidateQueries({ queryKey: ["items"] });
              }}
            />

          </div>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Inventory Items</CardTitle>
            <Boxes className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categoryCounts.inventoryCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Physical goods tracked in stock</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Other Items</CardTitle>
            <Package className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categoryCounts.otherCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Non-inventory consumables</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Services</CardTitle>
            <Boxes className="h-4 w-4 text-violet-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categoryCounts.servicesCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Service line items</p>
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
      </div>

      {/* Filter and Search Bar with UOM Mode Toggle */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                <TabsTrigger value="inventory">Inventory ({categoryCounts.inventoryCount})</TabsTrigger>
                <TabsTrigger value="other">Other Items ({categoryCounts.otherCount})</TabsTrigger>
                <TabsTrigger value="services">Services ({categoryCounts.servicesCount})</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Category Hierarchy Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Category Filters:</span>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            {uniqueCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={filterParentCategory}
            onChange={(e) => setFilterParentCategory(e.target.value)}
          >
            <option value="all">All Parent Categories</option>
            {uniqueParentCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={filterSubParentCategory}
            onChange={(e) => setFilterSubParentCategory(e.target.value)}
          >
            <option value="all">All Sub-Parent</option>
            {uniqueSubParentCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={filterSubCategory}
            onChange={(e) => setFilterSubCategory(e.target.value)}
          >
            <option value="all">All Sub-Categories</option>
            {uniqueSubCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {(filterCategory !== "all" || filterParentCategory !== "all" || filterSubParentCategory !== "all" || filterSubCategory !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setFilterCategory("all");
                setFilterParentCategory("all");
                setFilterSubParentCategory("all");
                setFilterSubCategory("all");
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Primary Material Register Table (Items) */}
      <div className="rounded-md border bg-card shadow-sm overflow-hidden">
        <Table className="min-w-[900px]">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[120px]">Item Code</TableHead>
              <TableHead className="min-w-[200px]">Item / Material Name</TableHead>
              <TableHead className="w-[90px]">UOM ({uomMode === "alt" ? "Alt" : "Main"})</TableHead>
              <TableHead className="w-[110px] text-right">Stock Qty</TableHead>
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
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  Loading Material Centre Register…
                </TableCell>
              </TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                  No items found. Click <b>Add Item</b> to register a new material.
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => {
                const isLowStock = item.reorder_level > 0 && item.qty <= item.reorder_level;
                const totalValue = Number(item.qty || 0) * Number(item.selling_price || item.default_rate || 0);

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
                        {item.is_service ? (
                          <span className="text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300 px-1.5 py-0.5 rounded font-medium">Service</span>
                        ) : item.is_inventory === false ? (
                          <span className="text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 px-1.5 py-0.5 rounded font-medium">Other Item</span>
                        ) : (
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 px-1.5 py-0.5 rounded font-medium">Inventory</span>
                        )}
                        {item.category ? (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                            {item.category}
                            {item.parent_category ? ` > ${item.parent_category}` : ""}
                            {item.sub_parent_category ? ` > ${item.sub_parent_category}` : ""}
                            {item.sub_category ? ` > ${item.sub_category}` : ""}
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
                    <TableCell className="text-right">{inr(item.selling_price)}</TableCell>
                    <TableCell className="text-right font-semibold">{inr(totalValue)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {item.warehouse || "Main"}
                      {item.rag_number && <div className="text-[10px] text-muted-foreground/70">{item.rag_number}</div>}
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
                  <span>Warehouse: <b>{activeDetailItem.warehouse || "Main"}</b> {activeDetailItem.rag_number ? `(${activeDetailItem.rag_number})` : ""}</span>
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
                    <Table className="min-w-[1100px]">
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
                          <TableHead className="w-[80px] text-right">Unit Rate</TableHead>
                          <TableHead className="w-[90px] text-right">Amount</TableHead>
                          <TableHead className="w-[90px] text-right">Landing Unit</TableHead>
                          <TableHead className="w-[90px] text-right">Sale Amount</TableHead>
                          <TableHead className="w-[90px] text-right">Running Qty</TableHead>
                          <TableHead className="w-[100px] text-right">Running Value</TableHead>
                          <TableHead className="w-[90px] text-right">Profit/Loss</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeMovements.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={15} className="py-6 text-center text-muted-foreground text-sm">
                              No stock movements recorded yet.
                            </TableCell>
                          </TableRow>
                        ) : (() => {
                          // Sort movements by date ascending for correct running calculation
                          const sortedMovements = [...activeMovements].sort(
                            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                          );
                          
                          // First pass: Build lot-wise landing cost map from inward movements
                          // and track lot quantities for specific identification
                          const lotLandingCostMap = new Map<string, number>(); // lot_number -> landing_cost_per_unit
                          const lotQtyMap = new Map<string, number>(); // lot_number -> remaining qty
                          
                          for (const m of sortedMovements) {
                            const lotKey = (m.lot_number || "").trim().toUpperCase();
                            const qty = Number(m.quantity || 0);
                            const costPerUnit = Number(m.landing_cost || m.per_unit || 0);
                            
                            if (m.type === "inward") {
                              // Store the landing cost for this lot
                              if (lotKey) {
                                lotLandingCostMap.set(lotKey, costPerUnit);
                                lotQtyMap.set(lotKey, (lotQtyMap.get(lotKey) || 0) + qty);
                              }
                            } else {
                              // For outward: reduce lot quantity
                              if (lotKey) {
                                lotQtyMap.set(lotKey, (lotQtyMap.get(lotKey) || 0) - qty);
                              }
                            }
                          }
                          
                          // Second pass: render with lot-specific landing costs
                          let displayRunningQty = 0;
                          let displayRunningValue = 0;
                          // Track running lot-wise quantities for display
                          const runningLotQty = new Map<string, number>();
                          
                          return sortedMovements.map((m) => {
                            const ageDays = calculateAge(m.created_at);
                            const isInward = m.type === "inward";
                            const qty = Number(m.quantity || 0);
                            const lotKey = (m.lot_number || "").trim().toUpperCase();
                            
                            // Get landing cost: use lot-specific cost from map
                            const lotLandingCost = lotLandingCostMap.get(lotKey) || 0;
                            let inwardLandingCost = Number(m.landing_cost || m.per_unit || 0);
                            
                            // For sales returns, use lot-specific cost or any lot's cost
                            // instead of selling price (sr.per_unit)
                            if (isInward && m.source === "sales_return") {
                              const anyLotCost = lotLandingCostMap.values().next().value || 0;
                              inwardLandingCost = lotLandingCost || anyLotCost || inwardLandingCost;
                            }
                            
                            // For display: use the lot's specific landing cost
                            const displayLandingUnit = isInward ? inwardLandingCost : (lotLandingCost || inwardLandingCost);
                            
                            // Calculate running totals
                            if (isInward) {
                              displayRunningQty += qty;
                              displayRunningValue += inwardLandingCost * qty;
                              runningLotQty.set(lotKey, (runningLotQty.get(lotKey) || 0) + qty);
                            } else {
                              displayRunningQty -= qty;
                              // Use lot-specific landing cost for outward
                              displayRunningValue -= displayLandingUnit * qty;
                              runningLotQty.set(lotKey, (runningLotQty.get(lotKey) || 0) - qty);
                            }
                            
                            // Sale amount for outward (per_unit * qty)
                            const saleAmount = isInward ? 0 : Number(m.per_unit || 0) * qty;
                            // Landing total cost for outward (using lot-specific cost)
                            const landingTotalCost = isInward ? 0 : displayLandingUnit * qty;
                            // Profit/Loss = Sale Amount - Landing Cost for outward
                            const profitLoss = isInward ? 0 : saleAmount - landingTotalCost;

                            return (
                              <TableRow key={m.id}>
                                <TableCell>
                                  <Badge
                                    variant={isInward ? "default" : "outline"}
                                    className={isInward ? "bg-emerald-600 text-white text-[10px]" : "border-blue-500 text-blue-600 text-[10px]"}
                                  >
                                    {isInward ? "Inward" : "Outward"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs">{formatDate(m.date, dateFormat)}</TableCell>
                                <TableCell className="font-medium text-xs font-mono">{m.docNumber}</TableCell>
                                <TableCell className="text-xs font-medium">{m.partyName}</TableCell>
                                <TableCell className="font-mono text-xs">{m.lot_number || "—"}</TableCell>
                                <TableCell className="text-xs">{formatDate(m.expiry_date || null, dateFormat)}</TableCell>
                                <TableCell className="text-xs">
                                  {ageDays !== null ? (
                                    <Badge variant="secondary" className="text-[10px]">
                                      {ageDays}d
                                    </Badge>
                                  ) : (
                                    "—"
                                  )}
                                </TableCell>
                                <TableCell className={`text-right font-medium font-mono ${isInward ? "text-emerald-600" : "text-blue-600"}`}>
                                  {isInward ? `+${num(qty)}` : `-${num(qty)}`}{" "}
                                  <span className="text-[10px] font-normal text-muted-foreground">{m.uom || "NOS"}</span>
                                </TableCell>
                                <TableCell className="text-right text-xs">{inr(m.per_unit)}</TableCell>
                                <TableCell className="text-right font-semibold text-xs">{inr(Number(m.line_amount || 0))}</TableCell>
                                <TableCell className="text-right text-xs font-mono font-semibold text-primary">{inr(displayLandingUnit)}</TableCell>
                                <TableCell className={`text-right text-xs font-medium ${isInward ? "text-muted-foreground" : "text-blue-600"}`}>
                                  {isInward ? "—" : inr(saleAmount)}
                                </TableCell>
                                <TableCell className={`text-right text-xs font-mono ${displayRunningQty >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                  {num(displayRunningQty)} <span className="text-[9px] text-muted-foreground">{m.uom || "NOS"}</span>
                                </TableCell>
                                <TableCell className="text-right text-xs font-semibold">{inr(displayRunningValue)}</TableCell>
                                <TableCell className={`text-right text-xs font-bold ${profitLoss > 0 ? "text-emerald-600" : profitLoss < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                                  {isInward ? "—" : (profitLoss >= 0 ? "+" : "") + inr(profitLoss)}
                                </TableCell>
                              </TableRow>
                            );
                          });
                        })()}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Final Closing Balance Summary Section */}
                  {(() => {
                    // Compute closing qty and value from movements (FIFO order)
                    const sortedMovements = [...activeMovements].sort(
                      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                    );

                    let closingQty = 0;
                    let closingValue = 0;
                    // Track lot-specific landing costs for FIFO outward valuation
                    const lotCostMap = new Map<string, number>(); // lot -> latest landing cost per unit
                    // Pool of stock: ordered list of {qty, cost} for FIFO consumption
                    const stockPool: Array<{ qty: number; cost: number }> = [];

                    for (const m of sortedMovements) {
                      const qty = Number(m.quantity || 0);
                      const lotKey = (m.lot_number || "").trim().toUpperCase();
                      const rawCostPerUnit = Number(m.landing_cost || m.per_unit || 0);

                      // For sales returns (inward), use lot-specific cost or current avg cost
                      // instead of selling price (sr.per_unit) which is not the purchase cost
                      let costPerUnit = rawCostPerUnit;
                      if (m.type === "inward" && m.source === "sales_return") {
                        // Try matching lot first, then use any lot's cost, then avg of pool
                        const lotCost = lotCostMap.get(lotKey);
                        const anyLotCost = lotCostMap.values().next().value;
                        const poolAvg = stockPool.length > 0
                          ? stockPool.reduce((sum, p) => sum + p.cost * p.qty, 0) / stockPool.reduce((sum, p) => sum + p.qty, 0)
                          : 0;
                        costPerUnit = lotCost || anyLotCost || poolAvg || rawCostPerUnit;
                      }

                      if (m.type === "inward") {
                        // Add to pool (FIFO: append to end)
                        stockPool.push({ qty, cost: costPerUnit });
                        lotCostMap.set(lotKey, costPerUnit);
                        closingQty += qty;
                        closingValue += costPerUnit * qty;
                      } else {
                        // Outward: consume from earliest lots in pool (FIFO)
                        let remaining = qty;
                        let outwardValue = 0;
                        while (remaining > 0 && stockPool.length > 0) {
                          const earliest = stockPool[0];
                          const take = Math.min(remaining, earliest.qty);
                          outwardValue += take * earliest.cost;
                          earliest.qty -= take;
                          remaining -= take;
                          if (earliest.qty <= 0) stockPool.shift();
                        }
                        // If pool exhausted but still have outward qty, use available lot cost
                        if (remaining > 0) {
                          const fallbackCost = lotCostMap.get(lotKey) || costPerUnit;
                          outwardValue += remaining * fallbackCost;
                        }
                        closingQty -= qty;
                        closingValue -= outwardValue;
                      }
                    }

                    const avgLandingCost = closingQty > 0 ? closingValue / closingQty : 0;
                    
                    return (
                      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-4">
                        <div className="flex items-center justify-between border-b border-primary/20 pb-3">
                          <div>
                            <h4 className="font-semibold text-sm text-foreground">Final Closing Stock Summary</h4>
                            <p className="text-xs text-muted-foreground">Current physical stock in material centre based on movements</p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-muted-foreground block">Closing Valuation (Landing Cost)</span>
                            <span className="text-xl font-bold text-primary">
                              {inr(closingValue)}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="rounded-md bg-background p-3 border">
                            <span className="text-xs text-muted-foreground block">Final Closing Quantity</span>
                            <span className="text-2xl font-bold text-foreground">
                              {num(closingQty)} <span className="text-sm font-medium text-muted-foreground">{activeDetailItem.uom}</span>
                            </span>
                          </div>
                          <div className="rounded-md bg-background p-3 border">
                            <span className="text-xs text-muted-foreground block">Avg Landing Cost/Unit</span>
                            <span className="text-2xl font-bold text-foreground">
                              {inr(avgLandingCost)}
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
                                <TableHead className="text-xs text-right">Landing Cost/Unit</TableHead>
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
                                       <TableCell className="text-xs">{formatDate(lot.expiryDate, dateFormat)}</TableCell>
                                      <TableCell>{getExpiryBadge(lot.expiryDate)}</TableCell>
                                      <TableCell className="text-right font-mono font-semibold text-xs text-primary">
                                        {num(lotQty)} {lotUom}
                                      </TableCell>
                                      <TableCell className="text-right text-xs font-mono">{inr(lot.rate)}</TableCell>
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
                    );
                  })()}
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
                      <span className="text-xs text-muted-foreground">Sub-Category</span>
                      <p className="font-medium">{activeDetailItem.sub_category || "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Warehouse</span>
                      <p className="font-medium">{activeDetailItem.warehouse || "Main"}</p>
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
