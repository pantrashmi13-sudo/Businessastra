import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen } from "lucide-react";

import { MasterCrudPage } from "@/components/masters/MasterCrudPage";
import { customerSchema, customerFields } from "@/components/masters/schemas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { inr } from "@/lib/format";
import { formatDate } from "@/lib/date-conversion";
import { useDateFormat } from "@/hooks/use-date-format";

export const Route = createFileRoute("/masters/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const [ledgerCustomer, setLedgerCustomer] = useState<{ id: string; name: string } | null>(null);
  const dateFormat = useDateFormat();

  return (
    <>
      <MasterCrudPage
        title="Customers"
        description="People and businesses you sell to."
        table="customers"
        schema={customerSchema}
        fields={customerFields}
        searchKeys={["name", "vat_number", "contact_person", "email"]}
        columns={[
          { key: "name", label: "Name" },
          { key: "vat_number", label: "VAT Number" },
          { key: "contact_person", label: "Contact" },
          { key: "state", label: "State" },
          { key: "phone", label: "Phone" },
        ]}
        rowActions={(row) => (
          <Button
            size="icon"
            variant="ghost"
            title="View Ledger"
            onClick={() =>
              setLedgerCustomer({ id: row.id as string, name: row.name as string })
            }
          >
            <BookOpen className="h-4 w-4" />
          </Button>
        )}
      />

      <Dialog
        open={!!ledgerCustomer}
        onOpenChange={(v) => !v && setLedgerCustomer(null)}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Ledger — {ledgerCustomer?.name}
            </DialogTitle>
          </DialogHeader>
          {ledgerCustomer && (
            <CustomerLedgerContent customerId={ledgerCustomer.id} dateFormat={dateFormat} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function CustomerLedgerContent({
  customerId,
  dateFormat,
}: {
  customerId: string;
  dateFormat: string;
}) {
  // Fetch sales invoices (credit entries — customer owes)
  const invoicesQuery = useQuery({
    queryKey: ["customer-ledger", "invoices", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_invoices" as any)
        .select("id, invoice_number, invoice_date, total_amount, discount, vat_amount")
        .eq("customer_id", customerId)
        .order("invoice_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch receipt vouchers (debit entries — customer paid)
  const receiptsQuery = useQuery({
    queryKey: ["customer-ledger", "receipts", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receipt_vouchers" as any)
        .select("id, voucher_number, receipt_date, total_amount")
        .eq("customer_id", customerId)
        .order("receipt_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch customer opening balance
  const customerQuery = useQuery({
    queryKey: ["customer-opening", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("opening_balance, opening_balance_type")
        .eq("id", customerId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const isLoading = invoicesQuery.isLoading || receiptsQuery.isLoading || customerQuery.isLoading;

  // Build ledger entries: inject opening balance first, then invoices = credit, receipts = debit
  const ledgerEntries = useMemo(() => {
    const entries: Array<{
      id: string;
      date: string;
      description: string;
      debit: number;
      credit: number;
    }> = [];

    // Opening balance row
    const ob = Number(customerQuery.data?.opening_balance ?? 0);
    const obType = customerQuery.data?.opening_balance_type ?? "receivable";
    if (ob > 0) {
      entries.push({
        id: "opening-balance",
        date: "0000-00-00",
        description: "Opening Balance",
        // receivable = customer owes us → credit side (they owe money)
        // payable = we owe them → debit side (advance from customer)
        debit: obType === "payable" ? ob : 0,
        credit: obType === "receivable" ? ob : 0,
      });
    }

    (invoicesQuery.data ?? []).forEach((inv: any) => {
      entries.push({
        id: inv.id,
        date: inv.invoice_date,
        description: `Sales Invoice ${inv.invoice_number}`,
        debit: 0,
        credit: Number(inv.total_amount ?? 0),
      });
    });

    (receiptsQuery.data ?? []).forEach((rv: any) => {
      entries.push({
        id: rv.id,
        date: rv.receipt_date,
        description: `Receipt ${rv.voucher_number}`,
        debit: Number(rv.total_amount ?? 0),
        credit: 0,
      });
    });

    // Sort by date ascending (opening balance stays first with "0000-00-00")
    entries.sort((a, b) => a.date.localeCompare(b.date));
    return entries;
  }, [invoicesQuery.data, receiptsQuery.data, customerQuery.data]);

  // Compute running balance
  const rowsWithBalance = useMemo(() => {
    let balance = 0;
    return ledgerEntries.map((e) => {
      balance += e.debit - e.credit;
      return { ...e, balance };
    });
  }, [ledgerEntries]);

  // Reverse for display (newest first)
  const displayRows = useMemo(() => [...rowsWithBalance].reverse(), [rowsWithBalance]);

  const totalDebit = ledgerEntries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = ledgerEntries.reduce((s, e) => s + e.credit, 0);

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Loading…</div>;
  }

  if (displayRows.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No ledger entries for this customer.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-sm">
        <Badge variant="outline" className="px-3 py-1">
          Total Invoiced: {inr(totalCredit)}
        </Badge>
        <Badge variant="outline" className="px-3 py-1">
          Total Received: {inr(totalDebit)}
        </Badge>
        <Badge
          variant={totalCredit - totalDebit > 0 ? "destructive" : "default"}
          className="px-3 py-1"
        >
          Outstanding: {inr(totalCredit - totalDebit)}
        </Badge>
      </div>

      <div className="rounded-md border">
        <Table className="text-sm">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-28 font-semibold">Date</TableHead>
              <TableHead className="font-semibold">Description</TableHead>
              <TableHead className="w-36 text-right font-semibold">Invoiced (Credit)</TableHead>
              <TableHead className="w-36 text-right font-semibold">Received (Debit)</TableHead>
              <TableHead className="w-36 text-right font-semibold">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.map((r) => (
              <TableRow
                key={r.id}
                className={r.id === "opening-balance" ? "bg-amber-50 font-semibold hover:bg-amber-100" : "hover:bg-muted/30"}
              >
                <TableCell className="text-muted-foreground font-mono text-xs py-2.5">
                  {r.id === "opening-balance" ? "Opening" : formatDate(r.date, dateFormat)}
                </TableCell>
                <TableCell className="font-medium py-2.5">{r.description}</TableCell>
                <TableCell className="text-right tabular-nums font-mono py-2.5">
                  {r.credit > 0 ? inr(r.credit) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums font-mono py-2.5">
                  {r.debit > 0 ? inr(r.debit) : "—"}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums font-mono font-semibold py-2.5 ${
                    r.balance > 0 ? "text-destructive" : ""
                  }`}
                >
                  {inr(r.balance)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
