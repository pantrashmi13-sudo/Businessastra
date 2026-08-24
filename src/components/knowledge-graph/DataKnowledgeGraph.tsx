import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useDataGraph, type DataNode, type DataEdge } from "@/hooks/use-data-graph";
import { computeDataLayout, type LayoutDataNode } from "@/lib/knowledge-graph/data-layout";
import { getEdgePath, getEdgeMidpoint } from "@/lib/knowledge-graph/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  Network,
  X,
  RefreshCw,
  Building2,
  Users,
  Store,
  Package,
  Warehouse,
  Receipt,
  FileText,
  Truck,
  CreditCard,
  Coins,
  Layers,
  ArrowLeftRight,
  ExternalLink,
  Download,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

const NODE_COLORS: Record<string, string> = {
  core: "#6366f1",
  master: "#10b981",
  transaction: "#f59e0b",
  financial: "#8b5cf6",
  inventory: "#06b6d4",
  accounting: "#ec4899",
};

const STATUS_BORDER_COLORS: Record<string, string> = {
  paid: "#10b981",
  approved: "#10b981",
  unpaid: "#ef4444",
  critical: "#ef4444",
  pending: "#f59e0b",
  partial: "#f59e0b",
  active: "#6366f1",
};

const NODE_RADIUS = 26;

