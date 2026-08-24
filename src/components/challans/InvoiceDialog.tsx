import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, ChevronsUpDown, FileText, ArrowLeft, Receipt, CreditCard } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/format";
import { formatDate } from "@/lib/date-conversion";
import { useDateFormat } from "@/hooks/use-date-format";
import { useCompany, type CompanyRecord } from "@/hooks/use-company";
import { nextDocNumber } from "@/lib/voucher-number";
import {
  SalesInvoice,
  type InvoiceLineData,
  type InvoiceCompanyData,
  type InvoiceCustomerData,
} from "./SalesInvoice";

// ── Types ──────────────────────────────────────────────────────────

interface ChallanRecord {
  id: string;
  challan_number: string;
  challan_date: string;
  total_amount: number;
  status: string;
  delivery_address?: string | null;
  po_reference?: string | null;
}

interface ChallanLineRecord {
  id: string;
  sno: number;
  ref_id: string | null;
  code: string | null;
  name: string;
  uom: string | null;
  quantity: number;
  per_unit: number;
  lot_number: string | null;
  expiry_date: string | null;
}

interface CustomerRecord {
  id: string;
  name: string;
  vat_number?: string | null;
  billing_address?: string | null;
  state?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Steps ──────────────────────────────────────────────────────────

type Step = "customer" | "challans" | "invoice_type" | "invoice";

// ── Error Boundary ────────────────────────────────────────────────

interface ErrorBoundaryProps { children: ReactNode; }
interface ErrorBoundaryState { error: Error | null; }

class InvoiceErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="p-4 text-center">
          <p className="text-sm text-destructive font-medium">Something went wrong rendering the invoice.</p>
          <p className="text-xs text-muted-foreground mt-1">{this.state.error.message}</p>
          <Button size="sm" className="mt-3" onClick={() => this.setState({ error: null })}>Try Again</Button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Component ──────────────────────────────────────────────────────

export function InvoiceDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const dateFormat = useDateFormat();
  const { company } = useCompany();

