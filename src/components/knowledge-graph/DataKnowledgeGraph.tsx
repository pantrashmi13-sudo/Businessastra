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
  LayoutGrid,
  GitGraph,
  ChevronRight,
  ChevronDown,
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
  const [viewMode, setViewMode] = useState<"graph" | "cards">("graph");
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });

  // Touch State for Mobile Pinch & Pan
  const touchStartDist = useRef<number | null>(null);
  const touchStartPan = useRef({ x: 0, y: 0 });

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
      { width: 1400, height: 900, iterations: 200 },
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

  const handleNodeClick = (id: string, e: React.MouseEvent | React.TouchEvent) => {
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

  // Mouse pan/drag handlers
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

  // Touch Handlers for Mobile (Pinch to zoom & single finger pan)
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        setIsPanning(true);
        panStart.current = {
          x: e.touches[0].clientX - pan.x,
          y: e.touches[0].clientY - pan.y,
        };
      } else if (e.touches.length === 2) {
        setIsPanning(false);
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        touchStartDist.current = dist;
      }
    },
    [pan]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1 && isPanning) {
        setPan({
          x: e.touches[0].clientX - panStart.current.x,
          y: e.touches[0].clientY - panStart.current.y,
        });
      } else if (e.touches.length === 2 && touchStartDist.current !== null) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const scaleFactor = dist / touchStartDist.current;
        setZoom((z) => Math.max(0.25, Math.min(3, z * (scaleFactor > 1 ? 1.03 : 0.97))));
        touchStartDist.current = dist;
      }
    },
    [isPanning]
  );

  const handleTouchEnd = useCallback(() => {
    setIsPanning(false);
    touchStartDist.current = null;
  }, []);

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
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card/60 shadow-inner">
      {/* Top Responsive Control Bar */}
      <div className="z-20 flex flex-col gap-2 border-b bg-background/95 p-2 sm:p-3 backdrop-blur shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Search Input */}
          <form onSubmit={handleSearch} className="relative flex-1 min-w-[180px] max-w-xs sm:max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search bills, customers, items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-full rounded-lg pl-8 pr-7 text-xs bg-muted/40"
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

          {/* View Mode & View Controls */}
          <div className="flex items-center gap-1">
            {/* Toggle Graph vs Card Explorer Mode */}
            <div className="flex items-center rounded-lg border bg-muted/30 p-0.5">
              <Button
                variant={viewMode === "graph" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs flex items-center gap-1"
                onClick={() => setViewMode("graph")}
                title="Graph Visual View"
              >
                <GitGraph className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Graph</span>
              </Button>
              <Button
                variant={viewMode === "cards" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs flex items-center gap-1"
                onClick={() => setViewMode("cards")}
                title="Card List Explorer (Mobile Friendly)"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </Button>
            </div>

            {viewMode === "graph" && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 sm:h-8 sm:w-8"
                  onClick={handleZoomIn}
                  title="Zoom In"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 sm:h-8 sm:w-8"
                  onClick={handleZoomOut}
                  title="Zoom Out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 sm:h-8 sm:w-8"
                  onClick={handleReset}
                  title="Reset View"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="hidden sm:inline-flex h-8 w-8"
                  onClick={handleExportSVG}
                  title="Export SVG"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </>
            )}

            {isLoading && (
              <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center text-primary">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Preset Filters - Swipeable on mobile */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <Button
            type="button"
            variant={activePreset === "all" ? "secondary" : "outline"}
            size="sm"
            className="h-6.5 text-[11px] px-2.5 shrink-0 rounded-full"
            onClick={initGraph}
          >
            🏢 All
          </Button>
          <Button
            type="button"
            variant={activePreset === "debtors" ? "secondary" : "outline"}
            size="sm"
            className="h-6.5 text-[11px] px-2.5 shrink-0 rounded-full"
            onClick={loadOverdueDebtors}
          >
            🔴 Overdue Debtors
          </Button>
          <Button
            type="button"
            variant={activePreset === "cash" ? "secondary" : "outline"}
            size="sm"
            className="h-6.5 text-[11px] px-2.5 shrink-0 rounded-full"
            onClick={loadCashTrail}
          >
            💰 Cash Trail
          </Button>
          <Button
            type="button"
            variant={activePreset === "inventory" ? "secondary" : "outline"}
            size="sm"
            className="h-6.5 text-[11px] px-2.5 shrink-0 rounded-full"
            onClick={loadInventoryMap}
          >
            📦 Warehouse & Stock
          </Button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="relative flex-1 overflow-hidden">
        {viewMode === "graph" ? (
          <>
            {/* Interactive SVG Canvas */}
            <svg
              ref={svgRef}
              className="h-full w-full select-none touch-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onWheel={handleWheel}
              style={{ cursor: isPanning ? "grabbing" : draggedNodeId ? "move" : "grab" }}
            >
              <defs>
                <pattern id="data-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#94a3b8" strokeWidth="0.5" opacity="0.15" />
                </pattern>

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
                        />

                        {zoom > 0.45 && (
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
                        {/* Larger touch hit target area for mobile tap */}
                        <circle r={NODE_RADIUS + 12} fill="transparent" />

                        {/* Critical Ping Ring */}
                        {node.status === "critical" && (
                          <circle r={NODE_RADIUS + 5} fill="none" stroke="#ef4444" strokeWidth={1.5} opacity={0.5} />
                        )}

                        {/* Hover/Selection Halo */}
                        {(isSelected || isHovered) && (
                          <circle r={NODE_RADIUS + 6} fill={baseColor} fillOpacity={0.18} stroke={baseColor} strokeWidth={1.5} />
                        )}

                        {/* Main Node Circle */}
                        <circle
                          r={NODE_RADIUS}
                          fill="#ffffff"
                          stroke={isSelected ? "#6366f1" : ringColor}
                          strokeWidth={isSelected ? 3 : 2}
                          className="transition-all duration-200"
                        />

                        {/* Node Icon */}
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

                        {/* Node Labels */}
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

            {/* Bottom Status Info Bar */}
            <div className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-2 rounded-lg border bg-background/90 px-3 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur">
              <span className="font-semibold text-foreground">{nodes.length} Items</span>
              <span className="hidden sm:inline text-border">|</span>
              <span className="hidden sm:inline">{edges.length} Links</span>
              <span className="text-border">|</span>
              <span className="text-primary text-[10px] sm:text-[11px]">
                Tap node for info &middot; Double tap to expand
              </span>
            </div>
          </>
        ) : (
          /* Mobile-First Card Explorer View */
          <ScrollArea className="h-full p-3 sm:p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-24">
              {nodes.map((node) => {
                const baseColor = NODE_COLORS[node.type] || "#6366f1";
                const isSelected = selectedNode === node.id;

                return (
                  <div
                    key={node.id}
                    className={`rounded-xl border bg-card p-3.5 shadow-sm transition-all duration-200 hover:shadow-md cursor-pointer ${
                      isSelected ? "ring-2 ring-primary border-transparent" : "border-border"
                    }`}
                    onClick={() => setSelectedNode(node.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted/30"
                          style={{ borderColor: `${baseColor}40` }}
                        >
                          {renderNodeIcon(node.table, baseColor)}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-foreground line-clamp-1">{node.label}</h4>
                          <p className="text-[11px] text-muted-foreground">{node.subLabel || node.table}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                        {node.table.replace(/_/g, " ")}
                      </Badge>
                    </div>

                    {/* Card Actions */}
                    <div className="mt-3 pt-2.5 border-t flex items-center justify-between gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs px-2 flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          expandNode(node.id);
                        }}
                      >
                        <Network className="mr-1 h-3 w-3" />
                        Expand Links
                      </Button>

                      {node.routeUrl && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate({ to: node.routeUrl as any });
                          }}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {/* Responsive Details Drawer / Bottom Sheet */}
        {selectedNodeData && (
          <div className="absolute z-30 inset-x-0 bottom-0 max-h-[75vh] md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:max-h-full md:h-full md:w-84 flex flex-col rounded-t-2xl md:rounded-none border-t md:border-t-0 md:border-l bg-background/95 shadow-2xl backdrop-blur animate-in slide-in-from-bottom md:slide-in-from-right duration-200">
            {/* Mobile Handle Bar */}
            <div className="md:hidden flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-start justify-between border-b p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-muted/40"
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

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2 p-2.5 sm:p-3 border-b bg-muted/20">
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
                  No URL
                </Button>
              )}
            </div>

            {/* Attributes List */}
            <ScrollArea className="flex-1 p-3 sm:p-4">
              <div className="space-y-3 pb-8">
                {selectedNodeData.amount !== undefined && selectedNodeData.amount > 0 && (
                  <div className="rounded-xl border bg-primary/5 p-3 flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">Value</div>
                    <div className="text-sm font-bold text-primary">
                      NPR {selectedNodeData.amount.toLocaleString()}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Attributes
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
                        <div key={key} className="flex justify-between items-center px-3 py-1.5 text-xs">
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
        )}
      </div>
    </div>
  );
}
