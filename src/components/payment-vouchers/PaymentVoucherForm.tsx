import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, Plus, Trash2 } from "lucide-react";

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
  vendorSchema,
  vendorFields,
} from "@/components/masters/schemas";
import { formatDate, adToBsInput, bsInputToAd, type DateFormat } from "@/lib/date-conversion";
import { useDateFormat } from "@/hooks/use-date-format";
import { inr, toNumber } from "@/lib/format";
import { nextDocNumber } from "@/lib/voucher-number";
import { useCompany } from "@/hooks/use-company";

type PayeeType = "vendor" | "other";
type AdjustmentType = "bill_wise" | "simple";

const PAYMENT_MODES = [
  { value: "petty_cash", label: "Petty Cash" },
  { value: "qr", label: "QR" },
  { value: "cheque", label: "Cheque" },
  { value: "online_banking", label: "Online Banking" },
  { value: "ips", label: "IPS" },
  { value: "mobile_banking", label: "Mobile Banking" },
  { value: "cards", label: "Cards" },
  { value: "other", label: "Other" },
];

interface BillRow {
  id: string;
  bill_number: string | null;
  internal_bill_number: string | null;
  invoice_date: string | null;
  final_amount: number;
  paid_amount: number;
  outstanding: number;
}

interface BillAllocation {
  bill_id: string;
  bill_number: string | null;
  internal_bill_number: string | null;
  outstanding: number;
  amount_applied: number;
}

interface PaymentVoucherFormProps {
  initial?: Record<string, unknown> | null;
  existingBillAllocations?: BillAllocation[];
  viewOnly?: boolean;
}

