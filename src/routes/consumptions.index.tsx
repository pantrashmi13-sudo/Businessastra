import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, PackageMinus, Search } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
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
import { num } from "@/lib/format";
import { formatDate } from "@/lib/date-conversion";
import { useDateFormat } from "@/hooks/use-date-format";

export const Route = createFileRoute("/consumptions/")({
  component: ConsumptionsList,
});

function ConsumptionsList() {
  const [q, setQ] = useState("");
  const dateFormat = useDateFormat();

  const consumptions = useQuery({
    queryKey: ["consumptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consumptions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<Record<string, unknown>>;
    },
  });

  const rows = useMemo(() => {
    let list = consumptions.data ?? [];
    if (q.trim()) {
      const n = q.toLowerCase();
      list = list.filter((c) =>
        String(c.consumption_number ?? "").toLowerCase().includes(n) ||
        String(c.notes ?? "").toLowerCase().includes(n),
      );
    }
    return list;
  }, [consumptions.data, q]);

  return (
    <>
      <PageHeader
        title="Consumptions"
        description="Track internal consumption of Other Items with real-time stock deduction."
        actions={
          <Link to="/consumptions/new">
            <Button>
              <Plus className="mr-1 h-4 w-4" /> New Consumption
            </Button>
          </Link>
        }
      />

      <div className="space-y-4 p-6">
        <div className="flex flex-wrap gap-2">
          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search consumption #, notes…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8 max-w-xs"
            />
          </div>
        </div>

        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consumption #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No consumptions found.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((c) => (
                <TableRow key={c.id as string}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <PackageMinus className="h-4 w-4 text-amber-600" />
                      <span className="font-medium">{c.consumption_number as string}</span>
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(c.consumption_date as string, dateFormat)}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {(c.notes as string) || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {String(c.status ?? "final")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link to="/consumptions/$id" params={{ id: c.id as string }}>
                      <Button variant="ghost" size="sm">View</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
