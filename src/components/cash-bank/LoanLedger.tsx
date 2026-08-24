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

interface LoanLedgerProps {
  loanId: string;
  openingOutstanding?: number;
}

type LedgerEntry = {
  id: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  interest_amount: number;
  principal_amount: number;
  reference_type: string | null;
  reference_id: string | null;
  reconciled: boolean;
};

type Loan = {
  id: string;
  principal_amount: number;
  loan_outstanding: number;
};

export function LoanLedger({ loanId, openingOutstanding: propOpeningOutstanding }: LoanLedgerProps) {
  const [q, setQ] = useState("");
  const dateFormat = useDateFormat();
  const qc = useQueryClient();

  const { data: loan } = useQuery({
    queryKey: ["loan", loanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loans" as any)
        .select("id, principal_amount, loan_outstanding")
        .eq("id", loanId)
        .single();
      if (error) throw error;
      return data as unknown as Loan;
    },
    enabled: !!loanId,
  });

  const openingOutstanding = propOpeningOutstanding ?? Number(loan?.loan_outstanding ?? 0);

  const { data: entries, isLoading } = useQuery({
    queryKey: ["loan-ledger", loanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_ledger" as any)
        .select("*")
        .eq("loan_id", loanId)
        .order("date", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as LedgerEntry[];
    },
    enabled: !!loanId,
  });

  const toggleReconciled = useMutation({
    mutationFn: async ({ id, reconciled }: { id: string; reconciled: boolean }) => {
      const { error } = await supabase
        .from("loan_ledger" as any)
        .update({ reconciled })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loan-ledger", loanId] });
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

  const totalPrincipal = filteredEntries.reduce((s, e) => s + Number(e.principal_amount || 0), 0);
  const totalInterest = filteredEntries.reduce((s, e) => s + Number(e.interest_amount || 0), 0);
  const totalDebit = filteredEntries.reduce((s, e) => s + Number(e.debit), 0);
  const totalCredit = filteredEntries.reduce((s, e) => s + Number(e.credit), 0);
  const closingOutstanding = openingOutstanding - totalPrincipal;

  const entriesWithBalance = useMemo(() => {
    let running = openingOutstanding;
    return filteredEntries.map((entry) => {
      const principal = Number(entry.principal_amount || 0);
      running = running - principal;
      return { ...entry, running_balance: running };
    });
  }, [filteredEntries, openingOutstanding]);

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
          Outstanding: <span className="font-medium text-foreground">{inr(closingOutstanding)}</span>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-28">Reference</TableHead>
              <TableHead className="w-28 text-right">Principal</TableHead>
              <TableHead className="w-28 text-right">Interest</TableHead>
              <TableHead className="w-28 text-right">Debit</TableHead>
              <TableHead className="w-28 text-right">Credit</TableHead>
              <TableHead className="w-28 text-right">Outstanding</TableHead>
              <TableHead className="w-20 text-center">Reconciled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  No ledger entries found.
                </TableCell>
              </TableRow>
            ) : (
              <>
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={6} className="text-muted-foreground">Opening Outstanding</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{inr(openingOutstanding)}</TableCell>
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
                      {Number(entry.principal_amount) > 0 ? inr(entry.principal_amount) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-amber-600">
                      {Number(entry.interest_amount) > 0 ? inr(entry.interest_amount) : "—"}
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
                  <TableCell colSpan={2}>Totals</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right tabular-nums">{inr(totalPrincipal)}</TableCell>
                  <TableCell className="text-right tabular-nums text-amber-600">{inr(totalInterest)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(totalDebit)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(totalCredit)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(closingOutstanding)}</TableCell>
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