export function PaymentVoucherForm({
  initial,
  existingBillAllocations,
  viewOnly = false,
}: PaymentVoucherFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dateFormat = useDateFormat();

  // Form state
  const [payeeType, setPayeeType] = useState<PayeeType>(
    (initial?.payee_type as PayeeType) || "vendor"
  );
  const [vendorId, setVendorId] = useState<string | null>(
    (initial?.vendor_id as string) || null
  );
  const [vendorRow, setVendorRow] = useState<Record<string, unknown> | null>(null);
  const [payeeName, setPayeeName] = useState(
    (initial?.payee_name as string) || ""
  );
  const [directAccountId, setDirectAccountId] = useState<string | null>(
    (initial?.direct_account_id as string) || null
  );
  const { company } = useCompany();
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>(
    (initial?.adjustment_type as AdjustmentType) || "simple"
  );
  const [paymentMode, setPaymentMode] = useState(
    (initial?.payment_mode as string) || "petty_cash"
  );
  const [referenceNumber, setReferenceNumber] = useState(
    (initial?.reference_number as string) || ""
  );
  const [paymentDate, setPaymentDate] = useState(
    (initial?.payment_date as string) || new Date().toISOString().split("T")[0]
  );
  const [totalAmount, setTotalAmount] = useState(
    toNumber(initial?.total_amount, 0)
  );
  const [remarks, setRemarks] = useState((initial?.remarks as string) || "");
  const [paidFromType, setPaidFromType] = useState(
    (initial?.paid_from_type as string) || ""
  );
  const [paidFromId, setPaidFromId] = useState(
    (initial?.paid_from_id as string) || ""
  );

  // Bill-wise state
  const [billAllocations, setBillAllocations] = useState<BillAllocation[]>(
    existingBillAllocations || []
  );
  const [useBsDate, setUseBsDate] = useState(dateFormat === "bs");

  // Date display value (converted to BS if needed)
  const dateDisplayValue = useMemo(() => {
    if (!paymentDate) return "";
    if (useBsDate || dateFormat === "bs") {
      return adToBsInput(paymentDate);
    }
    return paymentDate;
  }, [paymentDate, useBsDate, dateFormat]);

  // Fetch vendors for combobox
  const vendorsQuery = useQuery({
    queryKey: ["vendors", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, vat_number, pan")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const vendorOptions: EntityOption[] = useMemo(
    () =>
      (vendorsQuery.data ?? []).map((v) => ({
        id: v.id,
        label: v.name,
        sublabel: v.vat_number || v.pan || undefined,
        raw: v,
      })),
    [vendorsQuery.data]
  );

  // Fetch accounts for direct account selection (for "Other" payee type)
  const accountsQuery = useQuery({
    queryKey: ["accounts", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, name, code, coa:chart_of_accounts(name, account_code)")
        .eq("company_id", company!.id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; code: string | null; coa: { name: string; account_code: string } | null }[];
    },
  });

  const accountOptions: EntityOption[] = useMemo(
    () =>
      (accountsQuery.data ?? []).map((a) => ({
        id: a.id,
        label: a.name,
        sublabel: a.coa ? `${a.coa.account_code} — ${a.coa.name}` : undefined,
        raw: a,
      })),
    [accountsQuery.data]
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

  // Combined paid from options
  const paidFromOptions = useMemo(() => {
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

  // Fetch opening balance and compute running balance for selected vendor
  const vendorBalanceQuery = useQuery({
    queryKey: ["vendor-balance", vendorId],
    queryFn: async () => {
      if (!vendorId) return null;

      // Fetch opening balance
      const { data: vend } = await supabase
        .from("vendors")
        .select("opening_balance, opening_balance_type")
        .eq("id", vendorId)
        .single();

      const ob = Number(vend?.opening_balance ?? 0);
      const obType = vend?.opening_balance_type ?? "payable";

      // Fetch all bills (credit = we owe vendor)
      const { data: bills } = await supabase
        .from("bills")
        .select("final_amount")
        .eq("vendor_id", vendorId)
        .eq("status", "approved");

      // Fetch all purchase returns (reduces what we owe vendor)
      const { data: purchaseReturns } = await supabase
        .from("purchase_returns" as any)
        .select("total_amount")
        .eq("vendor_id", vendorId);

      // Fetch all payments (debit = we paid vendor)
      const { data: payments } = await supabase
        .from("payment_vouchers")
        .select("total_amount")
        .eq("vendor_id", vendorId);

      const totalBilled = (bills ?? []).reduce((s: number, b: any) => s + Number(b.final_amount ?? 0), 0);
      const totalReturns = (purchaseReturns ?? []).reduce((s: number, r: any) => s + Number(r.total_amount ?? 0), 0);
      const totalPaid = (payments ?? []).reduce((s: number, p: any) => s + Number(p.total_amount ?? 0), 0);

      const netPurchase = totalBilled - totalReturns;

      // Opening balance: payable = credit side (positive outstanding we owe), receivable = debit side (vendor owes us)
      const obCredit = obType === "payable" ? ob : 0;
      const obDebit = obType === "receivable" ? ob : 0;

      const runningBalance = (obCredit + netPurchase) - (obDebit + totalPaid);

      return {
        opening_balance: ob,
        opening_balance_type: obType,
        net_purchase: netPurchase,
        total_returns: totalReturns,
        total_paid: totalPaid,
        running_balance: runningBalance,
      };
    },
    enabled: payeeType === "vendor" && !!vendorId,
  });

  // Fetch unpaid bills when vendor is selected and adjustment is bill-wise
  const unpaidBillsQuery = useQuery({
    queryKey: ["unpaid-bills", vendorId],
    queryFn: async () => {
      if (!vendorId) return [];

      // Get all approved bills for this vendor
      const { data: bills, error: billsErr } = await supabase
        .from("bills")
        .select("id, bill_number, internal_bill_number, invoice_date, final_amount")
        .eq("vendor_id", vendorId)
        .eq("status", "approved")
        .order("invoice_date", { ascending: true });

      if (billsErr) throw billsErr;
      if (!bills || bills.length === 0) return [];

      // Get existing payment allocations for these bills
      const billIds = bills.map((b) => b.id);
      const { data: allocations } = await supabase
        .from("payment_voucher_bills")
        .select("bill_id, amount_applied")
        .in("bill_id", billIds);

      // Compute outstanding per bill
      const paidMap = new Map<string, number>();
      (allocations ?? []).forEach((a) => {
        paidMap.set(a.bill_id, (paidMap.get(a.bill_id) ?? 0) + Number(a.amount_applied));
      });

      return bills
        .map((b) => {
          const paid = paidMap.get(b.id) ?? 0;
          const outstanding = Number(b.final_amount) - paid;
          return {
            id: b.id,
            bill_number: b.bill_number,
            internal_bill_number: b.internal_bill_number,
            invoice_date: b.invoice_date,
            final_amount: Number(b.final_amount),
            paid_amount: paid,
            outstanding: Math.max(0, outstanding),
          };
        })
        .filter((b) => b.outstanding > 0);
    },
    enabled: payeeType === "vendor" && !!vendorId && adjustmentType === "bill_wise",
  });

  // Auto-set total from bill allocations in bill-wise mode
  useEffect(() => {
    if (adjustmentType === "bill_wise") {
      const sum = billAllocations.reduce(
        (acc, a) => acc + toNumber(a.amount_applied, 0),
        0
      );
      setTotalAmount(sum);
    }
  }, [billAllocations, adjustmentType]);

  // When vendor changes, reset bill allocations
  useEffect(() => {
    setBillAllocations([]);
  }, [vendorId]);

  // Set vendor row from options
  useEffect(() => {
    if (vendorId) {
      const found = vendorOptions.find((o) => o.id === vendorId);
      if (found) setVendorRow(found.raw);
    }
  }, [vendorId, vendorOptions]);

  // Initialize bill allocations from props
  useEffect(() => {
    if (existingBillAllocations && existingBillAllocations.length > 0) {
      setBillAllocations(existingBillAllocations);
    }
  }, [existingBillAllocations]);

  // Handle date input change
  function handleDateChange(value: string) {
    if (!value) {
      setPaymentDate("");
      return;
    }
    if (dateFormat === "bs" || useBsDate) {
      // BS input -> convert to AD for storage
      const adDate = bsInputToAd(value);
      if (adDate) {
        setPaymentDate(adDate);
      }
    } else {
      setPaymentDate(value);
    }
  }

  // Toggle between AD/BS date input
  function toggleDateFormat() {
    setUseBsDate(!useBsDate);
  }

  // Update bill allocation
  function updateBillAllocation(billId: string, amount: number) {
    setBillAllocations((prev) => {
      const existing = prev.find((a) => a.bill_id === billId);
      if (existing) {
        if (amount <= 0) {
          return prev.filter((a) => a.bill_id !== billId);
        }
        return prev.map((a) =>
          a.bill_id === billId ? { ...a, amount_applied: amount } : a
        );
      }
      if (amount <= 0) return prev;
      const bill = unpaidBillsQuery.data?.find((b) => b.id === billId);
      if (!bill) return prev;
      return [
        ...prev,
        {
          bill_id: billId,
          bill_number: bill.bill_number,
          internal_bill_number: bill.internal_bill_number,
          outstanding: bill.outstanding,
          amount_applied: amount,
        },
      ];
    });
  }

  // Add all bills with full outstanding
  function addAllBills() {
    if (!unpaidBillsQuery.data) return;
    setBillAllocations(
      unpaidBillsQuery.data.map((b) => ({
        bill_id: b.id,
        bill_number: b.bill_number,
        internal_bill_number: b.internal_bill_number,
        outstanding: b.outstanding,
        amount_applied: b.outstanding,
      }))
    );
  }

  // Mutation to save payment voucher
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Validate
      if (payeeType === "vendor" && !vendorId) {
        throw new Error("Please select a vendor");
      }
      if (payeeType === "other" && !payeeName.trim()) {
        throw new Error("Please enter payee name");
      }
      if (totalAmount <= 0) {
        throw new Error("Amount must be greater than zero");
      }
      if (adjustmentType === "bill_wise" && billAllocations.length === 0) {
        throw new Error("Please allocate amounts to at least one bill");
      }
      if (!paidFromType || !paidFromId) {
        throw new Error("Please select an account to pay from");
      }

      // Get current company (default company first, then fallback to first available)
      const { data: companies } = await supabase
        .from("companies")
        .select("id, is_default");
      const activeCompany = companies?.find((c) => c.is_default) ?? companies?.[0];
      const companyId = activeCompany?.id ?? null;

      if (!companyId) {
        throw new Error("No active company found. Please configure a company in Masters -> Companies first.");
      }

      // Generate voucher number using financial year
      const voucherNumber = await nextDocNumber("PV", "payment_vouchers", "voucher_number", companyId);

      // Insert payment voucher
      const { data: voucher, error: voucherErr } = await supabase
        .from("payment_vouchers")
        .insert({
          company_id: companyId,
          voucher_number: voucherNumber,
          payee_type: payeeType,
          vendor_id: payeeType === "vendor" ? vendorId : null,
          payee_name: payeeType === "other" ? payeeName : null,
          direct_account_id: payeeType === "other" ? (directAccountId || null) : null,
          payment_mode: paymentMode,
          reference_number: referenceNumber || null,
          payment_date: paymentDate,
          total_amount: totalAmount,
          adjustment_type: adjustmentType,
          remarks: remarks || null,
          paid_from_type: paidFromType,
          paid_from_id: paidFromId,
          status: "final",
        })
        .select()
        .single();

      if (voucherErr) throw voucherErr;

      // Update balance of the paid from account
      if (paidFromType === "petty_cash" && paidFromId) {
        const { data: pc } = await supabase
          .from("petty_cash_accounts")
          .select("current_balance")
          .eq("id", paidFromId)
          .single();
        if (pc) {
          await supabase
            .from("petty_cash_accounts")
            .update({ current_balance: Number(pc.current_balance) - totalAmount })
            .eq("id", paidFromId);
        }
      } else if (paidFromType === "bank" && paidFromId) {
        const { data: bank } = await supabase
          .from("bank_accounts")
          .select("current_balance")
          .eq("id", paidFromId)
          .single();
        if (bank) {
          await supabase
            .from("bank_accounts")
            .update({ current_balance: Number(bank.current_balance) - totalAmount })
            .eq("id", paidFromId);
        }
      }

      // Create ledger entry in petty_cash_ledger or bank_ledger
      const description = `Payment ${voucher.voucher_number} to ${payeeType === "vendor" ? vendorOptions.find((o) => o.id === vendorId)?.label ?? "vendor" : payeeName || "party"}`;
      if (paidFromType === "petty_cash" && paidFromId) {
        await supabase.from("petty_cash_ledger" as any).insert({
          petty_cash_id: paidFromId,
          date: paymentDate,
          description,
          debit: 0,
          credit: totalAmount,
          reference_type: "payment_voucher",
          reference_id: voucher.id,
        });
      } else if (paidFromType === "bank" && paidFromId) {
        await supabase.from("bank_ledger" as any).insert({
          bank_account_id: paidFromId,
          date: paymentDate,
          description,
          debit: 0,
          credit: totalAmount,
          reference_type: "payment_voucher",
          reference_id: voucher.id,
        });
      }

      // Insert bill allocations if bill-wise
      if (adjustmentType === "bill_wise" && billAllocations.length > 0) {
        const { error: allocErr } = await supabase
          .from("payment_voucher_bills")
          .insert(
            billAllocations.map((a) => ({
              payment_voucher_id: voucher.id,
              bill_id: a.bill_id,
              amount_applied: a.amount_applied,
            }))
          );
        if (allocErr) throw allocErr;

        // Post debit entries to ledger for each bill
        for (const alloc of billAllocations) {
          const bill = unpaidBillsQuery.data?.find(
            (b) => b.id === alloc.bill_id
          );
          await supabase.from("ledgers").insert({
            vendor_id: vendorId!,
            bill_id: alloc.bill_id,
            date: paymentDate,
            description: `Payment against Bill #${bill?.bill_number || alloc.bill_number || alloc.bill_id.slice(0, 8)}`,
            debit: alloc.amount_applied,
            credit: 0,
          });
        }
      } else if (payeeType === "vendor" && vendorId) {
        // Simple payment - post a general debit entry
        await supabase.from("ledgers").insert({
          vendor_id: vendorId,
          date: paymentDate,
          description: `Payment ${voucherNumber}${remarks ? " - " + remarks : ""}`,
          debit: totalAmount,
          credit: 0,
        });
      }

      return voucher;
    },
    onSuccess: (voucher) => {
      toast.success("Payment voucher created successfully");
      queryClient.invalidateQueries({ queryKey: ["payment-vouchers"] });
      navigate({
        to: "/receipt-payment/payment-voucher/$id",
        params: { id: voucher.id },
      });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  if (viewOnly && initial) {
    // View-only mode is handled by PaymentVoucherView
    return null;
  }

  return (
    <>
      <PageHeader
        title="New Payment Voucher"
        description="Record a payment to a vendor or other payee."
      />
      <div className="space-y-6 p-6">
        {/* Payee Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payee Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Payee Type</Label>
              <RadioGroup
                value={payeeType}
                onValueChange={(v) => setPayeeType(v as PayeeType)}
                className="flex gap-6"
                disabled={viewOnly}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="vendor" id="pv-vendor" />
                  <Label htmlFor="pv-vendor" className="font-normal">
                    Vendor
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="other" id="pv-other" />
                  <Label htmlFor="pv-other" className="font-normal">
                    Other
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {payeeType === "vendor" ? (
              <div className="space-y-2">
                <Label>Vendor</Label>
                <EntityCombobox
                  value={vendorId}
                  onChange={(id, row) => {
                    setVendorId(id);
                    setVendorRow(row);
                  }}
                  options={vendorOptions}
                  placeholder="Select vendor…"
                  addLabel="Add new vendor"
                  table="vendors"
                  schema={vendorSchema}
                  fields={vendorFields}
                  nameKey="name"
                  disabled={viewOnly}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Payee Name</Label>
                  <Input
                    value={payeeName}
                    onChange={(e) => setPayeeName(e.target.value)}
                    placeholder="Enter payee name"
                    disabled={viewOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Link to Account (optional)</Label>
                  <EntityCombobox
                    value={directAccountId}
                    onChange={(id) => setDirectAccountId(id)}
                    options={accountOptions}
                    placeholder="Search accounts…"
                    disabled={viewOnly}
                  />
                  <p className="text-xs text-muted-foreground">
                    Select the general ledger account to debit for this payment (e.g. Rent Expenses, Admin Expenses).
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Mode</Label>
                <Select
                  value={paymentMode}
                  onValueChange={setPaymentMode}
                  disabled={viewOnly}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map((m) => (
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
                <Label>Paid From *</Label>
                <Select
                  value={`${paidFromType}:${paidFromId}`}
                  onValueChange={(val) => {
                    const [type, id] = val.split(":");
                    setPaidFromType(type);
                    setPaidFromId(id);
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
                  <Label>Payment Date</Label>
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
                    value={paymentDate}
                    onChange={(adDate) => setPaymentDate(adDate)}
                    className="w-full"
                    disabled={viewOnly}
                  />
                ) : (
                  <Input
                    type="date"
                    value={paymentDate}
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
                  disabled={viewOnly || adjustmentType === "bill_wise"}
                />
                {adjustmentType === "bill_wise" && (
                  <p className="text-xs text-muted-foreground">
                    Auto-calculated from bill allocations
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

        {/* Adjustment Type */}
        {payeeType === "vendor" && vendorId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Adjustment</CardTitle>
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
                    <RadioGroupItem value="bill_wise" id="adj-billwise" />
                    <Label htmlFor="adj-billwise" className="font-normal">
                      Bill-wise Adjustment
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="simple" id="adj-simple" />
                    <Label htmlFor="adj-simple" className="font-normal">
                      Simple Payment
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Running Opening Balance */}
              {vendorBalanceQuery.data && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Opening Balance</p>
                      <p className="font-semibold font-mono">{inr(vendorBalanceQuery.data.opening_balance)}</p>
                      <p className="text-xs text-muted-foreground">{vendorBalanceQuery.data.opening_balance_type === "payable" ? "Payable" : "Receivable"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Net Purchase</p>
                      <p className="font-semibold font-mono text-blue-700">{inr(vendorBalanceQuery.data.net_purchase)}</p>
                      {vendorBalanceQuery.data.total_returns > 0 && (
                        <p className="text-xs text-orange-600">Returns: -{inr(vendorBalanceQuery.data.total_returns)}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Total Paid</p>
                      <p className="font-semibold font-mono text-emerald-700">{inr(vendorBalanceQuery.data.total_paid)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Running Balance</p>
                      <p className={`font-bold font-mono ${vendorBalanceQuery.data.running_balance > 0 ? "text-destructive" : "text-emerald-700"}`}>
                        {inr(vendorBalanceQuery.data.running_balance)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {adjustmentType === "bill_wise" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Select bills to apply payment against:
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addAllBills}
                      disabled={viewOnly || unpaidBillsQuery.isLoading}
                    >
                      Add All
                    </Button>
                  </div>

                  {unpaidBillsQuery.isLoading ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading unpaid bills…
                    </div>
                  ) : unpaidBillsQuery.data?.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      No outstanding bills found for this vendor.
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Bill Number</TableHead>
                            <TableHead className="w-28">Date</TableHead>
                            <TableHead className="w-32 text-right">
                              Total
                            </TableHead>
                            <TableHead className="w-32 text-right">
                              Outstanding
                            </TableHead>
                            <TableHead className="w-32 text-right">
                              Pay Amount
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(unpaidBillsQuery.data ?? []).map((bill) => {
                            const allocation = billAllocations.find(
                              (a) => a.bill_id === bill.id
                            );
                            const payAmount = allocation?.amount_applied ?? 0;

                            return (
                              <TableRow key={bill.id}>
                                <TableCell className="font-medium">
                                  {bill.bill_number ||
                                    bill.internal_bill_number ||
                                    "—"}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {formatDate(bill.invoice_date, dateFormat)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {inr(bill.final_amount)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums font-medium">
                                  {inr(bill.outstanding)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Input
                                    type="number"
                                    value={payAmount || ""}
                                    onChange={(e) =>
                                      updateBillAllocation(
                                        bill.id,
                                        Math.min(
                                          toNumber(e.target.value),
                                          bill.outstanding
                                        )
                                      )
                                    }
                                    placeholder="0"
                                    min={0}
                                    max={bill.outstanding}
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
                  {payeeType === "vendor"
                    ? `Paying: ${vendorOptions.find((o) => o.id === vendorId)?.label ?? "—"}`
                    : `Paying: ${payeeName || "—"}`}
                </p>
                <p className="text-sm text-muted-foreground">
                  Mode:{" "}
                  {PAYMENT_MODES.find((m) => m.value === paymentMode)?.label}
                </p>
                {paidFromId && (
                  <p className="text-sm text-muted-foreground">
                    Paid From: {paidFromOptions.find((o) => o.value === paidFromId)?.label ?? "—"}
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
              Save Payment Voucher
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
