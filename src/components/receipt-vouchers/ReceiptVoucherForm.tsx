import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BsDatePicker } from "@/components/ui/bs-date-picker";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import {
  customerSchema,
  customerFields,
} from "@/components/masters/schemas";
import { adToBsInput, bsInputToAd } from "@/lib/date-conversion";
import { useDateFormat } from "@/hooks/use-date-format";
import { inr, toNumber } from "@/lib/format";

type PayerType = "customer" | "other";
type AdjustmentType = "invoice_wise" | "simple";

const RECEIPT_MODES = [
  { value: "petty_cash", label: "Petty Cash" },
  { value: "qr", label: "QR" },
  { value: "cheque", label: "Cheque" },
  { value: "online_banking", label: "Online Banking" },
  { value: "ips", label: "IPS" },
  { value: "mobile_banking", label: "Mobile Banking" },
  { value: "cards", label: "Cards" },
  { value: "other", label: "Other" },
];

interface InvoiceRow {
  id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  paid_amount: number;
  outstanding: number;
}

interface InvoiceAllocation {
  invoice_id: string;
  invoice_number: string;
  outstanding: number;
  amount_applied: number;
}

interface ReceiptVoucherFormProps {
  initial?: Record<string, unknown> | null;
  existingInvoiceAllocations?: InvoiceAllocation[];
  viewOnly?: boolean;
}

