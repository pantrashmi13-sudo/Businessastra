import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen } from "lucide-react";

import { MasterCrudPage } from "@/components/masters/MasterCrudPage";
import { vendorSchema, vendorFields } from "@/components/masters/schemas";
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

export const Route = createFileRoute("/masters/vendors")({
  component: VendorsPage,
});

function VendorsPage() {
  const [ledgerVendor, setLedgerVendor] = useState<{ id: string; name: string } | null>(null);
  const dateFormat = useDateFormat();

  return (
    <>
      <MasterCrudPage
        title="Vendors"
        description="Suppliers you receive bills from."
        table="vendors"
        schema={vendorSchema}
        fields={vendorFields}
        searchKeys={["name", "vat_number", "pan", "contact_person", "email"]}
        columns={[
          { key: "name", label: "Name" },
          { key: "vat_number", label: "VAT Number" },
          { key: "pan", label: "PAN" },
          { key: "contact_person", label: "Contact" },
          { key: "state", label: "State" },
          { key: "payment_terms", label: "Terms" },
        ]}
        rowActions={(row) => (
          <Button
            size="icon"
            variant="ghost"
            title="View Ledger"
            onClick={() =>
              setLedgerVendor({ id: row.id as string, name: row.name as string })
            }
          >
            <BookOpen className="h-4 w-4" />
          </Button>
        )}
      />

      {/* Ledger Dialog */}
      <Dialog
        open={!!ledgerVendor}
        onOpenChange={(v) => !v && setLedgerVendor(null)}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Ledger — {ledgerVendor?.name}
            </DialogTitle>
          </DialogHeader>
          {ledgerVendor && (
            <VendorLedgerContent vendorId={ledgerVendor.id} dateFormat={dateFormat} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function VendorLedgerContent({
  vendorId,
  dateFormat,
}: {
  vendorId: string;
  dateFormat: string;
}) {
  const ledgers = useQuery({
    queryKey: ["ledgers", "vendor", vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ledgers")
        .select("*, bills(bill_number, internal_bill_number)")
        .eq("vendor_id", vendorId)
        .order("date", { ascending: false });
      if (error) {
        const { data: fallback, error: fbErr } = await supabase
          .from("ledgers")
          .select("*")
          .eq("vendor_id", vendorId)
          .order("date", { ascending: false });
        if (fbErr) throw fbErr;
        return fallback ?? [];
      }
      return data ?? [];
    },
  });

  const rowsWithBalance = useMemo(() => {
    const chronological = [...(ledgers.data ?? [])].reverse();
    let balance = 0;
    const result = chronological.map((r: any) => {
      balance += Number(r.debit ?? 0) - Number(r.credit ?? 0);
      return { ...r, balance };
    });
    return result.reverse();
  }, [ledgers.data]);

  const totalDebit = rowsWithBalance.reduce((s, r) => s + Number(r.debit ?? 0), 0);
  const totalCredit = rowsWithBalance.reduce((s, r) => s + Number(r.credit ?? 0), 0);

  if (ledgers.isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Loading…</div>;
  }

  if (rowsWithBalance.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No ledger entries for this vendor.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-sm">
        <Badge variant="outline" className="px-3 py-1">
          Total Debit: {inr(totalDebit)}
        </Badge>
        <Badge variant="outline" className="px-3 py-1">
          Total Credit: {inr(totalCredit)}
        </Badge>
        <Badge
          variant={totalDebit - totalCredit >= 0 ? "default" : "destructive"}
          className="px-3 py-1"
        >
          Net: {inr(totalDebit - totalCredit)}
        </Badge>
      </div>

      <div className="rounded-md border">
        <Table className="text-sm">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-28 font-semibold">Date</TableHead>
              <TableHead className="font-semibold">Description</TableHead>
              <TableHead className="w-36 text-right font-semibold">Debit</TableHead>
              <TableHead className="w-36 text-right font-semibold">Credit</TableHead>
              <TableHead className="w-36 text-right font-semibold">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rowsWithBalance.map((r: any) => (
              <TableRow key={r.id} className="hover:bg-muted/30">
                <TableCell className="text-muted-foreground font-mono text-xs py-2.5">
                  {formatDate(r.date, dateFormat)}
                </TableCell>
                <TableCell className="py-2.5">{r.description || "—"}</TableCell>
                <TableCell className="text-right tabular-nums font-mono py-2.5">
                  {Number(r.debit) > 0 ? inr(Number(r.debit)) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums font-mono py-2.5">
                  {Number(r.credit) > 0 ? inr(Number(r.credit)) : "—"}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums font-mono font-semibold py-2.5 ${
                    r.balance < 0 ? "text-destructive" : ""
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
