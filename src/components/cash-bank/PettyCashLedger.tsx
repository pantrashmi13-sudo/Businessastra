import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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

interface PettyCashLedgerProps {
  pettyCashId: string;
}

type LedgerEntry = {
  id: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  reference_type: string | null;
  reference_id: string | null;
};

export function PettyCashLedger({ pettyCashId }: PettyCashLedgerProps) {
  const [q, setQ] = useState("");
  const dateFormat = useDateFormat();

  const { data: entries, isLoading } = useQuery({
    queryKey: ["petty-cash-ledger", pettyCashId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("petty_cash_ledger")
        .select("*")
        .eq("petty_cash_id", pettyCashId)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LedgerEntry[];
    },
    enabled: !!pettyCashId,
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
  const balance = totalDebit - totalCredit;

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
          Balance: <span className="font-medium text-foreground">{inr(balance)}</span>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-32">Reference</TableHead>
              <TableHead className="w-32 text-right">Debit</TableHead>
              <TableHead className="w-32 text-right">Credit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  No ledger entries found.
                </TableCell>
              </TableRow>
            ) : (
              filteredEntries.map((entry) => (
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
