import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/purchase-returns/$id")({
  component: PurchaseReturnDetail,
});

function PurchaseReturnDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const returnDoc = useQuery({
    queryKey: ["purchase-return", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_returns")
        .select("*, vendors(name), bills(bill_number, internal_bill_number)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const returnLines = useQuery({
    queryKey: ["purchase-return-lines", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_return_lines")
        .select("*")
        .eq("return_id", id)
        .order("sno");
      if (error) throw error;
      return data || [];
    },
  });

  if (returnDoc.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!returnDoc.data) {
    return <div className="p-6 text-muted-foreground">Return not found.</div>;
  }

  const r = returnDoc.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Purchase Return: ${r.return_number}`}
        description={`Against Bill #${(r.bills as any)?.bill_number || (r.bills as any)?.internal_bill_number || "—"}`}
        actions={
          <div className="flex gap-2">
            <Badge variant={r.status === "approved" ? "default" : "secondary"}>
              {r.status}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/purchase-returns" })}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Return Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Return Date</span>
              <p className="font-medium">{r.return_date}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Vendor</span>
              <p className="font-medium">{(r.vendors as any)?.name || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Taxable Amount</span>
              <p className="font-medium">{inr(r.taxable_amount)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">VAT Amount</span>
              <p className="font-medium">{inr(r.vat_amount)}</p>
            </div>
          </div>
          {r.notes && (
            <div className="mt-4">
              <span className="text-muted-foreground text-sm">Notes</span>
              <p className="text-sm">{r.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Returned Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">S.No</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="w-20">UOM</TableHead>
                  <TableHead className="w-24">Quantity</TableHead>
                  <TableHead className="w-28">Orig. Price</TableHead>
                  <TableHead className="w-28">Return Price</TableHead>
                  <TableHead className="w-16">VAT %</TableHead>
                  <TableHead className="w-28 text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returnLines.data?.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="text-muted-foreground">{line.sno}</TableCell>
                    <TableCell>
                      <span className="font-medium">{line.name}</span>
                      {line.code && <span className="text-xs text-muted-foreground ml-1">({line.code})</span>}
                    </TableCell>
                    <TableCell className="text-xs">{line.uom}</TableCell>
                    <TableCell className="text-xs">{line.quantity}</TableCell>
                    <TableCell className="text-xs">{inr(line.original_per_unit)}</TableCell>
                    <TableCell className="text-xs">{inr(line.per_unit)}</TableCell>
                    <TableCell className="text-xs">{line.vat_rate}%</TableCell>
                    <TableCell className="text-right font-medium">{inr(line.line_amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex justify-end">
            <div className="w-72 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Taxable Amount</span>
                <span>{inr(r.taxable_amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">VAT Amount</span>
                <span>{inr(r.vat_amount)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold border-t pt-2">
                <span>Total Return Value</span>
                <span>{inr(r.total_amount)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
