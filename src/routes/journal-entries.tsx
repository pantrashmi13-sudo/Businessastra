import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/use-company";
import { formatDate } from "@/lib/date-conversion";
import { useDateFormat } from "@/hooks/use-date-format";
import { inr } from "@/lib/format";
import {
  ScrollText,
  Search,
  X,
  ExternalLink,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/journal-entries")({
  component: JournalEntriesPage,
});

type JournalLine = {
  id: string;
  account_id: string;
  debit: number;
  credit: number;
  narration: string | null;
  account: {
    name: string;
    code: string | null;
    coa: { name: string; account_code: string };
  } | null;
};

type JournalEntry = {
  id: string;
  date: string;
  voucher_number: string;
  narration: string | null;
  source_type: string;
  source_id: string | null;
  created_at: string;
  lines: JournalLine[];
};

const SOURCE_LABELS: Record<string, string> = {
  sales_invoice: "Sales Invoice",
  bill: "Purchase Bill",
  receipt_voucher: "Receipt",
  payment_voucher: "Payment",
  manual: "Manual",
};

const SOURCE_COLORS: Record<string, string> = {
  sales_invoice: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  bill: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  receipt_voucher: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  payment_voucher: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  manual: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

function JournalEntryRow({
  entry,
  dateFormat,
}: {
  entry: JournalEntry;
  dateFormat: string;
}) {
  const [open, setOpen] = useState(false);
  const totalDebit = entry.lines.reduce((s, l) => s + Number(l.debit), 0);
  const totalCredit = entry.lines.reduce((s, l) => s + Number(l.credit), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/40"
        onClick={() => setOpen((o) => !o)}
      >
        <TableCell className="w-8">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="font-mono text-xs">
          {entry.voucher_number}
        </TableCell>
        <TableCell className="text-xs">
          {formatDate(entry.date, dateFormat)}
        </TableCell>
        <TableCell>
          <Badge
            variant="outline"
            className={`text-[11px] px-1.5 py-0 h-5 ${SOURCE_COLORS[entry.source_type] ?? ""}`}
          >
            {SOURCE_LABELS[entry.source_type] ?? entry.source_type}
          </Badge>
        </TableCell>
        <TableCell className="text-xs max-w-[200px] truncate text-muted-foreground">
          {entry.narration ?? "—"}
        </TableCell>
        <TableCell className="text-right text-xs font-mono">
          {inr(totalDebit)}
        </TableCell>
        <TableCell className="text-right text-xs font-mono">
          {inr(totalCredit)}
        </TableCell>
        <TableCell className="text-center">
          {isBalanced ? (
            <Badge
              variant="outline"
              className="text-[10px] px-1 py-0 h-4 bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            >
              Balanced
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-[10px] px-1 py-0 h-4 bg-rose-500/10 text-rose-400 border-rose-500/20"
            >
              Unbalanced
            </Badge>
          )}
        </TableCell>
      </TableRow>

      {open && (
        <TableRow>
          <TableCell colSpan={8} className="p-0 bg-muted/20">
            <div className="px-6 py-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left pb-1.5 font-medium">Account</th>
                    <th className="text-left pb-1.5 font-medium">Schedule Head</th>
                    <th className="text-left pb-1.5 font-medium">Narration</th>
                    <th className="text-right pb-1.5 font-medium">Debit</th>
                    <th className="text-right pb-1.5 font-medium">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {entry.lines.map((line) => (
                    <tr key={line.id} className="border-b border-border/40">
                      <td className="py-1.5 font-medium">
                        {line.account?.name ?? "Unknown"}
                        {line.account?.code && (
                          <span className="ml-1 text-muted-foreground/60">
                            [{line.account.code}]
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 text-muted-foreground">
                        {line.account?.coa?.name ?? "—"}
                        <span className="ml-1 text-muted-foreground/50">
                          [{line.account?.coa?.account_code}]
                        </span>
                      </td>
                      <td className="py-1.5 text-muted-foreground">
                        {line.narration ?? "—"}
                      </td>
                      <td className="py-1.5 text-right font-mono">
                        {line.debit > 0 ? inr(line.debit) : "—"}
                      </td>
                      <td className="py-1.5 text-right font-mono">
                        {line.credit > 0 ? inr(line.credit) : "—"}
                      </td>
                    </tr>
                  ))}
                  <tr className="font-semibold text-foreground">
                    <td colSpan={3} className="pt-2 text-xs uppercase tracking-wider text-muted-foreground">
                      Total
                    </td>
                    <td className="pt-2 text-right font-mono">
                      {inr(totalDebit)}
                    </td>
                    <td className="pt-2 text-right font-mono">
                      {inr(totalCredit)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function JournalEntriesPage() {
  const { company } = useCompany();
  const dateFormat = useDateFormat();
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const { data: entries = [], isLoading } = useQuery<JournalEntry[]>({
    queryKey: ["journal_entries", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_entries")
        .select(
          `id, date, voucher_number, narration, source_type, source_id, created_at,
           lines:journal_lines(
             id, account_id, debit, credit, narration,
             account:accounts(name, code, coa:chart_of_accounts(name, account_code))
           )`
        )
        .eq("company_id", company!.id)
        .order("date", { ascending: false })
        .order("voucher_number", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as JournalEntry[];
    },
  });

  const filtered = useMemo(() => {
    let list = entries;
    if (sourceFilter !== "all") {
      list = list.filter((e) => e.source_type === sourceFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.voucher_number.toLowerCase().includes(q) ||
          e.narration?.toLowerCase().includes(q) ||
          e.lines.some((l) => l.account?.name.toLowerCase().includes(q))
      );
    }
    return list;
  }, [entries, search, sourceFilter]);

  const totalDebit = filtered.reduce(
    (s, e) => s + e.lines.reduce((a, l) => a + Number(l.debit), 0),
    0
  );
  const totalCredit = filtered.reduce(
    (s, e) => s + e.lines.reduce((a, l) => a + Number(l.credit), 0),
    0
  );

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <ScrollText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Journal Entries</h1>
          <p className="text-xs text-muted-foreground">
            {filtered.length} entries · Dr {inr(totalDebit)} · Cr{" "}
            {inr(totalCredit)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search voucher, narration, account..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {Object.entries(SOURCE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20 hover:bg-muted/20">
              <TableHead className="w-8" />
              <TableHead className="text-xs">Voucher No.</TableHead>
              <TableHead className="text-xs">Date</TableHead>
              <TableHead className="text-xs">Source</TableHead>
              <TableHead className="text-xs">Narration</TableHead>
              <TableHead className="text-xs text-right">Debit</TableHead>
              <TableHead className="text-xs text-right">Credit</TableHead>
              <TableHead className="text-xs text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                  Loading journal entries...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                  {search || sourceFilter !== "all"
                    ? "No matching entries found."
                    : "No journal entries yet. They will appear here once you post invoices, bills, receipts or payments."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((entry) => (
                <JournalEntryRow
                  key={entry.id}
                  entry={entry}
                  dateFormat={dateFormat}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