  const [step, setStep] = useState<Step>("customer");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [selectedChallanIds, setSelectedChallanIds] = useState<string[]>([]);
  const [invoiceType, setInvoiceType] = useState<"pan" | "vat">("pan");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [customerSearch, setCustomerSearch] = useState("");

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setStep("customer");
      setCustomerId(null);
      setSelectedChallanIds([]);
      setInvoiceType("pan");
      setInvoiceNumber("");
      setInvoiceDate(new Date().toISOString().slice(0, 10));
      setCustomerSearch("");
    }
  }, [open]);

  // ── Queries ────────────────────────────────────────────────────

  // All customers
  const customersQuery = useQuery({
    queryKey: ["customers", "invoice_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers" as any)
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as CustomerRecord[];
    },
    enabled: open,
  });

  // All challans for selected customer
  const pendingChallans = useQuery({
    queryKey: ["delivery_challans", "pending", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_challans" as any)
        .select("id, challan_number, challan_date, total_amount, status, delivery_address, po_reference")
        .eq("customer_id", customerId!)
        .order("challan_date", { ascending: false });
      if (error) throw error;

      // Exclude challans already included in existing invoices
      const { data: existingInvoices } = await supabase
        .from("sales_invoices" as any)
        .select("challan_ids");

      const invoicedIds = new Set<string>();
      (existingInvoices ?? []).forEach((inv: any) => {
        (inv.challan_ids ?? []).forEach((id: string) => invoicedIds.add(id));
      });

      return ((data ?? []) as unknown as ChallanRecord[]).filter(
        (c) => !invoicedIds.has(c.id),
      );
    },
    enabled: open && !!customerId,
  });

  // Lines for selected challans
  const challanLines = useQuery({
    queryKey: ["delivery_challan_lines", "invoice", selectedChallanIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_challan_lines" as any)
        .select("id, sno, ref_id, code, name, uom, quantity, per_unit, lot_number, expiry_date")
        .in("challan_id", selectedChallanIds)
        .order("sno");
      if (error) throw error;
      return (data ?? []) as unknown as ChallanLineRecord[];
    },
    enabled: open && selectedChallanIds.length > 0,
  });

  // Items (to get vat_rate)
  const items = useQuery({
    queryKey: ["items", "list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("items").select("id, vat_rate");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  // ── Invoice number generation ──────────────────────────────────

  const generateInvoiceNumber = async (): Promise<string> => {
    try {
      return await nextDocNumber("SI", "sales_invoices", "invoice_number", company.id);
    } catch (err) {
      console.error("Invoice number generation failed:", err);
      throw new Error("Failed to generate invoice number. Please try again.");
    }
  };

  // ── Save mutation ──────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async (data: {
      subtotal: number;
      discount: number;
      vat_amount: number;
      total_amount: number;
      lines: InvoiceLineData[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const num = invoiceNumber;
      if (!num) throw new Error("Invoice number is missing. Please go back and try again.");

      const selectedChallans = pendingChallans.data?.filter((c) =>
        selectedChallanIds.includes(c.id),
      ) ?? [];

      const { error: invErr } = await supabase.from("sales_invoices" as any).insert({
        invoice_number: num,
        invoice_date: invoiceDate,
        invoice_type: invoiceType,
        company_id: company.id || null,
        customer_id: customerId,
        challan_ids: selectedChallanIds,
        subtotal: data.subtotal,
        discount: data.discount,
        vat_amount: data.vat_amount,
        total_amount: data.total_amount,
        status: "draft",
        user_id: user.id,
      } as any);
      if (invErr) throw invErr;

      // Get the inserted invoice ID
      const { data: inserted } = await supabase
        .from("sales_invoices" as any)
        .select("id")
        .eq("invoice_number", num)
        .single();

      const invoiceId = (inserted as any)?.id;

      // Insert line items
      if (invoiceId && data.lines.length > 0) {
        const linePayloads = data.lines.map((l) => ({
          invoice_id: invoiceId,
          sno: l.sno,
          ref_id: l.ref_id || null,
          code: l.code || null,
          name: l.name,
          uom: l.uom || "NOS",
          quantity: l.quantity,
          per_unit: l.per_unit,
          vat_rate: l.vat_rate,
          line_amount: l.quantity * l.per_unit,
        }));
        const { error: lineErr } = await supabase
          .from("sales_invoice_lines" as any)
          .insert(linePayloads as any);
        if (lineErr) throw lineErr;
      }

      return num;
    },
    onSuccess: (num) => {
      toast.success(`Invoice ${num} saved`);
      qc.invalidateQueries({ queryKey: ["sales_invoices"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // ── Derived data ───────────────────────────────────────────────

  const selectedCustomer = useMemo(
    () => customersQuery.data?.find((c) => c.id === customerId) ?? null,
    [customersQuery.data, customerId],
  );

  const selectedChallanRecords = useMemo(
    () => pendingChallans.data?.filter((c) => selectedChallanIds.includes(c.id)) ?? [],
    [pendingChallans.data, selectedChallanIds],
  );

  // Merge duplicate items (same ref_id) across challans
  const mergedLines: InvoiceLineData[] = useMemo(() => {
    if (!challanLines.data) return [];
    const map = new Map<string, InvoiceLineData>();
    let sno = 1;
    for (const cl of challanLines.data) {
      const item = items.data?.find((i) => i.id === cl.ref_id) as Record<string, unknown> | undefined;
      const vatRate = (item?.vat_rate as number) ?? 0;
      const key = cl.ref_id || `${cl.name}-${cl.sno}`;
      const existing = map.get(key);
      if (existing) {
        existing.quantity += Number(cl.quantity || 0);
      } else {
        map.set(key, {
          sno: sno++,
          ref_id: cl.ref_id,
          code: cl.code,
          name: cl.name,
          uom: cl.uom,
          quantity: Number(cl.quantity || 0),
          per_unit: Number(cl.per_unit || 0),
          vat_rate: vatRate,
        });
      }
    }
    return Array.from(map.values());
  }, [challanLines.data, items.data]);

  const challanNumbers = selectedChallanRecords.map((c) => c.challan_number);
  const deliveryAddress = selectedChallanRecords[0]?.delivery_address;
  const poReference = selectedChallanRecords[0]?.po_reference;

  // ── Handlers ───────────────────────────────────────────────────

  const handleCustomerNext = () => {
    if (!customerId) {
      toast.error("Please select a customer");
      return;
    }
    setStep("challans");
  };

  const handleChallansNext = () => {
    if (selectedChallanIds.length === 0) {
      toast.error("Please select at least one challan");
      return;
    }
    if (company.tax_type === "pan") {
      setInvoiceType("pan");
      proceedToInvoice("pan");
    } else {
      setStep("invoice_type");
    }
  };

  const proceedToInvoice = async (type: "pan" | "vat") => {
    try {
      setInvoiceType(type);
      const num = await generateInvoiceNumber();
      setInvoiceNumber(num);
      setStep("invoice");
    } catch (err) {
      console.error("Failed to generate invoice:", err);
      toast.error("Failed to generate invoice number. Check console for details.");
    }
  };

  const toggleChallan = (id: string) => {
    setSelectedChallanIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleAll = () => {
    const allIds = pendingChallans.data?.map((c) => c.id) ?? [];
    setSelectedChallanIds((prev) =>
      prev.length === allIds.length ? [] : allIds,
    );
  };

  // ── Dialog size based on step ──────────────────────────────────

  const isInvoiceStep = step === "invoice";
  const dialogClass = isInvoiceStep
    ? "max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto"
    : "max-w-2xl w-[95vw]";

  // ── Render ─────────────────────────────────────────────────────

  const companyInvoiceData: InvoiceCompanyData = {
    name: company.name,
    vat_number: company.vat_number,
    pan: company.pan,
    logo_url: company.logo_url,
    address: company.address,
    state: company.state,
    city: company.city,
    pincode: company.pincode,
    phone: company.phone,
    email: company.email,
  };

  const customerInvoiceData: InvoiceCustomerData = {
    name: selectedCustomer?.name ?? "",
    vat_number: selectedCustomer?.vat_number,
    billing_address: selectedCustomer?.billing_address,
    state: selectedCustomer?.state,
    city: selectedCustomer?.city,
    phone: selectedCustomer?.phone,
    email: selectedCustomer?.email,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogClass}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            {step === "invoice" ? `Invoice ${invoiceNumber}` : "Create Sales Invoice"}
          </DialogTitle>
          {step !== "invoice" && (
            <DialogDescription>
              {step === "customer" && "Select a customer to generate a sales invoice for."}
              {step === "challans" && "Select the delivery challans to include in this invoice."}
              {step === "invoice_type" && "Choose the invoice format."}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Step Indicator */}
        {step !== "invoice" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={step === "customer" ? "default" : "outline"} className="h-5">
              1. Customer
            </Badge>
            <span>→</span>
            <Badge variant={step === "challans" ? "default" : "outline"} className="h-5">
              2. Challans
            </Badge>
            {company.tax_type === "vat" && (
              <>
                <span>→</span>
                <Badge variant={step === "invoice_type" ? "default" : "outline"} className="h-5">
                  3. Type
                </Badge>
              </>
            )}
          </div>
        )}

        {/* Step 1: Customer Selection */}
        {step === "customer" && (
          <div className="space-y-4">
            {customersQuery.isLoading ? (
              <p className="text-sm text-muted-foreground py-4">Loading customers…</p>
            ) : customersQuery.data?.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No customers with delivery challans found.
              </p>
            ) : (
              <>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search customers..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {customersQuery.data
                    ?.filter((c) =>
                      !customerSearch.trim() ||
                      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                      (c.vat_number && c.vat_number.toLowerCase().includes(customerSearch.toLowerCase())) ||
                      (c.phone && c.phone.toLowerCase().includes(customerSearch.toLowerCase()))
                    )
                    .map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setCustomerId(c.id);
                        setStep("challans");
                      }}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border transition-colors",
                        customerId === c.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50",
                      )}
                    >
                      <div className="font-medium text-sm">{c.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {[c.vat_number, c.phone, c.city].filter(Boolean).join(" · ")}
                      </div>
                    </button>
                  ))}
                  {customersQuery.data?.filter((c) =>
                    !customerSearch.trim() ||
                    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                    (c.vat_number && c.vat_number.toLowerCase().includes(customerSearch.toLowerCase())) ||
                    (c.phone && c.phone.toLowerCase().includes(customerSearch.toLowerCase()))
                  ).length === 0 && (
                    <p className="text-sm text-muted-foreground py-2 text-center">
                      No customers match "{customerSearch}"
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 2: Challan Selection */}
        {step === "challans" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setStep("customer")}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              {pendingChallans.data && pendingChallans.data.length > 0 && (
                <Button variant="ghost" size="sm" onClick={toggleAll}>
                  {selectedChallanIds.length === pendingChallans.data.length
                    ? "Deselect All"
                    : "Select All"}
                </Button>
              )}
            </div>

            {pendingChallans.isLoading ? (
              <p className="text-sm text-muted-foreground py-4">Loading challans…</p>
            ) : pendingChallans.data?.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No pending challans for this customer.
              </p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {pendingChallans.data?.map((c) => (
                  <label
                    key={c.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedChallanIds.includes(c.id)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    <Checkbox
                      checked={selectedChallanIds.includes(c.id)}
                      onCheckedChange={() => toggleChallan(c.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm font-mono">{c.challan_number}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(c.challan_date, dateFormat)} · {c.status}
                      </div>
                    </div>
                    <div className="text-sm font-semibold">{inr(c.total_amount)}</div>
                  </label>
                ))}
              </div>
            )}

            {pendingChallans.data && pendingChallans.data.length > 0 && (
              <div className="flex justify-end">
                <Button onClick={handleChallansNext} disabled={selectedChallanIds.length === 0}>
                  Generate Invoice →
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Invoice Type (VAT companies only) */}
        {step === "invoice_type" && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setStep("challans")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>

            <p className="text-sm text-muted-foreground">
              Your company is configured for VAT. Choose the invoice format:
            </p>

            <div className="grid grid-cols-2 gap-4">
              <Card
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => proceedToInvoice("pan")}
              >
                <CardContent className="pt-6 text-center space-y-2">
                  <CreditCard className="h-8 w-8 mx-auto text-primary" />
                  <p className="font-semibold">PAN Bill</p>
                  <p className="text-xs text-muted-foreground">
                    No VAT. Editable qty &amp; rate. Professional format.
                  </p>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => proceedToInvoice("vat")}
              >
                <CardContent className="pt-6 text-center space-y-2">
                  <Receipt className="h-8 w-8 mx-auto text-emerald-600" />
                  <p className="font-semibold">VAT Bill</p>
                  <p className="text-xs text-muted-foreground">
                    Items excl. VAT → discount → VAT levied. Tax invoice format.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Step 4: Invoice View */}
        {step === "invoice" && (
          <div>
            {saveMutation.isPending && (
              <p className="text-sm text-muted-foreground text-center py-4">Saving invoice…</p>
            )}
            {mergedLines.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No line items found for the selected challans.
              </p>
            ) : (
              <InvoiceErrorBoundary>
                <SalesInvoice
                  invoiceNumber={invoiceNumber}
                  invoiceDate={invoiceDate}
                  invoiceType={invoiceType}
                  company={companyInvoiceData}
                  customer={customerInvoiceData}
                  deliveryAddress={deliveryAddress}
                  poReference={poReference}
                  initialLines={mergedLines}
                  challanNumbers={challanNumbers}
                  onInvoiceNumberChange={setInvoiceNumber}
                  onInvoiceDateChange={setInvoiceDate}
                  onSave={(data) => saveMutation.mutate(data)}
                />
              </InvoiceErrorBoundary>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
