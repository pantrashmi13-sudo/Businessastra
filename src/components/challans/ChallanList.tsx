import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Truck, Eye, Trash2, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { inr, num } from "@/lib/format";
import { formatDate } from "@/lib/date-conversion";
import { useDateFormat } from "@/hooks/use-date-format";

interface DeliveryChallanRecord {
  id: string;
  challan_number: string;
  challan_date: string;
  po_reference?: string | null;
  delivery_address?: string | null;
  vehicle_number?: string | null;
  driver_contact?: string | null;
  total_amount: number;
  status: "draft" | "dispatched" | "delivered" | "cancelled";
  notes?: string | null;
  dispatched_at?: string;
  customer?: {
    name: string;
    vat_number?: string | null;
    phone?: string | null;
  } | null;
}

export function ChallanList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const dateFormat = useDateFormat();

  const challansQuery = useQuery({
    queryKey: ["delivery_challans", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_challans" as any)
        .select(`
          id, challan_number, challan_date, po_reference, delivery_address,
          vehicle_number, driver_contact, total_amount, status, notes, dispatched_at,
          customers(name, vat_number, phone)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        ...row,
        customer: row.customers,
      })) as DeliveryChallanRecord[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("delivery_challans" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Delivery Challan deleted");
      qc.invalidateQueries({ queryKey: ["delivery_challans"] });
      setConfirmDeleteId(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const filteredChallans = useMemo(() => {
    const list = challansQuery.data ?? [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (c) =>
        c.challan_number.toLowerCase().includes(q) ||
        (c.customer?.name && c.customer.name.toLowerCase().includes(q)) ||
        (c.po_reference && c.po_reference.toLowerCase().includes(q)) ||
        (c.vehicle_number && c.vehicle_number.toLowerCase().includes(q)),
    );
  }, [challansQuery.data, searchQuery]);

  const stats = useMemo(() => {
    const list = challansQuery.data ?? [];
    const totalCount = list.length;
    const totalValuation = list.reduce((acc, c) => acc + Number(c.total_amount || 0), 0);
    const dispatchedCount = list.filter((c) => c.status === "dispatched" || c.status === "delivered").length;
    return { totalCount, totalValuation, dispatchedCount };
  }, [challansQuery.data]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Delivery Challans"
        description="Outward goods movement and customer dispatch register integrated with Customer Master & Stock Inventory."
        actions={
          <Button onClick={() => navigate({ to: "/challans/new" })}>
            <Plus className="mr-1 h-4 w-4" /> New Delivery Challan
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Dispatches</CardTitle>
            <Truck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Challans recorded</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Dispatched Goods Value</CardTitle>
            <PackageCheck className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inr(stats.totalValuation)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total outward material value</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Dispatched Status</CardTitle>
            <Badge variant="default" className="bg-emerald-600 text-white">Active</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{stats.dispatchedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Stock deducted &amp; shipped</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search challan #, customer, PO reference, vehicle…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Challans Table */}
      <div className="rounded-md border bg-card shadow-sm overflow-hidden">
        <Table className="min-w-[900px]">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[140px]">Challan #</TableHead>
              <TableHead className="w-[110px]">Date</TableHead>
              <TableHead className="min-w-[200px]">Customer Name</TableHead>
              <TableHead className="w-[120px]">Order Ref</TableHead>
              <TableHead className="w-[130px]">Vehicle No</TableHead>
              <TableHead className="w-[120px] text-right">Goods Value</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {challansQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Loading Delivery Challans…
                </TableCell>
              </TableRow>
            ) : filteredChallans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                  No delivery challans found. Click <b>New Delivery Challan</b> to dispatch goods.
                </TableCell>
              </TableRow>
            ) : (
              filteredChallans.map((c) => (
                <TableRow
                  key={c.id}
                  className="hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate({ to: "/challans/$id", params: { id: c.id } })}
                >
                  <TableCell className="font-semibold text-primary font-mono">
                    {c.challan_number}
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(c.challan_date, dateFormat)}</TableCell>
                  <TableCell>
                    <div className="font-medium text-foreground">{c.customer?.name || "Unassigned"}</div>
                    {c.customer?.vat_number ? (
                      <div className="text-xs text-muted-foreground">VAT: {c.customer.vat_number}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm font-mono">{c.po_reference || "—"}</TableCell>
                  <TableCell className="text-sm">{c.vehicle_number || "—"}</TableCell>
                  <TableCell className="text-right font-semibold">{inr(c.total_amount)}</TableCell>
                  <TableCell>
                    <Badge variant="default" className="bg-emerald-600 text-white capitalize text-xs">
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => navigate({ to: "/challans/$id", params: { id: c.id } })}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setConfirmDeleteId(c.id)}
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

      {/* Delete Modal */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(v) => !v && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Delivery Challan?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this delivery challan? This action cannot be undone.
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
