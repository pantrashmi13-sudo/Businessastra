import { useState, useEffect } from "react";
import {
  type GraphNode,
  getClusterForNode,
  getConnectedNodes,
  type GraphEdge,
} from "@/lib/knowledge-graph/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, ArrowRight, Database, Link2, Unlink, GitBranch, Table2, BarChart2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";


const TYPE_LABELS: Record<string, string> = {
  core: "Core / Auth",
  master: "Master Data",
  transaction: "Transaction",
  financial: "Financial",
  inventory: "Inventory",
  accounting: "Accounting",
};

const TYPE_COLORS: Record<string, string> = {
  core: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400",
  master: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  transaction: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  financial: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400",
  inventory: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-400",
  accounting: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
};

interface StatItem {
  label: string;
  value: string | number;
  highlight?: boolean;
}

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtCurrency(n: number | null | undefined) {
  if (n == null) return "—";
  return `₨ ${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

async function fetchNodeStats(nodeId: string): Promise<StatItem[]> {
  try {
    switch (nodeId) {
      case "bills": {
        const [{ count: total }, { data: agg }] = await Promise.all([
          supabase.from("bills").select("id", { count: "exact", head: true }),
          supabase.from("bills").select("taxable_amount,vat_amount,final_amount"),
        ]);
        const rows = agg || [];
        const taxable = rows.reduce((s, r) => s + (r.taxable_amount || 0), 0);
        const vat = rows.reduce((s, r) => s + (r.vat_amount || 0), 0);
        const finalAmt = rows.reduce((s, r) => s + (r.final_amount || 0), 0);
        return [
          { label: "Total Bills", value: total ?? 0 },
          { label: "Taxable Amount", value: fmtCurrency(taxable), highlight: true },
          { label: "VAT Amount", value: fmtCurrency(vat), highlight: true },
          { label: "Total Value", value: fmtCurrency(finalAmt), highlight: true },
        ];
      }
      case "bill_lines": {
        const { count } = await supabase.from("bill_lines").select("id", { count: "exact", head: true });
        const { data } = await supabase.from("bill_lines").select("quantity,line_amount");
        const rows = data || [];
        const totalQty = rows.reduce((s, r) => s + (r.quantity || 0), 0);
        const totalAmt = rows.reduce((s, r) => s + (r.line_amount || 0), 0);
        return [
          { label: "Total Line Items", value: count ?? 0 },
          { label: "Total Qty", value: fmt(totalQty) },
          { label: "Total Line Amount", value: fmtCurrency(totalAmt), highlight: true },
        ];
      }
      case "items": {
        const [{ count: total }, { data: rows }] = await Promise.all([
          supabase.from("items").select("id", { count: "exact", head: true }),
          supabase.from("items").select("qty,status"),
        ]);
        const allRows = rows || [];
        const active = allRows.filter((r) => r.status === "Active").length;
        const totalStock = allRows.reduce((s, r) => s + (r.qty || 0), 0);
        return [
          { label: "Total Items", value: total ?? 0 },
          { label: "Active Items", value: active, highlight: true },
          { label: "Total Stock Qty", value: fmt(totalStock) },
        ];
      }
      case "warehouses": {
        const [{ count: wCount }, { data: items }, { count: challans }, { count: transfers }] = await Promise.all([
          supabase.from("warehouses").select("id", { count: "exact", head: true }),
          supabase.from("items").select("qty"),
          supabase.from("delivery_challans").select("id", { count: "exact", head: true }),
          supabase.from("stock_transfers").select("id", { count: "exact", head: true }),
        ]);
        const totalStock = (items || []).reduce((s, r) => s + (r.qty || 0), 0);
        return [
          { label: "Warehouses", value: wCount ?? 0 },
          { label: "Running Items (Qty)", value: fmt(totalStock), highlight: true },
          { label: "Delivery Challans", value: challans ?? 0 },
          { label: "Stock Transfers", value: transfers ?? 0 },
        ];
      }
      case "customers": {
        const [{ count: total }, { count: challans }, { count: invoices }] = await Promise.all([
          supabase.from("customers").select("id", { count: "exact", head: true }),
          supabase.from("delivery_challans").select("id", { count: "exact", head: true }),
          supabase.from("sales_invoices").select("id", { count: "exact", head: true }),
        ]);
        return [
          { label: "Total Customers", value: total ?? 0 },
          { label: "Delivery Challans", value: challans ?? 0 },
          { label: "Sales Invoices", value: invoices ?? 0, highlight: true },
        ];
      }
      case "vendors": {
        const [{ count: total }, { count: bills }, { count: returns }] = await Promise.all([
          supabase.from("vendors").select("id", { count: "exact", head: true }),
          supabase.from("bills").select("id", { count: "exact", head: true }),
          supabase.from("purchase_returns").select("id", { count: "exact", head: true }),
        ]);
        return [
          { label: "Total Vendors", value: total ?? 0 },
          { label: "Purchase Bills", value: bills ?? 0, highlight: true },
          { label: "Purchase Returns", value: returns ?? 0 },
        ];
      }
      case "delivery_challans": {
        const [{ count: total }, { data: rows }] = await Promise.all([
          supabase.from("delivery_challans").select("id", { count: "exact", head: true }),
          supabase.from("delivery_challans").select("total_amount,status"),
        ]);
        const allRows = rows || [];
        const open = allRows.filter((r) => r.status === "Draft" || r.status === "Pending").length;
        const totalAmt = allRows.reduce((s, r) => s + (r.total_amount || 0), 0);
        return [
          { label: "Total Challans", value: total ?? 0 },
          { label: "Open / Pending", value: open },
          { label: "Total Dispatch Value", value: fmtCurrency(totalAmt), highlight: true },
        ];
      }
      case "sales_invoices": {
        const [{ count: total }, { data: rows }] = await Promise.all([
          supabase.from("sales_invoices").select("id", { count: "exact", head: true }),
          supabase.from("sales_invoices").select("total_amount,vat_amount"),
        ]);
        const allRows = rows || [];
        const totalAmt = allRows.reduce((s, r) => s + (r.total_amount || 0), 0);
        const vatAmt = allRows.reduce((s, r) => s + (r.vat_amount || 0), 0);
        return [
          { label: "Total Invoices", value: total ?? 0 },
          { label: "VAT Collected", value: fmtCurrency(vatAmt) },
          { label: "Total Sales Value", value: fmtCurrency(totalAmt), highlight: true },
        ];
      }
      case "payment_vouchers": {
        const [{ count: total }, { data: rows }] = await Promise.all([
          supabase.from("payment_vouchers").select("id", { count: "exact", head: true }),
          supabase.from("payment_vouchers").select("total_amount"),
        ]);
        const totalPaid = (rows || []).reduce((s, r) => s + (r.total_amount || 0), 0);
        return [
          { label: "Total Payments", value: total ?? 0 },
          { label: "Total Paid Out", value: fmtCurrency(totalPaid), highlight: true },
        ];
      }
      case "receipt_vouchers": {
        const [{ count: total }, { data: rows }] = await Promise.all([
          supabase.from("receipt_vouchers").select("id", { count: "exact", head: true }),
          supabase.from("receipt_vouchers").select("total_amount"),
        ]);
        const totalReceived = (rows || []).reduce((s, r) => s + (r.total_amount || 0), 0);
        return [
          { label: "Total Receipts", value: total ?? 0 },
          { label: "Total Received", value: fmtCurrency(totalReceived), highlight: true },
        ];
      }
      case "purchase_returns": {
        const [{ count: total }, { data: rows }] = await Promise.all([
          supabase.from("purchase_returns").select("id", { count: "exact", head: true }),
          supabase.from("purchase_returns").select("total_amount"),
        ]);
        const totalAmt = (rows || []).reduce((s, r) => s + (r.total_amount || 0), 0);
        return [
          { label: "Total Returns", value: total ?? 0 },
          { label: "Total Return Value", value: fmtCurrency(totalAmt), highlight: true },
        ];
      }
      case "stock_ledger": {
        const { data } = await supabase.from("stock_ledger").select("movement_type,quantity");
        const rows = data || [];
        const inward = rows.filter((r) => r.movement_type === "IN").reduce((s, r) => s + (r.quantity || 0), 0);
        const outward = rows.filter((r) => r.movement_type === "OUT").reduce((s, r) => s + (r.quantity || 0), 0);
        return [
          { label: "Total Movements", value: rows.length },
          { label: "Total Inward (Qty)", value: fmt(inward), highlight: true },
          { label: "Total Outward (Qty)", value: fmt(outward) },
        ];
      }
      case "journal_entries": {
        const { count } = await supabase.from("journal_entries").select("id", { count: "exact", head: true });
        const { data } = await supabase.from("journal_lines").select("debit,credit");
        const rows = data || [];
        const totalDebit = rows.reduce((s, r) => s + (r.debit || 0), 0);
        const totalCredit = rows.reduce((s, r) => s + (r.credit || 0), 0);
        return [
          { label: "Journal Entries", value: count ?? 0 },
          { label: "Total Debits", value: fmtCurrency(totalDebit), highlight: true },
          { label: "Total Credits", value: fmtCurrency(totalCredit), highlight: true },
        ];
      }
      case "companies": {
        const { count } = await supabase.from("companies").select("id", { count: "exact", head: true });
        return [{ label: "Total Companies", value: count ?? 0, highlight: true }];
      }
      case "stock_transfers": {
        const { count } = await supabase.from("stock_transfers").select("id", { count: "exact", head: true });
        return [{ label: "Total Transfers", value: count ?? 0 }];
      }
      default:
        return [];
    }
  } catch (e) {
    console.error("fetchNodeStats error", e);
    return [];
  }
}

interface GraphNodePanelProps {
  node: GraphNode;
  allNodes: GraphNode[];
  onClose: () => void;
  onNavigate: (nodeId: string) => void;
  onFindPath: (targetId: string) => void;
  highlightedPath: string[] | null;
  pathTarget: string | null;
}


export function GraphNodePanel({
  node,
  allNodes,
  onClose,
  onNavigate,
  onFindPath,
  highlightedPath,
  pathTarget,
}: GraphNodePanelProps) {
  const cluster = getClusterForNode(node.id);

  const [liveStats, setLiveStats] = useState<StatItem[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    setLoadingStats(true);
    setLiveStats([]);
    fetchNodeStats(node.id).then((stats) => {
      setLiveStats(stats);
      setLoadingStats(false);
    });
  }, [node.id]);

  // Group edges by direction
  const outgoingByTarget = new Map<string, GraphEdge[]>();
  const incomingBySource = new Map<string, GraphEdge[]>();

  for (const e of node.outgoing) {
    const existing = outgoingByTarget.get(e.target) || [];
    existing.push(e);
    outgoingByTarget.set(e.target, existing);
  }

  for (const e of node.incoming) {
    const existing = incomingBySource.get(e.source) || [];
    existing.push(e);
    incomingBySource.set(e.source, existing);
  }

  const getNodeLabel = (id: string) => {
    const n = allNodes.find((n) => n.id === id);
    return n?.label || id;
  };

  return (
    <div className="absolute z-30 inset-x-0 bottom-0 max-h-[75vh] md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:max-h-full md:h-full md:w-80 flex flex-col rounded-t-2xl md:rounded-none border-t md:border-t-0 md:border-l bg-card shadow-2xl animate-in slide-in-from-bottom md:slide-in-from-right duration-200">
      {/* Mobile Handle */}
      <div className="md:hidden flex justify-center pt-2 pb-1">
        <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
      </div>

      <div className="flex h-full flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between border-b p-3 sm:p-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground">{node.label}</h3>
            <p className="text-[10px] font-mono text-muted-foreground">{node.entity}</p>
            <div className="flex gap-1.5">
              <Badge variant="secondary" className={`text-[10px] ${TYPE_COLORS[node.type]}`}>
                {TYPE_LABELS[node.type]}
              </Badge>
              {cluster && (
                <Badge variant="outline" className="text-[10px]">
                  {cluster.label}
                </Badge>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="space-y-4 p-4">
            {/* Description */}
            <div>
              <p className="text-xs text-muted-foreground leading-relaxed">{node.description}</p>
            </div>

            {/* Live Data */}
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <BarChart2 className="h-3 w-3" />
                Live Data
              </h4>
              {loadingStats ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading live stats...
                </div>
              ) : liveStats.length === 0 ? (
                <p className="text-[10px] text-muted-foreground italic">No live data available.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {liveStats.map((stat) => (
                    <div
                      key={stat.label}
                      className={`rounded-md border p-2 text-center ${
                        stat.highlight ? "border-primary/30 bg-primary/5" : ""
                      }`}
                    >
                      <p className={`text-sm font-bold ${
                        stat.highlight ? "text-primary" : "text-foreground"
                      }`}>
                        {stat.value}
                      </p>
                      <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Schema Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border p-2 text-center">
                <p className="text-lg font-bold text-foreground">{node.columns.length}</p>
                <p className="text-[9px] text-muted-foreground">Columns</p>
              </div>
              <div className="rounded-md border p-2 text-center">
                <p className="text-lg font-bold text-foreground">{node.outgoing.length}</p>
                <p className="text-[9px] text-muted-foreground">Outgoing</p>
              </div>
              <div className="rounded-md border p-2 text-center">
                <p className="text-lg font-bold text-foreground">{node.incoming.length}</p>
                <p className="text-[9px] text-muted-foreground">Incoming</p>
              </div>
            </div>

            {/* Columns */}
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Table2 className="h-3 w-3" />
                Columns
              </h4>
              <div className="space-y-1">
                {node.columns.map((col) => {
                  const isPk = col === "id";
                  const isFk = col.endsWith("_id") && col !== "id";
                  return (
                    <div
                      key={col}
                      className={`flex items-center gap-2 rounded px-2 py-1 text-[10px] ${
                        isPk
                          ? "bg-yellow-500/10 border border-yellow-500/20"
                          : isFk
                            ? "bg-blue-500/10 border border-blue-500/20"
                            : "bg-muted/30"
                      }`}
                    >
                      <span className="text-[9px] shrink-0">
                        {isPk ? "🔑" : isFk ? "🔗" : <Database className="h-2.5 w-2.5 text-muted-foreground/50" />}
                      </span>
                      <span className={`font-mono flex-1 ${
                        isPk
                          ? "text-yellow-600 dark:text-yellow-400 font-semibold"
                          : isFk
                            ? "text-blue-600 dark:text-blue-400 font-medium"
                            : "text-foreground"
                      }`}>
                        {col}
                      </span>
                      {isPk && (
                        <Badge className="ml-auto text-[7px] px-1 py-0 bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-0 shrink-0">
                          PK
                        </Badge>
                      )}
                      {isFk && (
                        <Badge className="ml-auto text-[7px] px-1 py-0 bg-blue-500/20 text-blue-700 dark:text-blue-300 border-0 shrink-0">
                          FK
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Outgoing relationships */}
            {outgoingByTarget.size > 0 && (
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <ArrowRight className="h-3 w-3" />
                  References ({node.outgoing.length})
                </h4>
                <div className="space-y-1">
                  {Array.from(outgoingByTarget.entries()).map(([targetId, edges]) => (
                    <button
                      key={targetId}
                      onClick={() => onNavigate(targetId)}
                      className="flex w-full items-center gap-2 rounded border border-transparent bg-muted/20 px-2 py-1.5 text-left transition-colors hover:border-primary/30 hover:bg-muted/40"
                    >
                      <Link2 className="h-2.5 w-2.5 shrink-0 text-emerald-500" />
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-medium text-foreground">
                          {getNodeLabel(targetId)}
                        </span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {edges.map((e) => (
                            <Badge key={e.id} variant="outline" className="text-[8px] px-1 py-0">
                              {e.label}
                              {e.onDelete && (
                                <span className="ml-0.5 text-muted-foreground">({e.onDelete})</span>
                              )}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Incoming relationships */}
            {incomingBySource.size > 0 && (
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Unlink className="h-3 w-3 rotate-180" />
                  Referenced by ({node.incoming.length})
                </h4>
                <div className="space-y-1">
                  {Array.from(incomingBySource.entries()).map(([sourceId, edges]) => (
                    <button
                      key={sourceId}
                      onClick={() => onNavigate(sourceId)}
                      className="flex w-full items-center gap-2 rounded border border-transparent bg-muted/20 px-2 py-1.5 text-left transition-colors hover:border-primary/30 hover:bg-muted/40"
                    >
                      <Link2 className="h-2.5 w-2.5 shrink-0 text-blue-500" />
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-medium text-foreground">
                          {getNodeLabel(sourceId)}
                        </span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {edges.map((e) => (
                            <Badge key={e.id} variant="outline" className="text-[8px] px-1 py-0">
                              {e.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Path finder */}
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <GitBranch className="h-3 w-3" />
                Find path to...
              </h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {allNodes
                  .filter((n) => n.id !== node.id)
                  .map((n) => (
                    <button
                      key={n.id}
                      onClick={() => onFindPath(n.id)}
                      className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[10px] transition-colors ${
                        pathTarget === n.id
                          ? "bg-primary/10 text-primary border border-primary/30"
                          : "hover:bg-muted/40 border border-transparent"
                      }`}
                    >
                      <span className="font-medium">{n.label}</span>
                      {highlightedPath && pathTarget === n.id && (
                        <Badge variant="secondary" className="ml-auto text-[8px]">
                          {highlightedPath.length - 1} hops
                        </Badge>
                      )}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