export function DataKnowledgeGraph() {
  const navigate = useNavigate();
  const {
    nodes,
    edges,
    isLoading,
    activePreset,
    initGraph,
    loadOverdueDebtors,
    loadCashTrail,
    loadInventoryMap,
    searchEntities,
    expandNode,
  } = useDataGraph();

  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });

  // Node Dragging State
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const pinnedPositions = useRef<Map<string, { x: number; y: number; fx?: number | null; fy?: number | null }>>(
    new Map()
  );

  // Compute Layout preserving pinned coordinates
  const layout = useMemo(() => {
    const res = computeDataLayout(
      nodes,
      edges,
      { width: 1400, height: 900, iterations: 220 },
      pinnedPositions.current
    );
    res.forEach((n) => {
      pinnedPositions.current.set(n.id, { x: n.x, y: n.y, fx: n.fx, fy: n.fy });
    });
    return res;
  }, [nodes, edges]);

  const nodeMap = useMemo(() => {
    const m = new Map<string, LayoutDataNode>();
    layout.forEach((n) => m.set(n.id, n));
    return m;
  }, [layout]);

  useEffect(() => {
    initGraph();
  }, [initGraph]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchEntities(searchQuery);
  };

  const handleNodeClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNode(id);
  };

  const handleNodeDoubleClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    expandNode(id);
  };

  // Node Drag Handlers
  const handleNodeMouseDown = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggedNodeId(id);
    setSelectedNode(id);
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (draggedNodeId && svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - pan.x) / zoom;
        const mouseY = (e.clientY - rect.top - pan.y) / zoom;

        pinnedPositions.current.set(draggedNodeId, {
          x: mouseX,
          y: mouseY,
          fx: mouseX,
          fy: mouseY,
        });

        const targetNode = nodeMap.get(draggedNodeId);
        if (targetNode) {
          targetNode.x = mouseX;
          targetNode.y = mouseY;
          targetNode.fx = mouseX;
          targetNode.fy = mouseY;
          setPan((p) => ({ ...p }));
        }
      } else if (isPanning) {
        setPan({
          x: e.clientX - panStart.current.x,
          y: e.clientY - panStart.current.y,
        });
      }
    },
    [draggedNodeId, isPanning, nodeMap, pan, zoom]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggedNodeId(null);
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === svgRef.current || (e.target as SVGElement).tagName === "rect") {
        setIsPanning(true);
        panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      }
    },
    [pan]
  );

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.25, Math.min(3, z * delta)));
  }, []);

  const handleZoomIn = () => setZoom((z) => Math.min(z * 1.2, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z / 1.2, 0.25));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedNode(null);
    pinnedPositions.current.clear();
  };

  const handleExportSVG = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);
    const downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = `bizastra-knowledge-graph-${new Date().toISOString().slice(0, 10)}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const renderNodeIcon = (table: string, color: string) => {
    const props = { className: "h-4 w-4 stroke-[2.2]", style: { color } };
    switch (table) {
      case "companies":
        return <Building2 {...props} />;
      case "customers":
        return <Users {...props} />;
      case "vendors":
        return <Store {...props} />;
      case "items":
        return <Package {...props} />;
      case "warehouses":
        return <Warehouse {...props} />;
      case "bills":
        return <Receipt {...props} />;
      case "sales_invoices":
        return <FileText {...props} />;
      case "delivery_challans":
        return <Truck {...props} />;
      case "payment_vouchers":
        return <CreditCard {...props} />;
      case "receipt_vouchers":
        return <Coins {...props} />;
      case "fixed_assets":
        return <Layers {...props} />;
      case "stock_transfers":
        return <ArrowLeftRight {...props} />;
      default:
        return <Network {...props} />;
    }
  };

  const selectedNodeData = selectedNode ? nodeMap.get(selectedNode) : null;

  return (
    <div className="relative flex h-[calc(100vh-8rem)] w-full overflow-hidden rounded-xl border bg-card/60 shadow-inner">
      {/* Top Toolbar & Presets Bar */}
      <div className="absolute left-3 top-3 z-20 flex flex-wrap items-center gap-2">
        {/* Search */}
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search bills, customers, items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-56 rounded-lg pl-8 pr-7 text-xs bg-background/90 backdrop-blur shadow-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                initGraph();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </form>

        {/* Preset Filters */}
        <div className="flex items-center gap-1 rounded-lg border bg-background/90 p-0.5 backdrop-blur shadow-sm">
          <Button
            type="button"
            variant={activePreset === "all" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={initGraph}
          >
            🏢 All
          </Button>
          <Button
            type="button"
            variant={activePreset === "debtors" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={loadOverdueDebtors}
          >
            🔴 Overdue Debtors
          </Button>
          <Button
            type="button"
            variant={activePreset === "cash" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={loadCashTrail}
          >
            💰 Cash Trail
          </Button>
          <Button
            type="button"
            variant={activePreset === "inventory" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={loadInventoryMap}
          >
            📦 Warehouse & Stock
          </Button>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-background/90 backdrop-blur"
            onClick={handleZoomIn}
            title="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-background/90 backdrop-blur"
            onClick={handleZoomOut}
            title="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-background/90 backdrop-blur"
            onClick={handleReset}
            title="Reset view & unpin"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-background/90 backdrop-blur"
            onClick={handleExportSVG}
            title="Export graph as SVG"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          {isLoading && (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background/90 text-primary shadow-sm backdrop-blur">
              <RefreshCw className="h-4 w-4 animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Status Info Bar */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-3 rounded-lg border bg-background/90 px-3.5 py-1.5 text-[11px] text-muted-foreground shadow-sm backdrop-blur">
        <span className="font-semibold text-foreground">{nodes.length} Entities</span>
        <span className="text-border">|</span>
        <span>{edges.length} Relationships</span>
        <span className="text-border">|</span>
        <span className="text-primary font-medium">
          💡 Drag to reposition &middot; Double-click to expand
        </span>
      </div>

      {/* Mini-Map Radar (Bottom Right) */}
      <div className="absolute bottom-3 right-3 z-20 hidden md:block w-36 h-28 rounded-lg border bg-background/90 p-1.5 shadow-md backdrop-blur">
        <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center justify-between">
          <span>Mini Map</span>
          <span className="text-[8px] font-normal">{Math.round(zoom * 100)}%</span>
        </div>
        <div className="relative w-full h-[76px] bg-muted/40 rounded border border-dashed overflow-hidden">
          {layout.map((n) => {
            const mx = (n.x / 1400) * 100;
            const my = (n.y / 900) * 100;
            const color = NODE_COLORS[n.type] || "#6366f1";
            return (
              <div
                key={n.id}
                className="absolute w-1.5 h-1.5 rounded-full transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${mx}%`,
                  top: `${my}%`,
                  backgroundColor: color,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Interactive SVG Canvas */}
      <svg
        ref={svgRef}
        className="h-full w-full select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isPanning ? "grabbing" : draggedNodeId ? "move" : "grab" }}
      >
        <defs>
          <pattern id="data-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#94a3b8" strokeWidth="0.5" opacity="0.15" />
          </pattern>

          {/* Standard Arrow */}
          <marker
            id="data-arrow"
            viewBox="0 0 10 10"
            refX="26"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
          </marker>

          {/* Green Flow Arrow */}
          <marker
            id="data-arrow-green"
            viewBox="0 0 10 10"
            refX="26"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981" />
          </marker>
        </defs>

        {/* Background Grid */}
        <rect width="100%" height="100%" fill="url(#data-grid)" onClick={() => setSelectedNode(null)} />

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Edges */}
          <g>
            {edges.map((edge) => {
              const source = nodeMap.get(edge.source);
              const target = nodeMap.get(edge.target);
              if (!source || !target) return null;

              const path = getEdgePath(source, target);
              const mid = getEdgeMidpoint(source, target);
              const isAnimated = edge.animated;
              const hasAmount = edge.amount !== undefined && edge.amount > 0;
              const isSelected = selectedNode === edge.source || selectedNode === edge.target;

              return (
                <g key={edge.id} className="group">
                  <path
                    d={path}
                    fill="none"
                    stroke={isSelected ? "#6366f1" : isAnimated ? "#10b981" : "#cbd5e1"}
                    strokeWidth={isSelected ? 2.5 : isAnimated ? 2 : 1.2}
                    strokeDasharray={isAnimated ? "6 4" : undefined}
                    markerEnd={isAnimated ? "url(#data-arrow-green)" : "url(#data-arrow)"}
                    className="transition-all duration-200"
                  />

                  {/* Clean Edge Label / Amount Badge */}
                  {zoom > 0.5 && (
                    <g transform={`translate(${mid.x}, ${mid.y})`}>
                      <rect
                        x={-36}
                        y={-8}
                        width={72}
                        height={16}
                        rx={8}
                        fill="#ffffff"
                        stroke="#cbd5e1"
                        strokeWidth={1}
                        className="shadow-sm"
                      />
                      <text
                        textAnchor="middle"
                        dy="3.5"
                        fill="#475569"
                        fontSize={8.5}
                        fontWeight={600}
                        className="pointer-events-none select-none"
                      >
                        {hasAmount ? `NPR ${edge.amount?.toLocaleString()}` : edge.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {/* Nodes */}
          <g>
            {layout.map((node) => {
              const isSelected = selectedNode === node.id;
              const isHovered = hoveredNode === node.id;
              const baseColor = NODE_COLORS[node.type] || "#6366f1";
              const ringColor = node.status ? STATUS_BORDER_COLORS[node.status] : baseColor;

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer"
                  onClick={(e) => handleNodeClick(node.id, e)}
                  onDoubleClick={(e) => handleNodeDoubleClick(node.id, e)}
                  onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  {/* Outer Pulsating Ring for Critical items */}
                  {node.status === "critical" && (
                    <circle
                      r={NODE_RADIUS + 5}
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth={1.5}
                      opacity={0.5}
                    />
                  )}

                  {/* Selection / Hover Glow */}
                  {(isSelected || isHovered) && (
                    <circle
                      r={NODE_RADIUS + 6}
                      fill={baseColor}
                      fillOpacity={0.18}
                      stroke={baseColor}
                      strokeWidth={1.5}
                    />
                  )}

                  {/* Main Node Circle */}
                  <circle
                    r={NODE_RADIUS}
                    fill="#ffffff"
                    stroke={isSelected ? "#6366f1" : ringColor}
                    strokeWidth={isSelected ? 3 : 2}
                    className="transition-all duration-200"
                  />

                  {/* Inner Node Icon */}
                  <foreignObject
                    x={-NODE_RADIUS + 6}
                    y={-NODE_RADIUS + 6}
                    width={NODE_RADIUS * 2 - 12}
                    height={NODE_RADIUS * 2 - 12}
                    className="pointer-events-none"
                  >
                    <div className="flex h-full w-full items-center justify-center bg-transparent">
                      {renderNodeIcon(node.table, baseColor)}
                    </div>
                  </foreignObject>

                  {/* Primary Node Text Label */}
                  <g transform={`translate(0, ${NODE_RADIUS + 12})`}>
                    <text
                      textAnchor="middle"
                      dy="0"
                      fill={isSelected ? "#4338ca" : "#1e293b"}
                      fontSize={10.5}
                      fontWeight={isSelected ? 700 : 600}
                      className="pointer-events-none select-none drop-shadow-sm"
                    >
                      {node.label.length > 20 ? node.label.slice(0, 20) + "…" : node.label}
                    </text>
                    {node.subLabel && (
                      <text
                        textAnchor="middle"
                        dy="12"
                        fill="#64748b"
                        fontSize={8.5}
                        fontWeight={500}
                        className="pointer-events-none select-none"
                      >
                        {node.subLabel}
                      </text>
                    )}
                  </g>
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {/* Right Details Drawer */}
      {selectedNodeData && (
        <div className="absolute right-0 top-0 z-30 h-full w-84 animate-in slide-in-from-right duration-200 border-l bg-background/95 shadow-2xl backdrop-blur">
          <div className="flex h-full flex-col">
            {/* Drawer Header */}
            <div className="flex items-start justify-between border-b p-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl border bg-muted/40"
                  style={{ borderColor: `${NODE_COLORS[selectedNodeData.type]}40` }}
                >
                  {renderNodeIcon(selectedNodeData.table, NODE_COLORS[selectedNodeData.type])}
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight text-foreground">{selectedNodeData.label}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px] capitalize px-1.5 py-0">
                      {selectedNodeData.table.replace(/_/g, " ")}
                    </Badge>
                    {selectedNodeData.status && (
                      <Badge
                        variant="secondary"
                        className="text-[9px] uppercase px-1.5 py-0 font-bold"
                        style={{
                          color: STATUS_BORDER_COLORS[selectedNodeData.status] || "currentColor",
                        }}
                      >
                        {selectedNodeData.status}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedNode(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Drawer Actions */}
            <div className="grid grid-cols-2 gap-2 p-3 border-b bg-muted/20">
              <Button
                size="sm"
                className="h-8 text-xs font-medium"
                onClick={() => expandNode(selectedNodeData.id)}
                disabled={isLoading}
              >
                <Network className="mr-1.5 h-3.5 w-3.5" />
                Expand Links
              </Button>

              {selectedNodeData.routeUrl ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-medium"
                  onClick={() => navigate({ to: selectedNodeData.routeUrl as any })}
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Open in ERP
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="h-8 text-xs font-medium" disabled>
                  No Direct URL
                </Button>
              )}
            </div>

            {/* Node Data Inspector */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {selectedNodeData.amount !== undefined && selectedNodeData.amount > 0 && (
                  <div className="rounded-xl border bg-primary/5 p-3 flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">Total Transaction Value</div>
                    <div className="text-sm font-bold text-primary">
                      NPR {selectedNodeData.amount.toLocaleString()}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Record Attributes
                  </h4>
                  <div className="rounded-xl border bg-muted/40 divide-y divide-border/60 overflow-hidden">
                    {Object.entries(selectedNodeData.data).map(([key, value]) => {
                      if (
                        key === "id" ||
                        key === "company_id" ||
                        key === "user_id" ||
                        key === "extracted_json" ||
                        value === null ||
                        typeof value === "object"
                      )
                        return null;

                      return (
                        <div key={key} className="flex justify-between items-center px-3 py-2 text-xs">
                          <span className="text-muted-foreground capitalize font-medium">
                            {key.replace(/_/g, " ")}
                          </span>
                          <span className="font-semibold text-foreground max-w-[160px] truncate text-right">
                            {String(value)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
}
