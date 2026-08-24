import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "./use-company";
import { toast } from "sonner";

export type EntityCategory =
  | "core"
  | "master"
  | "transaction"
  | "financial"
  | "inventory"
  | "accounting";

export interface DataNode {
  id: string; // Composite ID: "table:uuid"
  table: string; // e.g. "companies", "bills", "customers"
  label: string; // Display text (e.g. "Bill INV-100", "Customer ABC")
  subLabel?: string; // e.g. "NPR 45,000" or "Stock: 120"
  type: EntityCategory;
  status?: "paid" | "unpaid" | "partial" | "approved" | "pending" | "critical" | "active";
  amount?: number;
  data: Record<string, any>;
  routeUrl?: string; // Direct link to open this record in Bizastra
}

export interface DataEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  amount?: number;
  date?: string;
  status?: string;
  animated?: boolean;
}

const RELATION_LIMIT = 12;

export function useDataGraph() {
  const { company } = useCompany();
  const [nodes, setNodes] = useState<Map<string, DataNode>>(new Map());
  const [edges, setEdges] = useState<Map<string, DataEdge>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [activePreset, setActivePreset] = useState<string>("all");

  const addData = useCallback((newNodes: DataNode[], newEdges: DataEdge[]) => {
    setNodes((prevNodes) => {
      const next = new Map(prevNodes);
      newNodes.forEach((n) => next.set(n.id, n));
      return next;
    });
    setEdges((prevEdges) => {
      const next = new Map(prevEdges);
      newEdges.forEach((e) => next.set(e.id, e));
      return next;
    });
  }, []);

  const clearGraph = useCallback(() => {
    setNodes(new Map());
    setEdges(new Map());
  }, []);

  // Format node helper with deep links and rich badges
  const makeNode = (table: string, row: any): DataNode => {
    const id = `${table}:${row.id}`;
    let label = row.name || row.id.substring(0, 8);
    let subLabel: string | undefined = undefined;
    let type: EntityCategory = "core";
    let status: DataNode["status"] = undefined;
    let amount: number | undefined = undefined;
    let routeUrl: string | undefined = undefined;

    switch (table) {
      case "companies":
        label = row.name || "Company";
        subLabel = row.pan ? `PAN: ${row.pan}` : "Headquarters";
        type = "core";
        status = "active";
        break;

      case "customers":
        label = row.name || "Customer";
        subLabel = row.phone || row.city || "Client";
        type = "master";
        routeUrl = `/masters/customers`;
        break;

      case "vendors":
        label = row.name || "Vendor";
        subLabel = row.pan ? `PAN: ${row.pan}` : "Supplier";
        type = "master";
        routeUrl = `/masters/vendors`;
        break;

      case "items":
        label = row.item_name || row.item_code || "Item";
        subLabel = `Stock: ${row.qty ?? 0} ${row.uom || "units"}`;
        type = "inventory";
        if (Number(row.qty ?? 0) <= Number(row.reorder_level ?? 0) && Number(row.reorder_level ?? 0) > 0) {
          status = "critical";
        }
        routeUrl = `/masters/items`;
        break;

      case "warehouses":
        label = row.name || "Warehouse";
        subLabel = row.is_main ? "⭐ Main Warehouse" : (row.location || "Store");
        type = "inventory";
        status = row.is_main ? "approved" : "active";
        routeUrl = `/masters/warehouses`;
        break;

      case "warehouse_rags":
        label = row.name || `Rag ${row.code || ""}`;
        subLabel = row.capacity ? `Cap: ${row.capacity}` : "Shelf";
        type = "inventory";
        break;

      case "bills":
        label = `Bill #${row.bill_number || row.id.substring(0, 6)}`;
        amount = Number(row.final_amount ?? 0);
        subLabel = `NPR ${amount.toLocaleString()}`;
        type = "transaction";
        status = row.status === "approved" ? "paid" : "pending";
        routeUrl = `/bills/${row.id}`;
        break;

      case "sales_invoices":
        label = `Invoice #${row.invoice_number || row.id.substring(0, 6)}`;
        amount = Number(row.final_amount ?? row.total_amount ?? 0);
        subLabel = `NPR ${amount.toLocaleString()}`;
        type = "transaction";
        status = row.status === "paid" ? "paid" : (row.status === "cancelled" ? "critical" : "unpaid");
        routeUrl = `/challans/invoices`;
        break;

      case "delivery_challans":
        label = `Challan #${row.challan_number || row.id.substring(0, 6)}`;
        subLabel = row.date ? new Date(row.date).toLocaleDateString() : "Dispatch";
        type = "transaction";
        routeUrl = `/challans`;
        break;

      case "payment_vouchers":
        label = `Payment #${row.voucher_number || row.id.substring(0, 6)}`;
        amount = Number(row.amount ?? 0);
        subLabel = `NPR ${amount.toLocaleString()} Out`;
        type = "financial";
        status = "paid";
        routeUrl = `/receipt-payment`;
        break;

      case "receipt_vouchers":
        label = `Receipt #${row.voucher_number || row.id.substring(0, 6)}`;
        amount = Number(row.amount ?? 0);
        subLabel = `NPR ${amount.toLocaleString()} In`;
        type = "financial";
        status = "paid";
        routeUrl = `/receipt-payment`;
        break;

      case "fixed_assets":
        label = row.asset_name || "Asset";
        amount = Number(row.purchase_cost ?? 0);
        subLabel = `Cost: NPR ${amount.toLocaleString()}`;
        type = "accounting";
        routeUrl = `/masters/fixed-assets`;
        break;

      case "stock_transfers":
        label = `Transfer #${row.transfer_number || row.id.substring(0, 6)}`;
        subLabel = row.transfer_date ? new Date(row.transfer_date).toLocaleDateString() : "Movement";
        type = "inventory";
        status = "approved";
        break;

      case "bill_lines":
      case "sales_invoice_lines":
        label = row.name || `Line #${row.sno || 1}`;
        amount = Number(row.line_amount ?? 0);
        subLabel = `Qty: ${row.quantity ?? 1} × NPR ${row.per_unit ?? 0}`;
        type = "transaction";
        break;

      default:
        label = row.name || row.title || row.id.substring(0, 8);
        type = "core";
    }

    return { id, table, label, subLabel, type, status, amount, data: row, routeUrl };
  };

  // Expand a specific node dynamically
  const expandNode = useCallback(
    async (nodeId: string) => {
      if (!company?.id) return;
      setIsLoading(true);

      try {
        const [table, rowId] = nodeId.split(":");
        const newNodes: DataNode[] = [];
        const newEdges: DataEdge[] = [];

        // 🏢 Expand Company
        if (table === "companies") {
          const [billsRes, custRes, vendorRes, whRes] = await Promise.all([
            supabase.from("bills").select("*").eq("company_id", rowId).order("created_at", { ascending: false }).limit(RELATION_LIMIT),
            supabase.from("customers").select("*").eq("company_id", rowId).order("created_at", { ascending: false }).limit(RELATION_LIMIT),
            supabase.from("vendors").select("*").eq("company_id", rowId).order("created_at", { ascending: false }).limit(RELATION_LIMIT),
            supabase.from("warehouses").select("*").eq("company_id", rowId).order("is_main", { ascending: false }).limit(RELATION_LIMIT),
          ]);

          (billsRes.data || []).forEach((b) => {
            const n = makeNode("bills", b);
            newNodes.push(n);
            newEdges.push({
              id: `${nodeId}-${n.id}`,
              source: nodeId,
              target: n.id,
              label: "procured",
              amount: Number(b.final_amount ?? 0),
              status: b.status,
            });
          });

          (custRes.data || []).forEach((c) => {
            const n = makeNode("customers", c);
            newNodes.push(n);
            newEdges.push({
              id: `${nodeId}-${n.id}`,
              source: nodeId,
              target: n.id,
              label: "client",
            });
          });

          (vendorRes.data || []).forEach((v) => {
            const n = makeNode("vendors", v);
            newNodes.push(n);
            newEdges.push({
              id: `${nodeId}-${n.id}`,
              source: nodeId,
              target: n.id,
              label: "supplier",
            });
          });

          (whRes.data || []).forEach((w) => {
            const n = makeNode("warehouses", w);
            newNodes.push(n);
            newEdges.push({
              id: `${nodeId}-${n.id}`,
              source: nodeId,
              target: n.id,
              label: w.is_main ? "main storage" : "facility",
            });
          });
        }

        // 👤 Expand Customer
        if (table === "customers") {
          const [invoicesRes, challansRes, receiptsRes] = await Promise.all([
            supabase.from("sales_invoices" as any).select("*").eq("customer_id", rowId).order("created_at", { ascending: false }).limit(RELATION_LIMIT),
            supabase.from("delivery_challans" as any).select("*").eq("customer_id", rowId).order("created_at", { ascending: false }).limit(RELATION_LIMIT),
            supabase.from("receipt_vouchers" as any).select("*").eq("received_from", rowId).order("created_at", { ascending: false }).limit(RELATION_LIMIT),
          ]);

          (invoicesRes.data || []).forEach((inv: any) => {
            const n = makeNode("sales_invoices", inv);
            newNodes.push(n);
            newEdges.push({
              id: `${nodeId}-${n.id}`,
              source: nodeId,
              target: n.id,
              label: "invoiced",
              amount: Number(inv.final_amount ?? inv.total_amount ?? 0),
              date: inv.invoice_date,
              animated: true,
            });
          });

          (challansRes.data || []).forEach((ch: any) => {
            const n = makeNode("delivery_challans", ch);
            newNodes.push(n);
            newEdges.push({
              id: `${nodeId}-${n.id}`,
              source: nodeId,
              target: n.id,
              label: "dispatched",
            });
          });

          (receiptsRes.data || []).forEach((rc: any) => {
            const n = makeNode("receipt_vouchers", rc);
            newNodes.push(n);
            newEdges.push({
              id: `${n.id}-${nodeId}`,
              source: n.id,
              target: nodeId,
              label: "received payment",
              amount: Number(rc.amount ?? 0),
              animated: true,
            });
          });
        }

        // 🏭 Expand Vendor
        if (table === "vendors") {
          const [billsRes, paymentsRes] = await Promise.all([
            supabase.from("bills").select("*").eq("vendor_id", rowId).order("created_at", { ascending: false }).limit(RELATION_LIMIT),
            supabase.from("payment_vouchers" as any).select("*").eq("paid_to", rowId).order("created_at", { ascending: false }).limit(RELATION_LIMIT),
          ]);

          (billsRes.data || []).forEach((b) => {
            const n = makeNode("bills", b);
            newNodes.push(n);
            newEdges.push({
              id: `${nodeId}-${n.id}`,
              source: nodeId,
              target: n.id,
              label: "billed",
              amount: Number(b.final_amount ?? 0),
              date: b.invoice_date || undefined,
            });
          });

          (paymentsRes.data || []).forEach((p: any) => {
            const n = makeNode("payment_vouchers", p);
            newNodes.push(n);
            newEdges.push({
              id: `${nodeId}-${n.id}`,
              source: nodeId,
              target: n.id,
              label: "paid out",
              amount: Number(p.amount ?? 0),
              animated: true,
            });
          });
        }

        // 🧾 Expand Purchase Bill
        if (table === "bills") {
          const { data: lines } = await supabase
            .from("bill_lines")
            .select("*, items(*)")
            .eq("bill_id", rowId);

          if (lines) {
            lines.forEach((line) => {
              const lineNode = makeNode("bill_lines", line);
              newNodes.push(lineNode);
              newEdges.push({
                id: `${nodeId}-${lineNode.id}`,
                source: nodeId,
                target: lineNode.id,
                label: "itemized line",
                amount: line.line_amount,
              });

              if (line.items) {
                const itemNode = makeNode("items", line.items);
                newNodes.push(itemNode);
                newEdges.push({
                  id: `${lineNode.id}-${itemNode.id}`,
                  source: lineNode.id,
                  target: itemNode.id,
                  label: "contains SKU",
                });
              }
            });
          }
        }

        // 📑 Expand Sales Invoice
        if (table === "sales_invoices") {
          const { data: lines } = await supabase
            .from("sales_invoice_lines" as any)
            .select("*, items(*)")
            .eq("invoice_id", rowId);

          if (lines) {
            (lines as any[]).forEach((line) => {
              const lineNode = makeNode("sales_invoice_lines", line);
              newNodes.push(lineNode);
              newEdges.push({
                id: `${nodeId}-${lineNode.id}`,
                source: nodeId,
                target: lineNode.id,
                label: "line",
                amount: line.line_amount,
              });

              if (line.items) {
                const itemNode = makeNode("items", line.items);
                newNodes.push(itemNode);
                newEdges.push({
                  id: `${lineNode.id}-${itemNode.id}`,
                  source: lineNode.id,
                  target: itemNode.id,
                  label: "product SKU",
                });
              }
            });
          }
        }

        // 🏬 Expand Warehouse
        if (table === "warehouses") {
          const [ragsRes, transfersRes] = await Promise.all([
            supabase.from("warehouse_rags").select("*").eq("warehouse_id", rowId),
            supabase.from("stock_transfers").select("*").or(`from_warehouse_id.eq.${rowId},to_warehouse_id.eq.${rowId}`).limit(RELATION_LIMIT),
          ]);

          (ragsRes.data || []).forEach((rag) => {
            const n = makeNode("warehouse_rags", rag);
            newNodes.push(n);
            newEdges.push({
              id: `${nodeId}-${n.id}`,
              source: nodeId,
              target: n.id,
              label: "storage rag",
            });
          });

          (transfersRes.data || []).forEach((st) => {
            const n = makeNode("stock_transfers", st);
            newNodes.push(n);
            newEdges.push({
              id: `${nodeId}-${n.id}`,
              source: nodeId,
              target: n.id,
              label: st.from_warehouse_id === rowId ? "transferred out" : "transferred in",
              animated: true,
            });
          });
        }

        // 📦 Expand Item
        if (table === "items") {
          // Find recent bill lines and sales invoice lines mentioning this item
          const [billLinesRes, invoiceLinesRes] = await Promise.all([
            supabase.from("bill_lines").select("*, bills(*)").eq("ref_id", rowId).limit(5),
            supabase.from("sales_invoice_lines" as any).select("*, sales_invoices(*)").eq("item_id", rowId).limit(5),
          ]);

          (billLinesRes.data || []).forEach((bl: any) => {
            if (bl.bills) {
              const bNode = makeNode("bills", bl.bills);
              newNodes.push(bNode);
              newEdges.push({
                id: `${bNode.id}-${nodeId}`,
                source: bNode.id,
                target: nodeId,
                label: `purchased @ NPR ${bl.per_unit}`,
                amount: bl.line_amount,
              });
            }
          });

          (invoiceLinesRes.data || []).forEach((il: any) => {
            if (il.sales_invoices) {
              const invNode = makeNode("sales_invoices", il.sales_invoices);
              newNodes.push(invNode);
              newEdges.push({
                id: `${nodeId}-${invNode.id}`,
                source: nodeId,
                target: invNode.id,
                label: `sold @ NPR ${il.rate || il.per_unit}`,
                amount: il.line_amount,
                animated: true,
              });
            }
          });
        }

        addData(newNodes, newEdges);
      } catch (err: any) {
        toast.error("Failed to fetch connected data");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    },
    [company?.id, addData]
  );

  // Initialize with Root Company
  const initGraph = useCallback(async () => {
    if (!company?.id) return;
    clearGraph();
    setActivePreset("all");
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", company.id)
        .single();

      if (error) throw error;
      if (data) {
        const rootNode = makeNode("companies", data);
        addData([rootNode], []);
        await expandNode(rootNode.id);
      }
    } catch (err: any) {
      toast.error("Failed to initialize graph");
    } finally {
      setIsLoading(false);
    }
  }, [company?.id, addData, clearGraph, expandNode]);

  // Preset 1: Overdue Invoices & Debtors
  const loadOverdueDebtors = useCallback(async () => {
    if (!company?.id) return;
    clearGraph();
    setActivePreset("debtors");
    setIsLoading(true);

    try {
      const { data: invoices, error } = await supabase
        .from("sales_invoices" as any)
        .select("*, customers(*)")
        .eq("company_id", company.id)
        .neq("status", "paid")
        .order("created_at", { ascending: false })
        .limit(15);

      if (error) throw error;

      const newNodes: DataNode[] = [];
      const newEdges: DataEdge[] = [];

      (invoices || []).forEach((inv: any) => {
        const invNode = makeNode("sales_invoices", inv);
        newNodes.push(invNode);

        if (inv.customers) {
          const custNode = makeNode("customers", inv.customers);
          newNodes.push(custNode);
          newEdges.push({
            id: `${custNode.id}-${invNode.id}`,
            source: custNode.id,
            target: invNode.id,
            label: "unpaid balance",
            amount: Number(inv.final_amount ?? inv.total_amount ?? 0),
            status: "unpaid",
            animated: true,
          });
        }
      });

      if (newNodes.length === 0) {
        toast.success("No pending overdue invoices found!");
      } else {
        addData(newNodes, newEdges);
        toast.info(`Loaded ${newNodes.length} nodes for overdue debtors`);
      }
    } catch (err: any) {
      toast.error("Failed to load overdue debtors");
    } finally {
      setIsLoading(false);
    }
  }, [company?.id, addData, clearGraph]);

  // Preset 2: Cash & Payment Flow Trail
  const loadCashTrail = useCallback(async () => {
    if (!company?.id) return;
    clearGraph();
    setActivePreset("cash");
    setIsLoading(true);

    try {
      const [receiptsRes, paymentsRes] = await Promise.all([
        supabase.from("receipt_vouchers" as any).select("*, customers(*)").eq("company_id", company.id).limit(10),
        supabase.from("payment_vouchers" as any).select("*, vendors(*)").eq("company_id", company.id).limit(10),
      ]);

      const newNodes: DataNode[] = [];
      const newEdges: DataEdge[] = [];

      (receiptsRes.data || []).forEach((r: any) => {
        const rNode = makeNode("receipt_vouchers", r);
        newNodes.push(rNode);
        if (r.customers) {
          const cNode = makeNode("customers", r.customers);
          newNodes.push(cNode);
          newEdges.push({
            id: `${cNode.id}-${rNode.id}`,
            source: cNode.id,
            target: rNode.id,
            label: "inbound cash",
            amount: Number(r.amount ?? 0),
            animated: true,
          });
        }
      });

      (paymentsRes.data || []).forEach((p: any) => {
        const pNode = makeNode("payment_vouchers", p);
        newNodes.push(pNode);
        if (p.vendors) {
          const vNode = makeNode("vendors", p.vendors);
          newNodes.push(vNode);
          newEdges.push({
            id: `${pNode.id}-${vNode.id}`,
            source: pNode.id,
            target: vNode.id,
            label: "disbursed cash",
            amount: Number(p.amount ?? 0),
            animated: true,
          });
        }
      });

      if (newNodes.length === 0) {
        toast.info("No recent cash transactions found");
      } else {
        addData(newNodes, newEdges);
        toast.info(`Loaded cash & bank flow graph`);
      }
    } catch (err: any) {
      toast.error("Failed to load cash flow trail");
    } finally {
      setIsLoading(false);
    }
  }, [company?.id, addData, clearGraph]);

  // Preset 3: Warehouse & Inventory Map
  const loadInventoryMap = useCallback(async () => {
    if (!company?.id) return;
    clearGraph();
    setActivePreset("inventory");
    setIsLoading(true);

    try {
      const [whRes, itemsRes, transfersRes] = await Promise.all([
        supabase.from("warehouses").select("*").eq("company_id", company.id),
        supabase.from("items").select("*").eq("company_id", company.id).order("qty", { ascending: true }).limit(15),
        supabase.from("stock_transfers").select("*").limit(5),
      ]);

      const newNodes: DataNode[] = [];
      const newEdges: DataEdge[] = [];

      const whMap = new Map<string, DataNode>();
      (whRes.data || []).forEach((w) => {
        const n = makeNode("warehouses", w);
        whMap.set(w.id, n);
        newNodes.push(n);
      });

      (itemsRes.data || []).forEach((i) => {
        const iNode = makeNode("items", i);
        newNodes.push(iNode);
        // Link to main warehouse or matching warehouse
        const mainWh = (whRes.data || []).find((w) => w.is_main) || whRes.data?.[0];
        if (mainWh) {
          newEdges.push({
            id: `${mainWh.id}-${iNode.id}`,
            source: `warehouses:${mainWh.id}`,
            target: iNode.id,
            label: `stock: ${i.qty ?? 0}`,
          });
        }
      });

      (transfersRes.data || []).forEach((st) => {
        const stNode = makeNode("stock_transfers", st);
        newNodes.push(stNode);
        if (st.from_warehouse_id) {
          newEdges.push({
            id: `warehouses:${st.from_warehouse_id}-${stNode.id}`,
            source: `warehouses:${st.from_warehouse_id}`,
            target: stNode.id,
            label: "transfer out",
            animated: true,
          });
        }
        if (st.to_warehouse_id) {
          newEdges.push({
            id: `${stNode.id}-warehouses:${st.to_warehouse_id}`,
            source: stNode.id,
            target: `warehouses:${st.to_warehouse_id}`,
            label: "transfer in",
            animated: true,
          });
        }
      });

      addData(newNodes, newEdges);
      toast.info(`Loaded warehouse & inventory distribution`);
    } catch (err: any) {
      toast.error("Failed to load inventory map");
    } finally {
      setIsLoading(false);
    }
  }, [company?.id, addData, clearGraph]);

  // Global search across entities
  const searchEntities = useCallback(
    async (query: string) => {
      if (!company?.id || !query.trim()) return;
      setIsLoading(true);
      clearGraph();
      setActivePreset("search");

      try {
        const newNodes: DataNode[] = [];
        const q = `%${query}%`;

        const [billsRes, custRes, itemsRes, invRes, vendorRes] = await Promise.all([
          supabase.from("bills").select("*").eq("company_id", company.id).ilike("bill_number", q).limit(5),
          supabase.from("customers").select("*").eq("company_id", company.id).ilike("name", q).limit(5),
          supabase.from("items").select("*").eq("company_id", company.id).ilike("item_name", q).limit(5),
          supabase.from("sales_invoices" as any).select("*").eq("company_id", company.id).ilike("invoice_number", q).limit(5),
          supabase.from("vendors").select("*").eq("company_id", company.id).ilike("name", q).limit(5),
        ]);

        (billsRes.data || []).forEach((b) => newNodes.push(makeNode("bills", b)));
        (custRes.data || []).forEach((c) => newNodes.push(makeNode("customers", c)));
        (itemsRes.data || []).forEach((i) => newNodes.push(makeNode("items", i)));
        (invRes.data || []).forEach((inv: any) => newNodes.push(makeNode("sales_invoices", inv)));
        (vendorRes.data || []).forEach((v) => newNodes.push(makeNode("vendors", v)));

        if (newNodes.length === 0) {
          toast.info("No records found matching search query");
        } else {
          addData(newNodes, []);
          toast.success(`Found ${newNodes.length} matching entities`);
        }
      } catch (err: any) {
        toast.error("Failed to search data");
      } finally {
        setIsLoading(false);
      }
    },
    [company?.id, addData, clearGraph]
  );

  return {
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values()),
    isLoading,
    activePreset,
    initGraph,
    loadOverdueDebtors,
    loadCashTrail,
    loadInventoryMap,
    searchEntities,
    expandNode,
    clearGraph,
  };
}
