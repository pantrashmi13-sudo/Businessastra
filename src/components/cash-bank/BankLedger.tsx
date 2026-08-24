import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/date-conversion";
import { useDateFormat } from "@/hooks/use-date-format";
import { inr } from "@/lib/format";
import { toast } from "sonner";

interface BankLedgerProps {
  bankAccountId: string;
  openingBalance?: number;
}

type LedgerEntry = {
  id: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  reference_type: string | null;
  reference_id: string | null;
  reconciled: boolean;
};

type BankAccount = {
  id: string;
  opening_balance: number;
  current_balance: number;
};

export function BankLedger({ bankAccountId, openingBalance: propOpeningBalance }: BankLedgerProps) {
  const [q, setQ] = useState("");
  const dateFormat = useDateFormat();
  const qc = useQueryClient();

  const { data: account } = useQuery({
    queryKey: ["bank-account", bankAccountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts" as any)
        .select("id, opening_balance, current_balance")
        .eq("id", bankAccountId)
        .single();
      if (error) throw error;
      return data as unknown as BankAccount;
    },
    enabled: !!bankAccountId,
  });

  const openingBalance = propOpeningBalance ?? Number(account?.opening_balance ?? 0);

  const { data: entries, isLoading } = useQuery({
    queryKey: ["bank-ledger", bankAccountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_ledger" as any)
        .select("*")
        .eq("bank_account_id", bankAccountId)
        .order("date", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as LedgerEntry[];
    },
    enabled: !!bankAccountId,
  });

  const toggleReconciled = useMutation({
    mutationFn: async ({ id, reconciled }: { id: string; reconciled: boolean }) => {
      const { error } = await supabase
        .from("bank_ledger" as any)
        .update({ reconciled })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank-ledger", bankAccountId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const filteredEntries = useMemo(() => {
    if (!entries) return [];
    if (!q.trim()) return entries;
    const needle = q.toLowerCase();
    return entries.filter((e) =>
      [e.description, e.reference_type]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(needle))
    );
  }, [entries, q]);

  const totalDebit = filteredEntries.reduce((s, e) => s + Number(e.debit), 0);
  const totalCredit = filteredEntries.reduce((s, e) => s + Number(e.credit), 0);
  const closingBalance = openingBalance + totalDebit - totalCredit;

  const entriesWithBalance = useMemo(() => {
    let running = openingBalance;
    return filteredEntries.map((entry) => {
      const debit = Number(entry.debit);
      const credit = Number(entry.credit);
      running = running + debit - credit;
      return { ...entry, running_balance: running };
    });
  }, [filteredEntries, openingBalance]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search ledger…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
        <div className="ml-auto text-sm text-muted-foreground">
          Closing: <span className="font-medium text-foreground">{inr(closingBalance)}</span>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-28">Reference</TableHead>
              <TableHead className="w-28 text-right">Debit</TableHead>
              <TableHead className="w-28 text-right">Credit</TableHead>
              <TableHead className="w-28 text-right">Balance</TableHead>
              <TableHead className="w-20 text-center">Reconciled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  No ledger entries found.
                </TableCell>
              </TableRow>
            ) : (
              <>
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={4} className="text-muted-foreground">Opening Balance</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{inr(openingBalance)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
                {entriesWithBalance.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-muted-foreground">
                      {formatDate(entry.date, dateFormat)}
                    </TableCell>
                    <TableCell>{entry.description}</TableCell>
                    <TableCell>
                      {entry.reference_type && (
                        <Badge variant="outline" className="text-xs">
                          {entry.reference_type}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(entry.debit) > 0 ? inr(entry.debit) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(entry.credit) > 0 ? inr(entry.credit) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {inr(entry.running_balance)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={entry.reconciled}
                        onCheckedChange={(checked) =>
                          toggleReconciled.mutate({ id: entry.id, reconciled: !!checked })
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30 font-semibold">
                  <TableCell colSpan={3}>Closing Balance</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(totalDebit)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(totalCredit)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(closingBalance)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
