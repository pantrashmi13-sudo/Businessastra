import { useState, useMemo, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/use-company";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Pencil,
  Trash2,
  Building2,
  MapPin,
  User,
  ArrowRightLeft,
  Package,
  Search,
  X,
  Save,
  Loader2,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { inr, num } from "@/lib/format";
import { nextDocNumber } from "@/lib/voucher-number";

export const Route = createFileRoute("/masters/warehouses")({
  component: WarehousesPage,
});

/* ── Interfaces ─────────────────────────────────────────────── */

interface Warehouse {
  id: string;
  company_id: string;
  name: string;
  location?: string | null;
  incharge_person?: string | null;
  is_main?: boolean;
  created_at?: string;
}

interface WarehouseRag {
  id: string;
  warehouse_id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  capacity?: number | null;
  created_at?: string;
}

interface WarehouseItem {
  id: string;
  item_code: string;
  item_name: string;
  uom: string;
  qty: number;
  default_rate: number;
  selling_price: number;
  rag_number?: string | null;
  rag_id?: string | null;
  warehouse_id?: string | null;
  status?: string;
  is_inventory?: boolean;
  is_service?: boolean;
}

interface WarehouseFormState {
  name: string;
  location: string;
  incharge_person: string;
  is_main: boolean;
}

interface RagFormState {
  name: string;
  code: string;
  description: string;
  capacity: string;
}

interface TransferLine {
  itemId: string;
  itemName: string;
  uom: string;
  availableQty: number;
  quantity: number;
  fromRagId: string;
  toRagId: string;
}

/* ── Helpers ────────────────────────────────────────────────── */

const emptyWarehouseForm = (): WarehouseFormState => ({
  name: "",
  location: "",
  incharge_person: "",
  is_main: false,
});

const emptyRagForm = (): RagFormState => ({
  name: "",
  code: "",
  description: "",
  capacity: "",
});

/* ── Main Component ─────────────────────────────────────────── */

function WarehousesPage() {
  const qc = useQueryClient();
  const { company } = useCompany();
  const companyId = company?.id;

  /* ── List state ─────────────────────────────────────────── */
  const [search, setSearch] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [form, setForm] = useState<WarehouseFormState>(emptyWarehouseForm());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  /* ── Sheet state ────────────────────────────────────────── */
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [sheetTab, setSheetTab] = useState("rags");

  /* ── RAG state ──────────────────────────────────────────── */
  const [ragFormOpen, setRagFormOpen] = useState(false);
  const [editingRag, setEditingRag] = useState<WarehouseRag | null>(null);
  const [ragForm, setRagForm] = useState<RagFormState>(emptyRagForm());
  const [confirmDeleteRag, setConfirmDeleteRag] = useState<string | null>(null);

  /* ── Transfer state ─────────────────────────────────────── */
  const [transferToWarehouse, setTransferToWarehouse] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [transferNotes, setTransferNotes] = useState("");
  const [transferLines, setTransferLines] = useState<TransferLine[]>([]);
  const [transferItemSearch, setTransferItemSearch] = useState("");
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  /* ── Queries ────────────────────────────────────────────── */

  const { data: warehouses = [], isLoading } = useQuery({
    queryKey: ["warehouses", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("warehouses")
        .select("*")
        .eq("company_id", companyId)
        .order("name");
      if (error) throw error;
      return data as Warehouse[];
    },
    enabled: !!companyId,
  });

  const { data: rags = [], isLoading: ragsLoading } = useQuery({
    queryKey: ["warehouse_rags", selectedWarehouse?.id],
    queryFn: async () => {
      if (!selectedWarehouse?.id) return [];
      const { data, error } = await supabase
        .from("warehouse_rags")
        .select("*")
        .eq("warehouse_id", selectedWarehouse.id)
        .order("name");
      if (error) throw error;
      return data as WarehouseRag[];
    },
    enabled: !!selectedWarehouse?.id && sheetTab === "rags",
  });

  const { data: warehouseItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["warehouse_items", selectedWarehouse?.id],
    queryFn: async () => {
      if (!selectedWarehouse?.id) return [];
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("warehouse_id", selectedWarehouse.id)
        .order("item_code");
      if (error) throw error;
      return (data ?? []) as WarehouseItem[];
    },
    enabled: !!selectedWarehouse?.id && sheetTab === "inventory",
  });

  const { data: allItems = [] } = useQuery({
    queryKey: ["items", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("id, item_code, item_name, uom, qty, warehouse_id, is_inventory, is_service")
        .order("item_code");
      if (error) throw error;
      return (data ?? []) as WarehouseItem[];
    },
    enabled: sheetTab === "transfer" && !!selectedWarehouse?.id,
  });

  /* ── Filtered warehouse list ────────────────────────────── */

  const filtered = useMemo(() => {
    if (!search.trim()) return warehouses;
    const q = search.toLowerCase();
    return warehouses.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        (w.location ?? "").toLowerCase().includes(q) ||
        (w.incharge_person ?? "").toLowerCase().includes(q),
    );
  }, [warehouses, search]);

  /* ── Warehouse CRUD ─────────────────────────────────────── */

  const saveWarehouse = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Warehouse name is required");
      if (!companyId) throw new Error("No company selected");

      // Check for duplicate warehouse name (excluding current if editing)
      const { data: existing } = await supabase
        .from("warehouses")
        .select("id")
        .eq("company_id", companyId)
        .ilike("name", form.name.trim())
        .neq("id", editing?.id ?? "00000000-0000-0000-0000-000000000000");
      if (existing && existing.length > 0) {
        throw new Error(`A warehouse with the name "${form.name.trim()}" already exists`);
      }

      const payload = {
        name: form.name.trim(),
        location: form.location.trim() || null,
        incharge_person: form.incharge_person.trim() || null,
        company_id: companyId,
        // is_main is system-managed (set during company creation) — never changed via this form
      };
      if (editing?.id) {
        const { error } = await supabase.from("warehouses").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("warehouses").insert({ ...payload, is_main: false });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Warehouse updated" : "Warehouse created");
      qc.invalidateQueries({ queryKey: ["warehouses"] });
      setOpenNew(false);
      setEditing(null);
      setForm(emptyWarehouseForm());
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteWarehouse = useMutation({
    mutationFn: async (id: string) => {
      const target = warehouses.find((w) => w.id === id);
      if (target?.is_main) throw new Error("Cannot delete the main warehouse. Set another warehouse as main first.");
      const { error } = await supabase.from("warehouses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Warehouse deleted");
      qc.invalidateQueries({ queryKey: ["warehouses"] });
      setConfirmDelete(null);
      setSelectedWarehouse(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  /* ── RAG CRUD ───────────────────────────────────────────── */

  const saveRag = useMutation({
    mutationFn: async () => {
      if (!ragForm.name.trim()) throw new Error("RAG name is required");
      if (!selectedWarehouse?.id) throw new Error("No warehouse selected");
      const payload = {
        warehouse_id: selectedWarehouse.id,
        name: ragForm.name.trim(),
        code: ragForm.code.trim() || null,
        description: ragForm.description.trim() || null,
        capacity: ragForm.capacity ? Number(ragForm.capacity) : null,
      };
      if (editingRag?.id) {
        const { error } = await supabase
          .from("warehouse_rags")
          .update(payload)
          .eq("id", editingRag.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("warehouse_rags").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingRag ? "RAG updated" : "RAG created");
      qc.invalidateQueries({ queryKey: ["warehouse_rags"] });
      setRagFormOpen(false);
      setEditingRag(null);
      setRagForm(emptyRagForm());
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteRag = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("warehouse_rags").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("RAG deleted");
      qc.invalidateQueries({ queryKey: ["warehouse_rags"] });
      setConfirmDeleteRag(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  /* ── Transfer items for this warehouse ──────────────────── */

  const transferableItems = useMemo(() => {
    if (!selectedWarehouse?.id) return [];
    return allItems.filter(
      (item) =>
        item.warehouse_id === selectedWarehouse.id &&
        item.is_inventory !== false &&
        !item.is_service &&
        Number(item.qty || 0) > 0,
    );
  }, [allItems, selectedWarehouse]);

  const filteredTransferItems = useMemo(() => {
    if (!transferItemSearch.trim()) return transferableItems;
    const q = transferItemSearch.toLowerCase();
    return transferableItems.filter(
      (item) =>
        item.item_code.toLowerCase().includes(q) || item.item_name.toLowerCase().includes(q),
    );
  }, [transferableItems, transferItemSearch]);

  const addTransferLine = useCallback(
    (item: WarehouseItem) => {
      if (transferLines.some((l) => l.itemId === item.id)) return;
      setTransferLines((prev) => [
        ...prev,
        {
          itemId: item.id,
          itemName: item.item_name,
          uom: item.uom,
          availableQty: Number(item.qty || 0),
          quantity: 0,
          fromRagId: "",
          toRagId: "",
        },
      ]);
      setTransferItemSearch("");
    },
    [transferLines],
  );

  const updateTransferLine = useCallback(
    (itemId: string, field: keyof TransferLine, value: string | number) => {
      setTransferLines((prev) =>
        prev.map((l) => (l.itemId === itemId ? { ...l, [field]: value } : l)),
      );
    },
    [],
  );

  const removeTransferLine = useCallback((itemId: string) => {
    setTransferLines((prev) => prev.filter((l) => l.itemId !== itemId));
  }, []);

  const submitTransfer = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company selected");
      if (!selectedWarehouse?.id) throw new Error("No source warehouse");
      if (!transferToWarehouse) throw new Error("Select a destination warehouse");
      if (transferToWarehouse === selectedWarehouse.id)
        throw new Error("Source and destination must be different");
      const validLines = transferLines.filter((l) => l.quantity > 0);
      if (validLines.length === 0) throw new Error("Add at least one item with quantity > 0");

      for (const line of validLines) {
        if (line.quantity > line.availableQty) {
          throw new Error(
            `${line.itemName}: quantity (${line.quantity}) exceeds available (${line.availableQty})`,
          );
        }
      }

      const transferNumber = await nextDocNumber(
        "TRF",
        "stock_transfers",
        "transfer_number",
        companyId,
      );

      const { data: transfer, error: tErr } = await supabase
        .from("stock_transfers")
        .insert({
          transfer_number: transferNumber,
          from_warehouse_id: selectedWarehouse.id,
          to_warehouse_id: transferToWarehouse,
          transfer_date: transferDate,
          status: "completed",
          notes: transferNotes.trim() || null,
          company_id: companyId,
        })
        .select("id")
        .single();
      if (tErr) throw tErr;

      const linesPayload = validLines.map((l) => ({
        transfer_id: transfer.id,
        item_id: l.itemId,
        quantity: l.quantity,
        from_rag_id: l.fromRagId || null,
        to_rag_id: l.toRagId || null,
      }));
      const { error: lErr } = await supabase.from("stock_transfer_lines").insert(linesPayload);
      if (lErr) throw lErr;

      // Create stock_ledger entries: outward from source, inward to destination
      const fromWhName = warehouses.find((w) => w.id === selectedWarehouse.id)?.name || "Source";
      const toWhName = warehouses.find((w) => w.id === transferToWarehouse)?.name || "Destination";

      for (const line of validLines) {
        const item = allItems.find((i) => i.id === line.itemId);
        const uom = item?.uom || "NOS";

        // Outward from source warehouse
        await supabase.from("stock_ledger" as never).insert({
          item_id: line.itemId,
          movement_type: "outward",
          doc_type: "transfer",
          doc_id: transfer.id,
          doc_number: transferNumber,
          party_name: `Transfer to ${toWhName}`,
          quantity: line.quantity,
          uom,
          unit_rate: 0,
          line_amount: 0,
          company_id: companyId,
          warehouse_id: selectedWarehouse.id,
        } as never);

        // Inward to destination warehouse
        await supabase.from("stock_ledger" as never).insert({
          item_id: line.itemId,
          movement_type: "inward",
          doc_type: "transfer",
          doc_id: transfer.id,
          doc_number: transferNumber,
          party_name: `Transfer from ${fromWhName}`,
          quantity: line.quantity,
          uom,
          unit_rate: 0,
          line_amount: 0,
          company_id: companyId,
          warehouse_id: transferToWarehouse,
        } as never);
      }
    },
    onSuccess: () => {
      toast.success("Stock transfer completed");
      qc.invalidateQueries({ queryKey: ["warehouse_items"] });
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["unified_movements"] });
      setTransferLines([]);
      setTransferToWarehouse("");
      setTransferNotes("");
      setTransferDate(new Date().toISOString().slice(0, 10));
    },
    onError: (e) => toast.error((e as Error).message),
  });

  /* ── Handlers ────────────────────────────────────────────── */

  const openWarehouseSheet = (w: Warehouse) => {
    setSelectedWarehouse(w);
    setSheetTab("rags");
    setTransferLines([]);
    setTransferToWarehouse("");
    setTransferNotes("");
  };

  const openEditWarehouse = (w: Warehouse) => {
    setEditing(w);
    setForm({
      name: w.name,
      location: w.location ?? "",
      incharge_person: w.incharge_person ?? "",
      is_main: w.is_main ?? false,
    });
    setOpenNew(true);
  };

  const openEditRag = (r: WarehouseRag) => {
    setEditingRag(r);
    setRagForm({
      name: r.name,
      code: r.code ?? "",
      description: r.description ?? "",
      capacity: r.capacity?.toString() ?? "",
    });
    setRagFormOpen(true);
  };

  const openNewRag = () => {
    setEditingRag(null);
    setRagForm(emptyRagForm());
    setRagFormOpen(true);
  };

  /* ── Render ──────────────────────────────────────────────── */

  return (
    <>
      <PageHeader
        title="Warehouses"
        description="Manage locations where your inventory is stored."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setForm(emptyWarehouseForm());
              setOpenNew(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> New Warehouse
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        <Input
          placeholder="Search by name, location, incharge…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Warehouse Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Incharge Person</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    <Building2 className="mx-auto h-8 w-8 mb-2 opacity-30" />
                    No warehouses yet. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((w) => (
                  <TableRow
                    key={w.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => openWarehouseSheet(w)}
                  >
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        {w.name}
                        {w.is_main && (
                          <Badge className="text-[10px] py-0 px-1.5 bg-amber-100 text-amber-700 border-amber-300">
                            <Star className="h-2.5 w-2.5 mr-0.5 fill-amber-500 text-amber-500" />
                            Main
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {w.location ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {w.incharge_person ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => openEditWarehouse(w)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          disabled={!!w.is_main}
                          title={w.is_main ? "Cannot delete the main warehouse" : "Delete"}
                          onClick={() => setConfirmDelete(w.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Warehouse Create / Edit Dialog ──────────────────── */}
      <Dialog
        open={openNew}
        onOpenChange={(v) => {
          setOpenNew(v);
          if (!v) {
            setEditing(null);
            setForm(emptyWarehouseForm());
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Warehouse" : "New Warehouse"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Warehouse Name *</Label>
              <Input
                placeholder="e.g. Main Warehouse"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Location</Label>
              <Input
                placeholder="e.g. Block A, Ground Floor"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Incharge Person</Label>
              <Input
                placeholder="e.g. Ram Bahadur"
                value={form.incharge_person}
                onChange={(e) => setForm((f) => ({ ...f, incharge_person: e.target.value }))}
              />
            </div>
            {editing?.is_main && (
              <div className="flex items-center gap-3 rounded-md border p-3 bg-amber-50">
                <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-700">This is the Main Warehouse</p>
                  <p className="text-xs text-muted-foreground">The main warehouse is pre-configured and cannot be changed</p>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpenNew(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveWarehouse.mutate()} disabled={saveWarehouse.isPending}>
              {saveWarehouse.isPending ? "Saving…" : editing ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Warehouse Confirm ────────────────────────── */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Warehouse?</AlertDialogTitle>
            <AlertDialogDescription>
              This will unlink all items and stock records from this warehouse. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDelete && deleteWarehouse.mutate(confirmDelete)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Warehouse Detail Sheet ──────────────────────────── */}
      <Sheet open={!!selectedWarehouse} onOpenChange={(v) => !v && setSelectedWarehouse(null)}>
        <SheetContent side="right" className="w-[90vw] sm:max-w-2xl overflow-y-auto p-0">
          {selectedWarehouse && (
            <div className="flex flex-col h-full">
              {/* Sheet Header */}
              <SheetHeader className="p-6 pb-4 border-b">
                <div className="flex items-start justify-between">
                  <div>
                    <SheetTitle className="text-xl">{selectedWarehouse.name}</SheetTitle>
                    <SheetDescription className="flex items-center gap-3 mt-1 text-sm">
                      {selectedWarehouse.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {selectedWarehouse.location}
                        </span>
                      )}
                      {selectedWarehouse.incharge_person && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" /> {selectedWarehouse.incharge_person}
                        </span>
                      )}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              {/* Tabs */}
              <Tabs value={sheetTab} onValueChange={setSheetTab} className="flex-1 flex flex-col">
                <div className="px-6 pt-4">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="rags" className="text-xs">
                      <MapPin className="mr-1 h-3.5 w-3.5" /> RAG Locations
                    </TabsTrigger>
                    <TabsTrigger value="inventory" className="text-xs">
                      <Package className="mr-1 h-3.5 w-3.5" /> Inventory
                    </TabsTrigger>
                    <TabsTrigger value="transfer" className="text-xs">
                      <ArrowRightLeft className="mr-1 h-3.5 w-3.5" /> Transfer
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* ── Tab: RAG Locations ──────────────────────── */}
                <TabsContent value="rags" className="flex-1 overflow-auto p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">RAG Locations</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Rack, Aisle, Grid positions within this warehouse (optional)
                      </p>
                    </div>
                    <Button size="sm" onClick={openNewRag}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add RAG
                    </Button>
                  </div>

                  {ragsLoading ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">Loading…</div>
                  ) : rags.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <MapPin className="mx-auto h-8 w-8 mb-2 opacity-30" />
                      <p className="text-sm">No RAG locations defined yet.</p>
                      <p className="text-xs mt-1">
                        Add RAGs to organize items by physical location.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-md border overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Code</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Capacity</TableHead>
                            <TableHead className="w-[80px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rags.map((rag) => (
                            <TableRow key={rag.id}>
                              <TableCell className="font-medium">{rag.name}</TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {rag.code || "—"}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                                {rag.description || "—"}
                              </TableCell>
                              <TableCell className="text-right text-xs">
                                {rag.capacity != null ? rag.capacity : "—"}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => openEditRag(rag)}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-destructive"
                                    onClick={() => setConfirmDeleteRag(rag.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>

                {/* ── Tab: Inventory Register ─────────────────── */}
                <TabsContent value="inventory" className="flex-1 overflow-auto p-6 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold">Inventory Register</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Items stored in {selectedWarehouse.name}
                    </p>
                  </div>

                  {itemsLoading ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">Loading…</div>
                  ) : warehouseItems.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Package className="mx-auto h-8 w-8 mb-2 opacity-30" />
                      <p className="text-sm">No items in this warehouse.</p>
                      <p className="text-xs mt-1">
                        Assign items to this warehouse from the Items master.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-md border overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead>Item Code</TableHead>
                            <TableHead>Item Name</TableHead>
                            <TableHead>UOM</TableHead>
                            <TableHead>RAG</TableHead>
                            <TableHead className="text-right">Stock Qty</TableHead>
                            <TableHead className="text-right">Value</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {warehouseItems.map((item) => {
                            const totalValue =
                              Number(item.qty || 0) * Number(item.default_rate || 0);
                            return (
                              <TableRow key={item.id}>
                                <TableCell className="font-semibold text-primary font-mono text-xs">
                                  {item.item_code}
                                </TableCell>
                                <TableCell>
                                  <div className="font-medium text-sm">{item.item_name}</div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="font-mono text-xs">
                                    {item.uom || "NOS"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {item.rag_number || "—"}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {num(item.qty)}
                                </TableCell>
                                <TableCell className="text-right text-xs">
                                  {inr(totalValue)}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={item.status === "Inactive" ? "secondary" : "default"}
                                  >
                                    {item.status || "Active"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>

                {/* ── Tab: Transfer ───────────────────────────── */}
                <TabsContent value="transfer" className="flex-1 overflow-auto p-6 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold">Transfer Stock</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Move items from {selectedWarehouse.name} to another warehouse
                    </p>
                  </div>

                  {/* Transfer Header Fields */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">
                        From Warehouse
                      </Label>
                      <Input value={selectedWarehouse.name} disabled className="bg-muted/50" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">
                        To Warehouse *
                      </Label>
                      <Select value={transferToWarehouse} onValueChange={setTransferToWarehouse}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select destination" />
                        </SelectTrigger>
                        <SelectContent>
                          {warehouses
                            .filter((w) => w.id !== selectedWarehouse.id)
                            .map((w) => (
                              <SelectItem key={w.id} value={w.id}>
                                {w.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">
                        Transfer Date
                      </Label>
                      <Input
                        type="date"
                        value={transferDate}
                        onChange={(e) => setTransferDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
                      <Input
                        placeholder="Optional notes"
                        value={transferNotes}
                        onChange={(e) => setTransferNotes(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Add Items */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Add Items to Transfer
                    </Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search items by code or name…"
                        value={transferItemSearch}
                        onChange={(e) => setTransferItemSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {transferItemSearch && filteredTransferItems.length > 0 && (
                      <div className="rounded-md border bg-popover max-h-40 overflow-y-auto">
                        {filteredTransferItems.slice(0, 10).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between"
                            onClick={() => addTransferLine(item)}
                          >
                            <span>
                              <span className="font-mono text-xs text-primary mr-2">
                                {item.item_code}
                              </span>
                              {item.item_name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Qty: {num(item.qty)} {item.uom}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Transfer Lines */}
                  {transferLines.length > 0 ? (
                    <div className="rounded-md border overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead className="text-right">Available</TableHead>
                            <TableHead className="w-[100px]">Qty to Transfer</TableHead>
                            <TableHead className="w-[80px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transferLines.map((line) => (
                            <TableRow key={line.itemId}>
                              <TableCell>
                                <div className="text-sm font-medium">{line.itemName}</div>
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  {line.uom}
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {num(line.availableQty)}
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={line.quantity || ""}
                                  onChange={(e) =>
                                    updateTransferLine(
                                      line.itemId,
                                      "quantity",
                                      Number(e.target.value),
                                    )
                                  }
                                  className="h-8 text-xs"
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive"
                                  onClick={() => removeTransferLine(line.itemId)}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-xs">
                      Search and add items above to start a transfer.
                    </div>
                  )}

                  {/* Submit */}
                  {transferLines.length > 0 && (
                    <div className="flex justify-end pt-2 border-t">
                      <Button
                        onClick={() => submitTransfer.mutate()}
                        disabled={submitTransfer.isPending || !transferToWarehouse}
                      >
                        {submitTransfer.isPending ? (
                          <>
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Processing…
                          </>
                        ) : (
                          <>
                            <ArrowRightLeft className="mr-1 h-4 w-4" /> Complete Transfer
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── RAG Create / Edit Dialog ───────────────────────── */}
      <Dialog
        open={ragFormOpen}
        onOpenChange={(v) => {
          setRagFormOpen(v);
          if (!v) {
            setEditingRag(null);
            setRagForm(emptyRagForm());
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingRag ? "Edit RAG Location" : "New RAG Location"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>RAG Name *</Label>
              <Input
                placeholder="e.g. Rack A, Row 2"
                value={ragForm.name}
                onChange={(e) => setRagForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Code</Label>
              <Input
                placeholder="e.g. A-2"
                value={ragForm.code}
                onChange={(e) => setRagForm((f) => ({ ...f, code: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input
                placeholder="Optional description"
                value={ragForm.description}
                onChange={(e) => setRagForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Capacity</Label>
              <Input
                type="number"
                min="0"
                placeholder="Max items (optional)"
                value={ragForm.capacity}
                onChange={(e) => setRagForm((f) => ({ ...f, capacity: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setRagFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveRag.mutate()} disabled={saveRag.isPending}>
              {saveRag.isPending ? "Saving…" : editingRag ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete RAG Confirm ─────────────────────────────── */}
      <AlertDialog open={!!confirmDeleteRag} onOpenChange={(v) => !v && setConfirmDeleteRag(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete RAG Location?</AlertDialogTitle>
            <AlertDialogDescription>
              Items assigned to this RAG will have their RAG reference cleared. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteRag && deleteRag.mutate(confirmDeleteRag)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
