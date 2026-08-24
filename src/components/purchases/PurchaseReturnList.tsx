import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Eye, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { inr } from "@/lib/format";
import { useState } from "react";

export default function PurchaseReturnList() {
  const navigate = useNavigate();

  const returns = useQuery({
    queryKey: ["purchase-returns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_returns")
        .select("*, vendors(name), bills(bill_number, internal_bill_number)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Returns"
        description="Items returned to vendors"
        actions={
          <Button size="sm" onClick={() => navigate({ to: "/purchase-returns/new" })}>
            <Plus className="h-4 w-4 mr-1" /> New Purchase Return
          </Button>
        }
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Return #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Original Bill</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(returns.data || []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No purchase returns found
                </TableCell>
              </TableRow>
            ) : (
              (returns.data || []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.return_number}</TableCell>
                  <TableCell>{r.return_date}</TableCell>
                  <TableCell>{(r.vendors as any)?.name || "—"}</TableCell>
                  <TableCell className="text-xs">
                    {(r.bills as any)?.bill_number || (r.bills as any)?.internal_bill_number || "—"}
                  </TableCell>
                  <TableCell className="text-right">{inr(r.total_amount)}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "approved" ? "default" : "secondary"}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => navigate({ to: "/purchase-returns/$id", params: { id: r.id } })}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
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
