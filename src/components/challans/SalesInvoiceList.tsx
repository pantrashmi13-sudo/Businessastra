import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Search, Receipt, Eye, Trash2, CreditCard, CheckCircle2, FileText, Lock } from "lucide-react";
import { toast } from "sonner";
import { inr } from "@/lib/format";
import { formatDate } from "@/lib/date-conversion";
import { useDateFormat } from "@/hooks/use-date-format";
import { InvoiceDialog } from "./InvoiceDialog";
import { SalesInvoice } from "./SalesInvoice";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

interface SalesInvoiceRecord {
  id: string;
  invoice_number: string;
  invoice_date: string;
  invoice_type: "pan" | "vat";
  subtotal: number;
  discount: number;
  vat_amount: number;
  total_amount: number;
  status: string;
  challan_ids: string[];
  customer_id?: string | null;
  customer?: {
    name: string;
    vat_number?: string | null;
  } | null;
}

export function SalesInvoiceList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmApproveId, setConfirmApproveId] = useState<string | null>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<SalesInvoiceRecord | null>(null);
  const dateFormat = useDateFormat();

  const invoicesQuery = useQuery({
    queryKey: ["sales_invoices", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_invoices" as any)
        .select(`
          id, invoice_number, invoice_date, invoice_type,
          subtotal, discount, vat_amount, total_amount,
          status, challan_ids, customer_id,
          customers(name, vat_number)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        ...row,
        customer: row.customers,
      })) as SalesInvoiceRecord[];
    },
  });

  // Delete — only allowed for draft invoices
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Double-check status before deleting
      const { data: inv } = await supabase
        .from("sales_invoices" as any)
        .select("status")
        .eq("id", id)
        .maybeSingle();

      if ((inv as any)?.status === "final") {
        throw new Error("Approved invoices cannot be deleted. Only draft invoices can be deleted.");
      }

      const { error: linesErr } = await supabase
        .from("sales_invoice_lines" as any)
        .delete()
        .eq("invoice_id", id);
      if (linesErr) throw linesErr;

      const { error } = await supabase.from("sales_invoices" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Draft invoice deleted");
      qc.invalidateQueries({ queryKey: ["sales_invoices"] });
      setConfirmDeleteId(null);
    },
    onError: (e) => {
      toast.error((e as Error).message);
      setConfirmDeleteId(null);
    },
  });

  // Approve — moves invoice from draft → final (irreversible)
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("sales_invoices" as any)
        .update({ status: "final" } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invoice approved successfully");
      qc.invalidateQueries({ queryKey: ["sales_invoices"] });
      setConfirmApproveId(null);
    },
    onError: (e) => {
      toast.error((e as Error).message);
      setConfirmApproveId(null);
    },
  });

  const filteredInvoices = useMemo(() => {
    const list = invoicesQuery.data ?? [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (inv) =>
        inv.invoice_number.toLowerCase().includes(q) ||
        (inv.customer?.name && inv.customer.name.toLowerCase().includes(q)) ||
        inv.status.toLowerCase().includes(q),
    );
  }, [invoicesQuery.data, searchQuery]);

  const stats = useMemo(() => {
    const list = invoicesQuery.data ?? [];
    const totalCount = list.length;
    const totalValue = list.reduce((acc, inv) => acc + Number(inv.total_amount || 0), 0);
    const approvedCount = list.filter((inv) => inv.status === "final").length;
    const draftCount = list.filter((inv) => inv.status === "draft").length;
    return { totalCount, totalValue, approvedCount, draftCount };
  }, [invoicesQuery.data]);

  const invoiceToApprove = invoicesQuery.data?.find((inv) => inv.id === confirmApproveId);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Sales Invoices"
        description="Generated invoices from delivery challans. Draft invoices can be edited and deleted. Approved invoices are locked and cannot be deleted."
        actions={
          <Button onClick={() => setInvoiceDialogOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Create Invoice
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Invoices</CardTitle>
            <Receipt className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCount}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-[10px] h-4 py-0 px-1 border-amber-500 text-amber-600">
                {stats.draftCount} Draft
              </Badge>
              <Badge variant="outline" className="text-[10px] h-4 py-0 px-1 border-emerald-500 text-emerald-600">
                {stats.approvedCount} Approved
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Invoice Value</CardTitle>
            <CreditCard className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inr(stats.totalValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">Combined billed amount</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approval Status</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{stats.approvedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.draftCount} pending approval
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search invoice #, customer, status…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Invoices Table */}
      <div className="rounded-md border bg-card shadow-sm overflow-hidden">
        <Table className="min-w-[900px]">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[160px]">Invoice #</TableHead>
              <TableHead className="w-[110px]">Date</TableHead>
              <TableHead className="min-w-[180px]">Customer</TableHead>
              <TableHead className="w-[80px]">Type</TableHead>
              <TableHead className="w-[110px] text-right">Subtotal</TableHead>
              <TableHead className="w-[90px] text-right">VAT</TableHead>
              <TableHead className="w-[110px] text-right">Total</TableHead>
              <TableHead className="w-[110px]">Status</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoicesQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  Loading Sales Invoices…
                </TableCell>
              </TableRow>
            ) : filteredInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                  No invoices found. Click <b>Create Invoice</b> to generate one from delivery challans.
                </TableCell>
              </TableRow>
            ) : (
              filteredInvoices.map((inv) => {
                const isApproved = inv.status === "final";
                return (
                  <TableRow
                    key={inv.id}
                    className="hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setViewInvoice(inv)}
                  >
                    <TableCell className="font-semibold text-primary font-mono">
                      {inv.invoice_number}
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(inv.invoice_date, dateFormat)}</TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{inv.customer?.name || "—"}</div>
                      {inv.customer?.vat_number ? (
                        <div className="text-xs text-muted-foreground">VAT: {inv.customer.vat_number}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={inv.invoice_type === "vat" ? "default" : "secondary"}
                        className="capitalize text-xs"
                      >
                        {inv.invoice_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{inr(inv.subtotal)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {inv.vat_amount > 0 ? inr(inv.vat_amount) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold font-mono">{inr(inv.total_amount)}</TableCell>

                    {/* Status Badge */}
                    <TableCell>
                      {isApproved ? (
                        <Badge className="bg-emerald-600 text-white text-xs gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Approved
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-500 text-amber-600 text-xs gap-1">
                          <FileText className="h-3 w-3" /> Draft
                        </Badge>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {/* View */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => setViewInvoice(inv)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View Invoice</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        {/* Approve — only for draft */}
                        {!isApproved && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                  onClick={() => setConfirmApproveId(inv.id)}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Approve Invoice</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}

                        {/* Delete — only for draft; show locked icon for approved */}
                        {isApproved ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-muted-foreground cursor-not-allowed"
                                  disabled
                                >
                                  <Lock className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Approved invoices cannot be deleted</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => setConfirmDeleteId(inv.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete Draft</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Approve Confirmation */}
      <AlertDialog open={!!confirmApproveId} onOpenChange={(v) => !v && setConfirmApproveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Approve Invoice?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Approving <strong>{invoiceToApprove?.invoice_number}</strong> will lock it permanently.
              Approved invoices <strong>cannot be deleted or edited</strong>. This action is irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => confirmApproveId && approveMutation.mutate(confirmApproveId)}
            >
              Yes, Approve Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation — only for drafts */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(v) => !v && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Draft Invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this draft invoice? This action cannot be undone.
              Only <strong>draft</strong> invoices can be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteId && deleteMutation.mutate(confirmDeleteId)}
            >
              Delete Draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Invoice Dialog */}
      <Dialog open={!!viewInvoice} onOpenChange={(v) => !v && setViewInvoice(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
          {viewInvoice && (
            <ViewInvoiceLoader invoice={viewInvoice} onClose={() => setViewInvoice(null)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Create Invoice Dialog */}
      <InvoiceDialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen} />
    </div>
  );
}

/* ─── View Invoice Loader ───────────────────────────────────── */

function ViewInvoiceLoader({
  invoice,
  onClose,
}: {
  invoice: SalesInvoiceRecord;
  onClose: () => void;
}) {
  const [company, setCompany] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [compRes, custRes, linesRes] = await Promise.all([
          supabase.from("companies" as any).select("*").limit(1).order("created_at", { ascending: true }).maybeSingle(),
          invoice.customer_id
            ? supabase.from("customers" as any).select("*").eq("id", invoice.customer_id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          supabase.from("sales_invoice_lines" as any).select("*").eq("invoice_id", invoice.id).order("sno"),
        ]);
        if (cancelled) return;
        if (compRes.error) console.error("Company fetch error:", compRes.error);
        if (custRes.error) console.error("Customer fetch error:", custRes.error);
        if (linesRes.error) console.error("Lines fetch error:", linesRes.error);
        setCompany(compRes.data);
        setCustomer(custRes.data);
        setLines(linesRes.data ?? []);
        setLoading(false);
      } catch (e) {
        console.error("ViewInvoiceLoader error:", e);
        if (!cancelled) {
          setError((e as Error).message);
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [invoice.id, invoice.customer_id]);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading invoice…</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-destructive">Error: {error}</div>;
  }

  if (!company || !customer) {
    return (
      <div className="p-8 text-center text-destructive">
        Failed to load invoice data. Check console for details.
      </div>
    );
  }

  return (
    <SalesInvoice
      invoiceNumber={invoice.invoice_number}
      invoiceDate={invoice.invoice_date}
      invoiceType={invoice.invoice_type}
      company={company}
      customer={customer}
      initialLines={lines.map((l: any, i: number) => ({
        sno: l.sno ?? i + 1,
        ref_id: l.ref_id,
        code: l.code,
        name: l.name,
        uom: l.uom,
        quantity: Number(l.quantity),
        per_unit: Number(l.per_unit),
        vat_rate: Number(l.vat_rate ?? 0),
      }))}
      initialDiscount={Number(invoice.discount ?? 0)}
      challanNumbers={[]}
      readOnly
    />
  );
}
