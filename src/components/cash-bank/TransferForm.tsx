import { useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { BsDatePicker } from "@/components/ui/bs-date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inr } from "@/lib/format";

interface AccountOption {
  id: string;
  name: string;
  type: "petty_cash" | "bank" | "loan";
  balance: number;
  displayLabel: string;
}

export function TransferForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [fromAccountId, setFromAccountId] = useState<string>("");
  const [toAccountId, setToAccountId] = useState<string>("");
  const [transferDate, setTransferDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [amount, setAmount] = useState<number>(0);
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  // Fetch accounts
  const pettyCashQuery = useQuery({
    queryKey: ["petty-cash-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("petty_cash_accounts")
        .select("*")
        .eq("status", "active")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const bankAccountsQuery = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("status", "active")
        .order("bank_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const loansQuery = useQuery({
    queryKey: ["loans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loans")
        .select("*")
        .eq("status", "active")
        .order("loan_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Combine into single options array
  const options = useMemo<AccountOption[]>(() => {
    const list: AccountOption[] = [];

    (pettyCashQuery.data ?? []).forEach((pc) => {
      list.push({
        id: pc.id,
        name: pc.name,
        type: "petty_cash",
        balance: Number(pc.current_balance),
        displayLabel: `[Petty Cash] ${pc.name} (Bal: ${inr(pc.current_balance)})`,
      });
    });

    (bankAccountsQuery.data ?? []).forEach((bank) => {
      list.push({
        id: bank.id,
        name: `${bank.bank_name} (${bank.account_number.slice(-4)})`,
        type: "bank",
        balance: Number(bank.current_balance),
        displayLabel: `[Bank] ${bank.bank_name} - ...${bank.account_number.slice(-4)} (Bal: ${inr(bank.current_balance)})`,
      });
    });

    (loansQuery.data ?? []).forEach((loan) => {
      list.push({
        id: loan.id,
        name: loan.loan_name,
        type: "loan",
        balance: Number(loan.loan_outstanding),
        displayLabel: `[Loan] ${loan.loan_name} (Outstanding: ${inr(loan.loan_outstanding)})`,
      });
    });

    return list;
  }, [pettyCashQuery.data, bankAccountsQuery.data, loansQuery.data]);

  const selectedFromAccount = useMemo(() => {
    return options.find((opt) => opt.id === fromAccountId);
  }, [options, fromAccountId]);

  const balanceError = useMemo(() => {
    if (!selectedFromAccount) return null;
    if (selectedFromAccount.type !== "loan" && amount > selectedFromAccount.balance) {
      return `Insufficient balance. Available: ${inr(selectedFromAccount.balance)}`;
    }
    return null;
  }, [selectedFromAccount, amount]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!fromAccountId || !toAccountId) {
        throw new Error("Please select both From and To accounts.");
      }
      if (fromAccountId === toAccountId) {
        throw new Error("Source and destination accounts must be different.");
      }
      if (amount <= 0) {
        throw new Error("Amount must be greater than zero.");
      }

      const fromAccount = options.find((o) => o.id === fromAccountId);
      const toAccount = options.find((o) => o.id === toAccountId);

      if (!fromAccount || !toAccount) {
        throw new Error("Selected account not found.");
      }

      if (fromAccount.type !== "loan" && amount > fromAccount.balance) {
        throw new Error(`Insufficient balance in ${fromAccount.name}. Available: ${inr(fromAccount.balance)}`);
      }

      // Get current company context
      const { data: companies } = await supabase
        .from("companies")
        .select("id, is_default");
      const activeCompany = companies?.find((c) => c.is_default) ?? companies?.[0];
      const companyId = activeCompany?.id ?? null;

      if (!companyId) {
        throw new Error("No active company found. Please configure a company in Masters first.");
      }

      // 1. Insert transfer transaction
      const { data: transfer, error: transferErr } = await supabase
        .from("transfers")
        .insert({
          company_id: companyId,
          transfer_date: transferDate,
          from_type: fromAccount.type,
          from_id: fromAccountId,
          to_type: toAccount.type,
          to_id: toAccountId,
          amount: amount,
          description: description.trim() || null,
          reference_number: referenceNumber.trim() || null,
          status: "final",
        })
        .select()
        .single();

      if (transferErr) throw transferErr;

      // 2. Update source account balance
      if (fromAccount.type === "petty_cash") {
        const { error } = await supabase
          .from("petty_cash_accounts")
          .update({ current_balance: fromAccount.balance - amount })
          .eq("id", fromAccountId);
        if (error) throw error;
      } else if (fromAccount.type === "bank") {
        const { error } = await supabase
          .from("bank_accounts")
          .update({ current_balance: fromAccount.balance - amount })
          .eq("id", fromAccountId);
        if (error) throw error;
      } else if (fromAccount.type === "loan") {
        const { error } = await supabase
          .from("loans")
          .update({ loan_outstanding: fromAccount.balance + amount }) // drawdown increases debt
          .eq("id", fromAccountId);
        if (error) throw error;
      }

      // 3. Update destination account balance
      if (toAccount.type === "petty_cash") {
        const { error } = await supabase
          .from("petty_cash_accounts")
          .update({ current_balance: toAccount.balance + amount })
          .eq("id", toAccountId);
        if (error) throw error;
      } else if (toAccount.type === "bank") {
        const { error } = await supabase
          .from("bank_accounts")
          .update({ current_balance: toAccount.balance + amount })
          .eq("id", toAccountId);
        if (error) throw error;
      } else if (toAccount.type === "loan") {
        const { error } = await supabase
          .from("loans")
          .update({ loan_outstanding: toAccount.balance - amount }) // repayment reduces debt
          .eq("id", toAccountId);
        if (error) throw error;
      }

      // 4. Post double-entry ledger: source account
      const fromDescription = `Transfer to ${toAccount.name}${description ? " - " + description : ""}`;
      if (fromAccount.type === "petty_cash") {
        const { error } = await supabase.from("petty_cash_ledger").insert({
          petty_cash_id: fromAccountId,
          date: transferDate,
          description: fromDescription,
          debit: 0,
          credit: amount,
          reference_type: "transfer",
          reference_id: transfer.id,
        });
        if (error) throw error;
      } else if (fromAccount.type === "bank") {
        const { error } = await supabase.from("bank_ledger").insert({
          bank_account_id: fromAccountId,
          date: transferDate,
          description: fromDescription,
          debit: 0,
          credit: amount,
          reference_type: "transfer",
          reference_id: transfer.id,
        });
        if (error) throw error;
      } else if (fromAccount.type === "loan") {
        const { error } = await supabase.from("loan_ledger").insert({
          loan_id: fromAccountId,
          date: transferDate,
          description: `Drawdown: ${fromDescription}`,
          debit: amount, // increases outstanding debt in ledger formula
          credit: 0,
          principal_amount: amount,
          interest_amount: 0,
          reference_type: "transfer",
          reference_id: transfer.id,
        });
        if (error) throw error;
      }

      // 5. Post double-entry ledger: destination account
      const toDescription = `Transfer from ${fromAccount.name}${description ? " - " + description : ""}`;
      if (toAccount.type === "petty_cash") {
        const { error } = await supabase.from("petty_cash_ledger").insert({
          petty_cash_id: toAccountId,
          date: transferDate,
          description: toDescription,
          debit: amount,
          credit: 0,
          reference_type: "transfer",
          reference_id: transfer.id,
        });
        if (error) throw error;
      } else if (toAccount.type === "bank") {
        const { error } = await supabase.from("bank_ledger").insert({
          bank_account_id: toAccountId,
          date: transferDate,
          description: toDescription,
          debit: amount,
          credit: 0,
          reference_type: "transfer",
          reference_id: transfer.id,
        });
        if (error) throw error;
      } else if (toAccount.type === "loan") {
        const { error } = await supabase.from("loan_ledger").insert({
          loan_id: toAccountId,
          date: transferDate,
          description: `Repayment: ${toDescription}`,
          debit: 0,
          credit: amount, // decreases outstanding debt in ledger formula
          principal_amount: amount,
          interest_amount: 0,
          reference_type: "transfer",
          reference_id: transfer.id,
        });
        if (error) throw error;
      }

      return transfer;
    },
    onSuccess: () => {
      toast.success("Transfer completed successfully");
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["petty-cash-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      navigate({ to: "/cash-bank" });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const isLoading =
    pettyCashQuery.isLoading || bankAccountsQuery.isLoading || loansQuery.isLoading;

  return (
    <>
      <PageHeader
        title="New Transfer"
        description="Transfer funds between petty cash, bank accounts, or loans."
      />
      <div className="space-y-4 p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="from_account">From Account *</Label>
                <Select value={fromAccountId} onValueChange={setFromAccountId}>
                  <SelectTrigger id="from_account">
                    <SelectValue placeholder={isLoading ? "Loading accounts..." : "Select source account"} />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.displayLabel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="to_account">To Account *</Label>
                <Select value={toAccountId} onValueChange={setToAccountId} disabled={!fromAccountId}>
                  <SelectTrigger id="to_account">
                    <SelectValue placeholder="Select destination account" />
                  </SelectTrigger>
                  <SelectContent>
                    {options
                      .filter((opt) => opt.id !== fromAccountId)
                      .map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>
                          {opt.displayLabel}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="transfer_date">Transfer Date *</Label>
                <BsDatePicker
                  value={transferDate}
                  onChange={(v) => setTransferDate(v)}
                  placeholder="Select date"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  value={amount || ""}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  min={0.01}
                  step={0.01}
                />
                {balanceError && (
                  <p className="text-xs font-medium text-destructive mt-1">{balanceError}</p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="reference_number">Reference Number / Txn ID</Label>
                <Input
                  id="reference_number"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g., Bank Txn ID, Cheque number, etc."
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Additional transfer details..."
                  rows={3}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: "/cash-bank" })}
          >
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={
              saveMutation.isPending ||
              !fromAccountId ||
              !toAccountId ||
              amount <= 0 ||
              !!balanceError
            }
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              "Save Transfer"
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
