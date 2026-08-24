import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/use-company";
import { formatDate } from "@/lib/date-conversion";
import { useDateFormat } from "@/hooks/use-date-format";
import { inr } from "@/lib/format";
import { ClipboardList, Search, X, ChevronsUpDown } from "lucide-react";
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

export const Route = createFileRoute("/general-ledger")({
  component: GeneralLedgerPage,
});

type LedgerLine = {
  id: string;
  journal_entry_id: string;
  debit: number;
  credit: number;
  narration: string | null;
  journal_entry: {
    date: string;
    voucher_number: string;
    source_type: string;
    narration: string | null;
  } | null;
};

type AccountWithLines = {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
  coa: {
    name: string;
    account_code: string;
    classification: string;
    type: string;
    normal_balance: string;
  } | null;
  lines: LedgerLine[];
};

const SOURCE_LABELS: Record<string, string> = {
  sales_invoice: "SI",
  bill: "PB",
  receipt_voucher: "RV",
  payment_voucher: "PV",
  manual: "JV",
};

const SOURCE_COLORS: Record<string, string> = {
  sales_invoice: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  bill: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  receipt_voucher: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  payment_voucher: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  manual: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

function AccountLedger({
  account,
  dateFormat,
}: {
  account: AccountWithLines;
  dateFormat: string;
}) {
  const lines = [...account.lines].sort(
    (a, b) =>
      new Date(a.journal_entry?.date ?? "").getTime() -
      new Date(b.journal_entry?.date ?? "").getTime()
  );

  const isDebitNormal = account.coa?.normal_balance === "Debit";
  let runningBalance = 0;

  const rows = lines.map((line) => {
    const dr = Number(line.debit);
    const cr = Number(line.credit);
    runningBalance += isDebitNormal ? dr - cr : cr - dr;
    return { line, dr, cr, balance: runningBalance };
  });

  const totalDr = rows.reduce((s, r) => s + r.dr, 0);
  const totalCr = rows.reduce((s, r) => s + r.cr, 0);
  const finalBalance = rows.at(-1)?.balance ?? 0;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Account Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/20">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{account.name}</span>
            {account.code && (
              <span className="text-xs text-muted-foreground/60">
                [{account.code}]
              </span>
            )}
            {!account.is_active && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                Inactive
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {account.coa?.classification} → {account.coa?.type} →{" "}
            {account.coa?.name} [{account.coa?.account_code}]
          </div>
        </div>
        <div className="ml-auto flex items-center gap-4 text-xs">
          <div className="text-right">
            <div className="text-muted-foreground">Total Debit</div>
            <div className="font-mono font-semibold">{inr(totalDr)}</div>
          </div>
          <div className="text-right">
            <div className="text-muted-foreground">Total Credit</div>
            <div className="font-mono font-semibold">{inr(totalCr)}</div>
          </div>
          <div className="text-right">
            <div className="text-muted-foreground">
              Closing Balance ({account.coa?.normal_balance})
            </div>
            <div
              className={`font-mono font-bold ${finalBalance >= 0 ? "text-foreground" : "text-rose-400"}`}
            >
              {inr(Math.abs(finalBalance))}
              {finalBalance < 0 && " (Cr)"}
            </div>
          </div>
        </div>
      </div>

      {lines.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          No postings yet.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs w-24">Date</TableHead>
              <TableHead className="text-xs w-28">Voucher</TableHead>
              <TableHead className="text-xs w-12">Type</TableHead>
              <TableHead className="text-xs">Narration</TableHead>
              <TableHead className="text-xs text-right w-28">Debit</TableHead>
              <TableHead className="text-xs text-right w-28">Credit</TableHead>
              <TableHead className="text-xs text-right w-32">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ line, dr, cr, balance }) => (
              <TableRow key={line.id} className="text-xs">
                <TableCell className="py-1.5">
                  {line.journal_entry?.date
                    ? formatDate(line.journal_entry.date, dateFormat)
                    : "—"}
                </TableCell>
                <TableCell className="py-1.5 font-mono text-[11px]">
                  {line.journal_entry?.voucher_number ?? "—"}
                </TableCell>
                <TableCell className="py-1.5">
                  {line.journal_entry?.source_type && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1 py-0 h-4 ${SOURCE_COLORS[line.journal_entry.source_type] ?? ""}`}
                    >
                      {SOURCE_LABELS[line.journal_entry.source_type] ??
                        line.journal_entry.source_type}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="py-1.5 text-muted-foreground max-w-[220px] truncate">
                  {line.narration ??
                    line.journal_entry?.narration ??
                    "—"}
                </TableCell>
                <TableCell className="py-1.5 text-right font-mono">
                  {dr > 0 ? inr(dr) : "—"}
                </TableCell>
                <TableCell className="py-1.5 text-right font-mono">
                  {cr > 0 ? inr(cr) : "—"}
                </TableCell>
                <TableCell
                  className={`py-1.5 text-right font-mono font-medium ${balance < 0 ? "text-rose-400" : ""}`}
                >
                  {inr(Math.abs(balance))}
                  {balance < 0 && " Cr"}
                </TableCell>
              </TableRow>
            ))}
            {/* Totals row */}
            <TableRow className="bg-muted/20 font-semibold hover:bg-muted/20">
              <TableCell colSpan={4} className="py-1.5 text-xs">
                Totals
              </TableCell>
              <TableCell className="py-1.5 text-right font-mono text-xs">
                {inr(totalDr)}
              </TableCell>
              <TableCell className="py-1.5 text-right font-mono text-xs">
                {inr(totalCr)}
              </TableCell>
              <TableCell
                className={`py-1.5 text-right font-mono text-xs font-bold ${finalBalance < 0 ? "text-rose-400" : ""}`}
              >
                {inr(Math.abs(finalBalance))}
                {finalBalance < 0 && " Cr"}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function GeneralLedgerPage() {
  const { company } = useCompany();
  const dateFormat = useDateFormat();
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");

  const { data: accounts = [], isLoading } = useQuery<AccountWithLines[]>({
    queryKey: ["general_ledger", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select(
          `id, name, code, is_active,
           coa:chart_of_accounts(name, account_code, classification, type, normal_balance),
           lines:journal_lines(
             id, journal_entry_id, debit, credit, narration,
             journal_entry:journal_entries(date, voucher_number, source_type, narration)
           )`
        )
        .eq("company_id", company!.id)
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as AccountWithLines[];
    },
  });

  const classifications = useMemo(() => {
    const set = new Set(accounts.map((a) => a.coa?.classification ?? "Other"));
    return Array.from(set).sort();
  }, [accounts]);

  const filtered = useMemo(() => {
    let list = accounts;
    if (classFilter !== "all") {
      list = list.filter((a) => a.coa?.classification === classFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.code?.toLowerCase().includes(q) ||
          a.coa?.name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [accounts, search, classFilter]);

  const accountsWithPostings = filtered.filter((a) => a.lines.length > 0);
  const accountsWithoutPostings = filtered.filter((a) => a.lines.length === 0);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <ClipboardList className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">General Ledger</h1>
          <p className="text-xs text-muted-foreground">
            {accountsWithPostings.length} accounts with postings ·{" "}
            {accountsWithoutPostings.length} without postings
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by account name or code..."
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
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Classifications" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classifications</SelectItem>
            {classifications.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">
          Loading ledger...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-sm text-muted-foreground">
          {search || classFilter !== "all"
            ? "No matching accounts found."
            : "No accounts found. Create accounts in the Chart of Accounts."}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Accounts with postings */}
          {accountsWithPostings.map((account) => (
            <AccountLedger
              key={account.id}
              account={account}
              dateFormat={dateFormat}
            />
          ))}

          {/* Accounts without postings (collapsed section) */}
          {accountsWithoutPostings.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer list-none flex items-center gap-2 text-xs text-muted-foreground py-2 hover:text-foreground transition-colors">
                <ChevronsUpDown className="h-3.5 w-3.5" />
                {accountsWithoutPostings.length} account
                {accountsWithoutPostings.length > 1 ? "s" : ""} with no
                postings
              </summary>
              <div className="mt-2 space-y-2 pl-4">
                {accountsWithoutPostings.map((account) => (
                  <AccountLedger
                    key={account.id}
                    account={account}
                    dateFormat={dateFormat}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
