import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, FileText, Wallet, Building2, CreditCard, Eye, Edit, ArrowRightLeft } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { formatDate } from "@/lib/date-conversion";
import { useDateFormat } from "@/hooks/use-date-format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/cash-bank/")({
  component: CashBankPage,
});

type PettyCashRow = {
  id: string;
  name: string;
  description: string | null;
  opening_balance: number;
  current_balance: number;
  remarks: string | null;
  status: string;
};

type BankAccountRow = {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder_name: string | null;
  branch: string | null;
  opening_balance: number;
  current_balance: number;
  status: string;
};

type LoanRow = {
  id: string;
  loan_type: string;
  loan_name: string;
  principal_amount: number;
  interest_rate: number;
  loan_opening_date: string;
  loan_outstanding: number;
  lender_name: string | null;
  emi_amount: number | null;
  tenure_months: number | null;
  status: string;
};

type TransferRow = {
  id: string;
  transfer_date: string;
  from_type: string;
  from_id: string;
  to_type: string;
  to_id: string;
  amount: number;
  description: string | null;
  reference_number: string | null;
  status: string;
};

function CashBankPage() {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"petty_cash" | "bank" | "loan" | "transfer">("petty_cash");
  const dateFormat = useDateFormat();

  const pettyCashQuery = useQuery({
    queryKey: ["petty-cash-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("petty_cash_accounts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PettyCashRow[];
    },
  });

  const bankAccountsQuery = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BankAccountRow[];
    },
  });

  const loansQuery = useQuery({
    queryKey: ["loans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loans")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LoanRow[];
    },
  });

  const transfersQuery = useQuery({
    queryKey: ["transfers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transfers" as any)
        .select("*")
        .order("transfer_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TransferRow[];
    },
  });

  const getAccountName = (type: string, id: string) => {
    if (type === "petty_cash") {
      const account = pettyCashQuery.data?.find((a) => a.id === id);
      return account ? account.name : "Unknown Petty Cash";
    }
    if (type === "bank") {
      const account = bankAccountsQuery.data?.find((a) => a.id === id);
      return account
        ? `${account.bank_name} (${account.account_number.slice(-4)})`
        : "Unknown Bank Account";
    }
    if (type === "loan") {
      const account = loansQuery.data?.find((a) => a.id === id);
      return account ? account.loan_name : "Unknown Loan";
    }
    return "—";
  };

  const filteredPettyCash = useMemo(() => {
    const list = pettyCashQuery.data ?? [];
    if (!q.trim()) return list;
    const needle = q.toLowerCase();
    return list.filter((r) =>
      [r.name, r.description, r.remarks]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(needle))
    );
  }, [pettyCashQuery.data, q]);

  const filteredBankAccounts = useMemo(() => {
    const list = bankAccountsQuery.data ?? [];
    if (!q.trim()) return list;
    const needle = q.toLowerCase();
    return list.filter((r) =>
      [r.bank_name, r.account_number, r.account_holder_name, r.branch]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(needle))
    );
  }, [bankAccountsQuery.data, q]);

  const filteredLoans = useMemo(() => {
    const list = loansQuery.data ?? [];
    if (!q.trim()) return list;
    const needle = q.toLowerCase();
    return list.filter((r) =>
      [r.loan_name, r.loan_type, r.lender_name]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(needle))
    );
  }, [loansQuery.data, q]);

  const filteredTransfers = useMemo(() => {
    const list = transfersQuery.data ?? [];
    if (!q.trim()) return list;
    const needle = q.toLowerCase();
    return list.filter((r) => {
      const fromName = getAccountName(r.from_type, r.from_id).toLowerCase();
      const toName = getAccountName(r.to_type, r.to_id).toLowerCase();
      return (
        fromName.includes(needle) ||
        toName.includes(needle) ||
        [r.description, r.reference_number, r.from_type, r.to_type]
          .filter(Boolean)
          .some((s) => String(s).toLowerCase().includes(needle))
      );
    });
  }, [transfersQuery.data, pettyCashQuery.data, bankAccountsQuery.data, loansQuery.data, q]);

  const isLoading =
    pettyCashQuery.isLoading ||
    bankAccountsQuery.isLoading ||
    loansQuery.isLoading ||
    transfersQuery.isLoading;

  return (
    <>
      <PageHeader
        title="Cash & Bank"
        description="Manage petty cash, bank accounts, and loans."
        actions={
          <div className="flex gap-2">
            {tab === "petty_cash" && (
              <Button asChild>
                <Link to="/cash-bank/petty-cash/new">
                  <Plus className="mr-2 h-4 w-4" />
                  New Petty Cash
                </Link>
              </Button>
            )}
            {tab === "bank" && (
              <Button asChild>
                <Link to="/cash-bank/bank/new">
                  <Plus className="mr-2 h-4 w-4" />
                  New Bank Account
                </Link>
              </Button>
            )}
            {tab === "loan" && (
              <Button asChild>
                <Link to="/cash-bank/loan/new">
                  <Plus className="mr-2 h-4 w-4" />
                  New Loan
                </Link>
              </Button>
            )}
            {tab === "transfer" && (
              <Button asChild>
                <Link to="/cash-bank/transfer/new">
                  <Plus className="mr-2 h-4 w-4" />
                  New Transfer
                </Link>
              </Button>
            )}
          </div>
        }
      />
      <div className="space-y-4 p-6">
        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="petty_cash" className="gap-2">
              <Wallet className="h-4 w-4" />
              Petty Cash
            </TabsTrigger>
            <TabsTrigger value="bank" className="gap-2">
              <Building2 className="h-4 w-4" />
              Bank
            </TabsTrigger>
            <TabsTrigger value="loan" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Loan
            </TabsTrigger>
            <TabsTrigger value="transfer" className="gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Transfers
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search */}
        <Input
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />

        {/* Petty Cash Table */}
        {tab === "petty_cash" && (
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Opening Balance</TableHead>
                  <TableHead className="text-right">Current Balance</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : filteredPettyCash.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
                      No petty cash accounts found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPettyCash.map((pc) => (
                    <TableRow key={pc.id}>
                      <TableCell className="font-medium">{pc.name}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {pc.description || "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {inr(pc.opening_balance)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {inr(pc.current_balance)}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[150px] truncate">
                        {pc.remarks || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={pc.status === "active" ? "default" : "secondary"}>
                          {pc.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link
                              to="/cash-bank/petty-cash/$id"
                              params={{ id: pc.id }}
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <Link
                              to="/cash-bank/petty-cash/$id/edit"
                              params={{ id: pc.id }}
                            >
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Bank Accounts Table */}
        {tab === "bank" && (
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bank Name</TableHead>
                  <TableHead>Account Number</TableHead>
                  <TableHead>Account Holder</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead className="text-right">Opening Balance</TableHead>
                  <TableHead className="text-right">Current Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : filteredBankAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
                      No bank accounts found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBankAccounts.map((bank) => (
                    <TableRow key={bank.id}>
                      <TableCell className="font-medium">{bank.bank_name}</TableCell>
                      <TableCell className="font-mono">{bank.account_number}</TableCell>
                      <TableCell>{bank.account_holder_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{bank.branch || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {inr(bank.opening_balance)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {inr(bank.current_balance)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={bank.status === "active" ? "default" : "secondary"}>
                          {bank.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link
                              to="/cash-bank/bank/$id"
                              params={{ id: bank.id }}
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <Link
                              to="/cash-bank/bank/$id/edit"
                              params={{ id: bank.id }}
                            >
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Loans Table */}
        {tab === "loan" && (
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loan Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Lender</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Interest Rate</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : filteredLoans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
                      No loans found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLoans.map((loan) => (
                    <TableRow key={loan.id}>
                      <TableCell className="font-medium">{loan.loan_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {loan.loan_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{loan.lender_name || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {inr(loan.principal_amount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {loan.interest_rate}%
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {inr(loan.loan_outstanding)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={loan.status === "active" ? "default" : "secondary"}>
                          {loan.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link
                              to="/cash-bank/loan/$id"
                              params={{ id: loan.id }}
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <Link
                              to="/cash-bank/loan/$id/edit"
                              params={{ id: loan.id }}
                            >
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Transfers Table */}
        {tab === "transfer" && (
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Date</TableHead>
                  <TableHead>From Account</TableHead>
                  <TableHead>To Account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Ref Number</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : filteredTransfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
                      No transfers found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransfers.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-muted-foreground">
                        {formatDate(t.transfer_date, dateFormat)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {getAccountName(t.from_type, t.from_id)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {getAccountName(t.to_type, t.to_id)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {inr(t.amount)}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {t.description || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {t.reference_number || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.status === "final" ? "default" : "secondary"} className="capitalize">
                          {t.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}