export function ReceiptVoucherForm({
  initial,
  existingInvoiceAllocations,
  viewOnly = false,
}: ReceiptVoucherFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dateFormat = useDateFormat();

  const [payerType, setPayerType] = useState<PayerType>(
    (initial?.payer_type as PayerType) || "customer"
  );
  const [customerId, setCustomerId] = useState<string | null>(
    (initial?.customer_id as string) || null
  );
  const [customerRow, setCustomerRow] = useState<Record<string, unknown> | null>(null);
  const [payerName, setPayerName] = useState(
    (initial?.payer_name as string) || ""
  );
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>(
    (initial?.adjustment_type as AdjustmentType) || "simple"
  );
  const [receiptMode, setReceiptMode] = useState(
    (initial?.receipt_mode as string) || "petty_cash"
  );
  const [referenceNumber, setReferenceNumber] = useState(
    (initial?.reference_number as string) || ""
  );
  const [receiptDate, setReceiptDate] = useState(
    (initial?.receipt_date as string) || new Date().toISOString().split("T")[0]
  );
  const [totalAmount, setTotalAmount] = useState(
    toNumber(initial?.total_amount, 0)
  );
  const [remarks, setRemarks] = useState((initial?.remarks as string) || "");
  const [receivedInType, setReceivedInType] = useState(
    (initial?.received_in_type as string) || ""
  );
  const [receivedInId, setReceivedInId] = useState(
    (initial?.received_in_id as string) || ""
  );
  const [invoiceAllocations, setInvoiceAllocations] = useState<InvoiceAllocation[]>(
    existingInvoiceAllocations || []
  );
  const [useBsDate, setUseBsDate] = useState(dateFormat === "bs");

  const dateDisplayValue = useMemo(() => {
    if (!receiptDate) return "";
    if (useBsDate || dateFormat === "bs") {
      return adToBsInput(receiptDate);
    }
    return receiptDate;
  }, [receiptDate, useBsDate, dateFormat]);

  const customersQuery = useQuery({
    queryKey: ["customers", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, vat_number, phone")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const customerOptions: EntityOption[] = useMemo(
    () =>
      (customersQuery.data ?? []).map((c) => ({
        id: c.id,
        label: c.name,
        sublabel: c.vat_number || undefined,
        raw: c,
      })),
    [customersQuery.data]
  );

  // Fetch petty cash accounts
  const pettyCashQuery = useQuery({
    queryKey: ["petty-cash-accounts", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("petty_cash_accounts")
        .select("id, name, current_balance")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch bank accounts
  const bankAccountsQuery = useQuery({
    queryKey: ["bank-accounts", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, bank_name, account_number, current_balance")
        .eq("status", "active")
        .order("bank_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Combined received in options
  const receivedInOptions = useMemo(() => {
    const options: { value: string; label: string; type: string; balance: number }[] = [];
    (pettyCashQuery.data ?? []).forEach((pc) => {
      options.push({
        value: pc.id,
        label: `Petty Cash - ${pc.name}`,
        type: "petty_cash",
        balance: Number(pc.current_balance),
      });
    });
    (bankAccountsQuery.data ?? []).forEach((bank) => {
      options.push({
        value: bank.id,
        label: `Bank - ${bank.bank_name} (${bank.account_number})`,
        type: "bank",
        balance: Number(bank.current_balance),
      });
    });
    return options;
  }, [pettyCashQuery.data, bankAccountsQuery.data]);

  // Fetch unpaid sales invoices for selected customer
  const unpaidInvoicesQuery = useQuery({
    queryKey: ["unpaid-sales-invoices", customerId],
    queryFn: async () => {
      if (!customerId) return [];

      const { data: invoices, error: invErr } = await supabase
        .from("sales_invoices" as any)
        .select("id, invoice_number, invoice_date, total_amount")
        .eq("customer_id", customerId)
        .order("invoice_date", { ascending: true });

      if (invErr) throw invErr;
      if (!invoices || invoices.length === 0) return [];

      const invoiceIds = invoices.map((inv: any) => inv.id);
      const { data: allocations } = await supabase
        .from("receipt_voucher_invoices" as any)
        .select("invoice_id, amount_applied")
        .in("invoice_id", invoiceIds);

      const paidMap = new Map<string, number>();
      (allocations ?? []).forEach((a: any) => {
        paidMap.set(a.invoice_id, (paidMap.get(a.invoice_id) ?? 0) + Number(a.amount_applied));
      });

      return invoices
        .map((inv: any) => {
          const paid = paidMap.get(inv.id) ?? 0;
          const outstanding = Number(inv.total_amount) - paid;
          return {
            id: inv.id,
            invoice_number: inv.invoice_number,
            invoice_date: inv.invoice_date,
            total_amount: Number(inv.total_amount),
            paid_amount: paid,
            outstanding: Math.max(0, outstanding),
          };
        })
        .filter((inv: InvoiceRow) => inv.outstanding > 0);
    },
    enabled: payerType === "customer" && !!customerId && adjustmentType === "invoice_wise",
  });

  useEffect(() => {
    if (adjustmentType === "invoice_wise") {
      const sum = invoiceAllocations.reduce(
        (acc, a) => acc + toNumber(a.amount_applied, 0),
        0
      );
      setTotalAmount(sum);
    }
  }, [invoiceAllocations, adjustmentType]);

  useEffect(() => {
    setInvoiceAllocations([]);
  }, [customerId]);

  useEffect(() => {
    if (customerId) {
      const found = customerOptions.find((o) => o.id === customerId);
      if (found) setCustomerRow(found.raw);
    }
  }, [customerId, customerOptions]);

  useEffect(() => {
    if (existingInvoiceAllocations && existingInvoiceAllocations.length > 0) {
      setInvoiceAllocations(existingInvoiceAllocations);
    }
  }, [existingInvoiceAllocations]);

  function handleDateChange(value: string) {
    if (!value) {
      setReceiptDate("");
      return;
    }
    if (dateFormat === "bs" || useBsDate) {
      const adDate = bsInputToAd(value);
      if (adDate) setReceiptDate(adDate);
    } else {
      setReceiptDate(value);
    }
  }

  function toggleDateFormat() {
    setUseBsDate(!useBsDate);
  }

  function updateInvoiceAllocation(invoiceId: string, amount: number) {
    setInvoiceAllocations((prev) => {
      const existing = prev.find((a) => a.invoice_id === invoiceId);
      if (existing) {
        if (amount <= 0) {
          return prev.filter((a) => a.invoice_id !== invoiceId);
        }
        return prev.map((a) =>
          a.invoice_id === invoiceId ? { ...a, amount_applied: amount } : a
        );
      }
      if (amount <= 0) return prev;
      const inv = unpaidInvoicesQuery.data?.find((i) => i.id === invoiceId);
      if (!inv) return prev;
      return [
        ...prev,
        {
          invoice_id: invoiceId,
          invoice_number: inv.invoice_number,
          outstanding: inv.outstanding,
          amount_applied: amount,
        },
      ];
    });
  }

  function addAllInvoices() {
    if (!unpaidInvoicesQuery.data) return;
    setInvoiceAllocations(
      unpaidInvoicesQuery.data.map((inv) => ({
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        outstanding: inv.outstanding,
        amount_applied: inv.outstanding,
      }))
    );
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (payerType === "customer" && !customerId) {
        throw new Error("Please select a customer");
      }
      if (payerType === "other" && !payerName.trim()) {
        throw new Error("Please enter payer name");
      }
      if (totalAmount <= 0) {
        throw new Error("Amount must be greater than zero");
      }
      if (adjustmentType === "invoice_wise" && invoiceAllocations.length === 0) {
        throw new Error("Please allocate amounts to at least one invoice");
      }
      if (!receivedInType || !receivedInId) {
        throw new Error("Please select an account to receive into");
      }

      const { data: companies } = await supabase
        .from("companies")
        .select("id, is_default");
      const activeCompany = companies?.find((c: any) => c.is_default) ?? companies?.[0];
      const companyId = activeCompany?.id ?? null;

      if (!companyId) {
        throw new Error("No active company found. Please configure a company in Masters -> Companies first.");
      }

      // Generate voucher number with retry on duplicate constraint
      const now = new Date();
      const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
      const prefix = `RV-${ym}-`;

      const { data: existing } = await supabase
        .from("receipt_vouchers" as any)
        .select("voucher_number")
        .like("voucher_number", `${prefix}%`)
        .order("voucher_number", { ascending: false })
        .limit(1);

      let nextNum = 1;
      if (existing && existing.length > 0) {
        const parts = existing[0].voucher_number.split("-");
        const lastNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
      }

      // Retry loop: on duplicate key, increment and retry (up to 10 times)
      let voucher: any = null;
      let voucherErr: any = null;
      for (let attempt = 0; attempt < 10; attempt++) {
        const voucherNumber = `${prefix}${String(nextNum + attempt).padStart(3, "0")}`;
        const result = await supabase
          .from("receipt_vouchers" as any)
          .insert({
            company_id: companyId,
            voucher_number: voucherNumber,
            payer_type: payerType,
            customer_id: payerType === "customer" ? customerId : null,
            payer_name: payerType === "other" ? payerName : null,
            receipt_mode: receiptMode,
            reference_number: referenceNumber || null,
            receipt_date: receiptDate,
            total_amount: totalAmount,
            adjustment_type: adjustmentType,
            remarks: remarks || null,
            received_in_type: receivedInType,
            received_in_id: receivedInId,
            status: "final",
          })
          .select()
          .single();

        if (!result.error) {
          voucher = result.data;
          voucherErr = null;
          break;
        }

        // Only retry on unique constraint violation, throw everything else immediately
        const isDuplicate =
          result.error.code === "23505" ||
          (result.error.message ?? "").includes("unique") ||
          (result.error.message ?? "").includes("duplicate");

        if (!isDuplicate) {
          voucherErr = result.error;
          break;
        }

        voucherErr = result.error; // keep last error in case all retries fail
      }

      if (voucherErr) throw voucherErr;
      if (!voucher) throw new Error("Failed to create receipt voucher after retries.");


      // Update balance of the received in account
      if (receivedInType === "petty_cash" && receivedInId) {
        const { data: pc } = await supabase
          .from("petty_cash_accounts")
          .select("current_balance")
          .eq("id", receivedInId)
          .single();
        if (pc) {
          await supabase
            .from("petty_cash_accounts")
            .update({ current_balance: Number(pc.current_balance) + totalAmount })
            .eq("id", receivedInId);
        }
      } else if (receivedInType === "bank" && receivedInId) {
        const { data: bank } = await supabase
          .from("bank_accounts")
          .select("current_balance")
          .eq("id", receivedInId)
          .single();
        if (bank) {
          await supabase
            .from("bank_accounts")
            .update({ current_balance: Number(bank.current_balance) + totalAmount })
            .eq("id", receivedInId);
        }
      }

      if (adjustmentType === "invoice_wise" && invoiceAllocations.length > 0) {
        const { error: allocErr } = await supabase
          .from("receipt_voucher_invoices" as any)
          .insert(
            invoiceAllocations.map((a) => ({
              receipt_voucher_id: voucher.id,
              invoice_id: a.invoice_id,
              amount_applied: a.amount_applied,
            }))
          );
        if (allocErr) throw allocErr;
      }

      return voucher;
    },
    onSuccess: (voucher) => {
      toast.success("Receipt voucher created successfully");
      queryClient.invalidateQueries({ queryKey: ["receipt-vouchers"] });
      navigate({
        to: "/receipt-payment/receipt-voucher/$id",
        params: { id: voucher.id },
      });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return (
    <>
      <PageHeader
        title="New Receipt Voucher"
        description="Record an amount received from a customer."
      />
      <div className="space-y-6 p-6">
        {/* Payer Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payer Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Payer Type</Label>
              <RadioGroup
                value={payerType}
                onValueChange={(v) => setPayerType(v as PayerType)}
                className="flex gap-6"
                disabled={viewOnly}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="customer" id="rv-customer" />
                  <Label htmlFor="rv-customer" className="font-normal">
                    Customer
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="other" id="rv-other" />
                  <Label htmlFor="rv-other" className="font-normal">
                    Other
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {payerType === "customer" ? (
              <div className="space-y-2">
                <Label>Customer</Label>
                <EntityCombobox
                  value={customerId}
                  onChange={(id, row) => {
                    setCustomerId(id);
                    setCustomerRow(row);
                  }}
                  options={customerOptions}
                  placeholder="Select customer…"
                  addLabel="Add new customer"
                  table="customers"
                  schema={customerSchema}
                  fields={customerFields}
                  nameKey="name"
                  disabled={viewOnly}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Payer Name</Label>
                <Input
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  placeholder="Enter payer name"
                  disabled={viewOnly}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Receipt Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Receipt Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Receipt Mode</Label>
                <Select
                  value={receiptMode}
                  onValueChange={setReceiptMode}
                  disabled={viewOnly}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECEIPT_MODES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Reference Number</Label>
                <Input
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="Cheque no. / Transaction ID"
                  disabled={viewOnly}
                />
              </div>

              <div className="space-y-2">
                <Label>Received In *</Label>
                <Select
                  value={`${receivedInType}:${receivedInId}`}
                  onValueChange={(val) => {
                    const [type, id] = val.split(":");
                    setReceivedInType(type);
                    setReceivedInId(id);
                  }}
                  disabled={viewOnly}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {(pettyCashQuery.data ?? []).map((pc) => (
                      <SelectItem key={`petty_cash:${pc.id}`} value={`petty_cash:${pc.id}`}>
                        Petty Cash - {pc.name} (Balance: {inr(pc.current_balance)})
                      </SelectItem>
                    ))}
                    {(bankAccountsQuery.data ?? []).map((bank) => (
                      <SelectItem key={`bank:${bank.id}`} value={`bank:${bank.id}`}>
                        Bank - {bank.bank_name} ({bank.account_number}) (Balance: {inr(bank.current_balance)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Receipt Date</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={toggleDateFormat}
                    disabled={viewOnly}
                  >
                    {useBsDate ? "Switch to AD" : "Switch to BS"}
                  </Button>
                </div>
                {useBsDate || dateFormat === "bs" ? (
                  <BsDatePicker
                    value={receiptDate}
                    onChange={(adDate) => setReceiptDate(adDate)}
                    className="w-full"
                    disabled={viewOnly}
                  />
                ) : (
                  <Input
                    type="date"
                    value={receiptDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    disabled={viewOnly}
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>Total Amount</Label>
                <Input
                  type="number"
                  value={totalAmount || ""}
                  onChange={(e) => setTotalAmount(toNumber(e.target.value))}
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                  disabled={viewOnly || adjustmentType === "invoice_wise"}
                />
                {adjustmentType === "invoice_wise" && (
                  <p className="text-xs text-muted-foreground">
                    Auto-calculated from invoice allocations
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional notes"
                rows={2}
                disabled={viewOnly}
              />
            </div>
          </CardContent>
        </Card>

        {/* Invoice-wise Adjustment */}
        {payerType === "customer" && customerId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Receipt Adjustment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Adjustment Type</Label>
                <RadioGroup
                  value={adjustmentType}
                  onValueChange={(v) => setAdjustmentType(v as AdjustmentType)}
                  className="flex gap-6"
                  disabled={viewOnly}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="invoice_wise" id="adj-invoicewise" />
                    <Label htmlFor="adj-invoicewise" className="font-normal">
                      Invoice-wise Adjustment
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="simple" id="adj-simple-rv" />
                    <Label htmlFor="adj-simple-rv" className="font-normal">
                      Simple Receipt
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {adjustmentType === "invoice_wise" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Select invoices to apply receipt against:
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addAllInvoices}
                      disabled={viewOnly || unpaidInvoicesQuery.isLoading}
                    >
                      Add All
                    </Button>
                  </div>

                  {unpaidInvoicesQuery.isLoading ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading unpaid invoices…
                    </div>
                  ) : unpaidInvoicesQuery.data?.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      No outstanding sales invoices found for this customer.
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Invoice Number</TableHead>
                            <TableHead className="w-28">Date</TableHead>
                            <TableHead className="w-32 text-right">
                              Total
                            </TableHead>
                            <TableHead className="w-32 text-right">
                              Outstanding
                            </TableHead>
                            <TableHead className="w-32 text-right">
                              Receive Amount
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(unpaidInvoicesQuery.data ?? []).map((inv) => {
                            const allocation = invoiceAllocations.find(
                              (a) => a.invoice_id === inv.id
                            );
                            const receiveAmount = allocation?.amount_applied ?? 0;

                            return (
                              <TableRow key={inv.id}>
                                <TableCell className="font-medium font-mono">
                                  {inv.invoice_number}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {formatDate(inv.invoice_date, dateFormat)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {inr(inv.total_amount)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums font-medium">
                                  {inr(inv.outstanding)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Input
                                    type="number"
                                    value={receiveAmount || ""}
                                    onChange={(e) =>
                                      updateInvoiceAllocation(
                                        inv.id,
                                        Math.min(
                                          toNumber(e.target.value),
                                          inv.outstanding
                                        )
                                      )
                                    }
                                    placeholder="0"
                                    min={0}
                                    max={inv.outstanding}
                                    step={0.01}
                                    className="w-28 text-right"
                                    disabled={viewOnly}
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Summary */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {payerType === "customer"
                    ? `Receiving from: ${customerOptions.find((o) => o.id === customerId)?.label ?? "—"}`
                    : `Receiving from: ${payerName || "—"}`}
                </p>
                <p className="text-sm text-muted-foreground">
                  Mode:{" "}
                  {RECEIPT_MODES.find((m) => m.value === receiptMode)?.label}
                </p>
                {receivedInId && (
                  <p className="text-sm text-muted-foreground">
                    Received In: {receivedInOptions.find((o) => o.value === receivedInId)?.label ?? "—"}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{inr(totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        {!viewOnly && (
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: "/receipt-payment" })}
            >
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Receipt Voucher
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

function formatDate(date: string | null | undefined, dateFormat: string): string {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleDateString("en-IN");
  } catch {
    return date;
  }
}
