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
  id: string;
  table: string;
  label: string;
  subLabel?: string;
  type: EntityCategory;
  status?: "paid" | "unpaid" | "partial" | "approved" | "pending" | "critical" | "active";
  amount?: number;
  data: Record<string, any>;
  routeUrl?: string;
  isGroup?: boolean; // group/category nodes (Customers, Vendors, VAT, CoA)
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
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

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
    setExpandedNodes(new Set());
  }, []);

  const makeNode = (table: string, row: any): DataNode => {
    const id = `${table}:${row.id}`;
    let label = row.name || row.id.substring(0, 8);
    let subLabel: string | undefined = undefined;
    let type: EntityCategory = "core";
    let status: DataNode["status"] = undefined;
    let amount: number | undefined = undefined;
    let routeUrl: string | undefined = undefined;
    let isGroup = false;

    switch (table) {
      case "companies":
        label = row.name || "Company";
        subLabel = row.pan ? `PAN: ${row.pan}` : "Headquarters";
        type = "core";
        status = "active";
        break;

      // ── Virtual group nodes ──────────────────────────────────────
      case "customer-group":
        label = "Customers";
        subLabel = "All clients";
        type = "master";
        status = "active";
        isGroup = true;
        break;

      case "vendor-group":
        label = "Vendors";
        subLabel = "All suppliers";
        type = "master";
        status = "active";
        isGroup = true;
        break;

      case "vat-group":
        label = "VAT";
        subLabel = "Tax register";
        type = "financial";
        status = "pending";
        isGroup = true;
        break;

      case "coa-group":
        label = "Chart of Accounts";
        subLabel = "Ledger structure";
        type = "accounting";
        status = "active";
        isGroup = true;
        break;
      // ────────────────────────────────────────────────────────────

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
        amount = Number(row.total_amount ?? row.amount ?? 0);
        subLabel = `NPR ${amount.toLocaleString()} Out`;
        type = "financial";
        status = "paid";
        routeUrl = `/receipt-payment`;
        break;

      case "receipt_vouchers":
        label = `Receipt #${row.voucher_number || row.id.substring(0, 6)}`;
        amount = Number(row.total_amount ?? row.amount ?? 0);
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

      case "chart_of_accounts":
        label = row.name || "Account";
        subLabel = `${row.classification || ""} · ${row.type || ""}`;
        type = "accounting";
        break;

      case "vat-entry":
        label = `VAT: ${row.label}`;
        subLabel = `NPR ${Number(row.amount ?? 0).toLocaleString()}`;
        type = "financial";
        amount = Number(row.amount ?? 0);
        status = row.amount > 0 ? "approved" : "pending";
        break;

      default:
        label = row.name || row.title || row.id.substring(0, 8);
        type = "core";
    }

    return { id, table, label, subLabel, type, status, amount, data: row, routeUrl, isGroup };
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

      // 🏢 Expand Company → show group category nodes
      if (table === "companies") {
        const companyId = rowId;
        const groupDefs = [
          { table: "customer-group", id: `customer-group:${companyId}`, name: "Customers", link: "client" },
          { table: "vendor-group", id: `vendor-group:${companyId}`, name: "Vendors", link: "supplier" },
          { table: "vat-group", id: `vat-group:${companyId}`, name: "VAT", link: "tax" },
          { table: "coa-group", id: `coa-group:${companyId}`, name: "CoA", link: "ledger" },
        ];

        groupDefs.forEach(({ table: gt, id: gid, name, link }) => {
          newNodes.push(makeNode(gt, { id: companyId, name }));
          newEdges.push({ id: `${nodeId}-${gid}`, source: nodeId, target: gid, label: link });
        });
      }

      // 👥 Expand Customer Group → show all customers
      if (table === "customer-group") {
        const companyId = rowId;
        const { data: customers } = await supabase
          .from("customers")
          .select("*")
          .eq("company_id", companyId)
          .order("name", { ascending: true })
          .limit(20);

        (customers || []).forEach((c) => {
          const n = makeNode("customers", c);
          newNodes.push(n);
          newEdges.push({ id: `${nodeId}-${n.id}`, source: nodeId, target: n.id, label: "client" });
        });
      }

      // 🏭 Expand Vendor Group → show all vendors
      if (table === "vendor-group") {
        const companyId = rowId;
        const { data: vendors } = await supabase
          .from("vendors")
          .select("*")
          .eq("company_id", companyId)
          .order("name", { ascending: true })
          .limit(20);

        (vendors || []).forEach((v) => {
          const n = makeNode("vendors", v);
          newNodes.push(n);
          newEdges.push({ id: `${nodeId}-${n.id}`, source: nodeId, target: n.id, label: "supplier" });
        });
      }

      // 📊 Expand VAT Group → show VAT summary per invoice/bill
      if (table === "vat-group") {
        const companyId = rowId;
        const [salesRes, purchaseRes] = await Promise.all([
          supabase.from("sales_invoices" as any).select("id,invoice_number,vat_amount,total_amount,status,customer_id,customers(name)").eq("company_id", companyId).order("created_at", { ascending: false }).limit(10),
          supabase.from("bills").select("id,bill_number,vat_amount,final_amount,status,vendor_id,vendors(name)").eq("company_id", companyId).order("created_at", { ascending: false }).limit(10),
        ]);

        (salesRes.data || []).forEach((inv: any) => {
          const vatAmount = Number(inv.vat_amount ?? 0);
          const n: DataNode = {
            id: `vat-out:${inv.id}`,
            table: "vat-entry",
            label: `VAT Out: ${inv.invoice_number || inv.id.substring(0, 6)}`,
            subLabel: `NPR ${vatAmount.toLocaleString()} (${(inv as any).customers?.name || ""})`,
            type: "financial",
            status: "approved",
            amount: vatAmount,
            data: inv,
            isGroup: false,
          };
          newNodes.push(n);
          newEdges.push({ id: `${nodeId}-${n.id}`, source: nodeId, target: n.id, label: "output VAT", amount: vatAmount });
        });

        (purchaseRes.data || []).forEach((bill: any) => {
          const vatAmount = Number(bill.vat_amount ?? 0);
          const n: DataNode = {
            id: `vat-in:${bill.id}`,
            table: "vat-entry",
            label: `VAT In: ${bill.bill_number || bill.id.substring(0, 6)}`,
            subLabel: `NPR ${vatAmount.toLocaleString()} (${(bill as any).vendors?.name || ""})`,
            type: "accounting",
            status: "pending",
            amount: vatAmount,
            data: bill,
            isGroup: false,
          };
          newNodes.push(n);
          newEdges.push({ id: `${nodeId}-${n.id}`, source: nodeId, target: n.id, label: "input VAT", amount: vatAmount });
        });
      }

      // 📚 Expand Chart of Accounts Group → show COA
      if (table === "coa-group") {
        const companyId = rowId;
        const { data: coa } = await supabase
          .from("chart_of_accounts")
          .select("*")
          .eq("company_id", companyId)
          .order("account_code", { ascending: true })
          .limit(20);

        (coa || []).forEach((acct: any) => {
          const n = makeNode("chart_of_accounts", acct);
          newNodes.push(n);
          newEdges.push({ id: `${nodeId}-${n.id}`, source: nodeId, target: n.id, label: acct.classification || "account" });
        });
      }

      // 👤 Expand Customer
      if (table === "customers") {
        const [invoicesRes, challansRes, receiptsRes] = await Promise.all([
          supabase.from("sales_invoices" as any).select("*").eq("customer_id", rowId).order("created_at", { ascending: false }).limit(RELATION_LIMIT),
          supabase.from("delivery_challans" as any).select("*").eq("customer_id", rowId).order("created_at", { ascending: false }).limit(RELATION_LIMIT),
          supabase.from("receipt_vouchers" as any).select("*").eq("customer_id", rowId).order("created_at", { ascending: false }).limit(RELATION_LIMIT),
        ]);

        (invoicesRes.data || []).forEach((inv: any) => {
          const n = makeNode("sales_invoices", inv);
          newNodes.push(n);
          newEdges.push({ id: `${nodeId}-${n.id}`, source: nodeId, target: n.id, label: "invoiced", amount: Number(inv.total_amount ?? 0), date: inv.invoice_date, animated: true });
        });

        (challansRes.data || []).forEach((ch: any) => {
          const n = makeNode("delivery_challans", ch);
          newNodes.push(n);
          newEdges.push({ id: `${nodeId}-${n.id}`, source: nodeId, target: n.id, label: "dispatched" });
        });

        (receiptsRes.data || []).forEach((rc: any) => {
          const n = makeNode("receipt_vouchers", rc);
          newNodes.push(n);
          newEdges.push({ id: `${n.id}-${nodeId}`, source: n.id, target: nodeId, label: "payment received", amount: Number(rc.total_amount ?? 0), animated: true });
        });
      }

      // 🏭 Expand Vendor → show bills and payments
      if (table === "vendors") {
        const [billsRes, paymentsRes] = await Promise.all([
          supabase.from("bills").select("*").eq("vendor_id", rowId).order("created_at", { ascending: false }).limit(RELATION_LIMIT),
          supabase.from("payment_vouchers" as any).select("*").eq("vendor_id", rowId).order("created_at", { ascending: false }).limit(RELATION_LIMIT),
        ]);

        (billsRes.data || []).forEach((b) => {
          const n = makeNode("bills", b);
          newNodes.push(n);
          newEdges.push({ id: `${nodeId}-${n.id}`, source: nodeId, target: n.id, label: "billed", amount: Number(b.final_amount ?? 0), date: b.invoice_date || undefined });
        });

        (paymentsRes.data || []).forEach((p: any) => {
          const n = makeNode("payment_vouchers", p);
          newNodes.push(n);
          newEdges.push({ id: `${nodeId}-${n.id}`, source: nodeId, target: n.id, label: "paid out", amount: Number(p.total_amount ?? 0), animated: true });
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
        setExpandedNodes((prev) => {
          const next = new Set(prev);
          next.add(nodeId);
          return next;
        });
      } catch (err: any) {
        toast.error("Failed to fetch connected data");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    },
    [company?.id, addData]
  );

  const collapseNode = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      next.delete(nodeId);
      return next;
    });

    setEdges((prevEdges) => {
      const nextEdges = new Map(prevEdges);
      const edgeIdsToRemove = new Set<string>();
      
      // Find all edges extending *from* or *to* this node (that were dynamically added by expand)
      // Since it's a star-like expansion, mostly they are edges where source == nodeId.
      nextEdges.forEach((edge, id) => {
        if (edge.source === nodeId || edge.target === nodeId) {
          edgeIdsToRemove.add(id);
        }
      });
      
      edgeIdsToRemove.forEach((id) => nextEdges.delete(id));
      
      // Now remove orphan nodes (nodes that have no edges attached anymore, except root nodes)
      setNodes((prevNodes) => {
        const nextNodes = new Map(prevNodes);
        
        // Count edge connections
        const connectedCount = new Map<string, number>();
        nextEdges.forEach((edge) => {
          connectedCount.set(edge.source, (connectedCount.get(edge.source) || 0) + 1);
          connectedCount.set(edge.target, (connectedCount.get(edge.target) || 0) + 1);
        });

        // Remove nodes with 0 connections, unless it's the root company or the node itself
        nextNodes.forEach((node, id) => {
          if (!connectedCount.has(id) && id !== nodeId && node.table !== "companies") {
            // Keep group nodes if they belong to the company
            if (node.isGroup && id.endsWith(`:${company?.id}`)) return;
            nextNodes.delete(id);
          }
        });

        return nextNodes;
      });

      return nextEdges;
    });
  }, [company?.id]);

  // Initialize with Root Company — show group nodes (not raw data)
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
        // Create group category nodes
        const companyId = company.id;
        const groupNodes: DataNode[] = [
          { id: `customer-group:${companyId}`, table: "customer-group", label: "Customers", subLabel: "All clients", type: "master", status: "active", data: { id: companyId }, isGroup: true },
          { id: `vendor-group:${companyId}`, table: "vendor-group", label: "Vendors", subLabel: "All suppliers", type: "master", status: "active", data: { id: companyId }, isGroup: true },
          { id: `vat-group:${companyId}`, table: "vat-group", label: "VAT", subLabel: "Tax register", type: "financial", status: "pending", data: { id: companyId }, isGroup: true },
          { id: `coa-group:${companyId}`, table: "coa-group", label: "Chart of Accounts", subLabel: "Ledger structure", type: "accounting", status: "active", data: { id: companyId }, isGroup: true },
        ];
        const groupEdges: DataEdge[] = groupNodes.map((gn) => ({
          id: `${rootNode.id}-${gn.id}`,
          source: rootNode.id,
          target: gn.id,
          label: gn.table.replace("-group", ""),
        }));
        addData([rootNode, ...groupNodes], groupEdges);
      }
    } catch (err: any) {
      toast.error("Failed to initialize graph");
    } finally {
      setIsLoading(false);
    }
  }, [company?.id, addData, clearGraph]);

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

  // Preset 4: Item Rate Mismatch — same item purchased at different landing costs
  const loadItemRateMismatch = useCallback(async () => {
    if (!company?.id) return;
    clearGraph();
    setActivePreset("rate-mismatch");
    setIsLoading(true);

    try {
      const { data: lines, error } = await supabase
        .from("bill_lines")
        .select("id,ref_id,name,code,per_unit,landing_cost,quantity,bill_id,bills(id,bill_number,vendor_id,vendors(name))")
        .not("ref_id", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Group by item ref_id
      const byItem = new Map<string, any[]>();
      (lines || []).forEach((line: any) => {
        const key = line.ref_id;
        if (!byItem.has(key)) byItem.set(key, []);
        byItem.get(key)!.push(line);
      });

      const newNodes: DataNode[] = [];
      const newEdges: DataEdge[] = [];
      let mismatchCount = 0;

      byItem.forEach((itemLines, itemId) => {
        // Check if there are multiple distinct rates
        const rates = new Set(itemLines.map((l) => Number(l.landing_cost ?? l.per_unit ?? 0).toFixed(2)));
        if (rates.size <= 1) return; // no mismatch
        mismatchCount++;

        const firstName = itemLines[0]?.name || itemLines[0]?.code || itemId.substring(0, 8);
        const allRates = Array.from(rates).map((r) => `NPR ${r}`);
        // Item center node
        const itemNode: DataNode = {
          id: `mismatch-item:${itemId}`,
          table: "items",
          label: firstName,
          subLabel: `${rates.size} different rates ⚠️`,
          type: "inventory",
          status: "critical",
          data: { id: itemId, item_name: firstName },
          isGroup: false,
        };
        newNodes.push(itemNode);

        // Each bill line with that item as a separate node
        itemLines.forEach((line: any) => {
          const rate = Number(line.landing_cost ?? line.per_unit ?? 0);
          const billNum = (line.bills as any)?.bill_number || line.bill_id?.substring(0, 6);
          const vendorName = (line.bills as any)?.vendors?.name || "";
          const lineNode: DataNode = {
            id: `mismatch-line:${line.id}`,
            table: "bill_lines",
            label: `Bill #${billNum}`,
            subLabel: `NPR ${rate.toLocaleString()} / unit (${vendorName})`,
            type: "transaction",
            status: "pending",
            amount: rate,
            data: line,
            routeUrl: `/bills/${line.bill_id}`,
            isGroup: false,
          };
          newNodes.push(lineNode);
          newEdges.push({
            id: `${itemNode.id}-${lineNode.id}`,
            source: itemNode.id,
            target: lineNode.id,
            label: `NPR ${rate.toLocaleString()}`,
            amount: rate,
          });
        });
      });

      if (mismatchCount === 0) {
        toast.success("✅ No rate mismatches found — all item costs are consistent!");
      } else {
        addData(newNodes, newEdges);
        toast.warning(`⚠️ Found ${mismatchCount} items with different landing costs`);
      }
    } catch (err: any) {
      toast.error("Failed to load item rate mismatch");
      console.error(err);
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
    expandedNodes,
    initGraph,
    loadOverdueDebtors,
    loadCashTrail,
    loadInventoryMap,
    loadItemRateMismatch,
    searchEntities,
    expandNode,
    collapseNode,
    clearGraph,
  };
}
