import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  getAllNodes,
  getAllEdges,
  getNode,
  getConnectedNodes,
  getShortestPath,
  getClusterForNode,
  getGraphStats,
  type GraphNode,
  type GraphEdge,
  CLUSTERS,
} from "@/lib/knowledge-graph/schema";
import { computeLayout, getEdgePath, getEdgeMidpoint } from "@/lib/knowledge-graph/layout";
import { GraphNodePanel } from "./GraphNodePanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ZoomIn, ZoomOut, RotateCcw, Search, Network, X, ArrowRight } from "lucide-react";

const NODE_COLORS: Record<string, string> = {
  core: "#6366f1",
  master: "#10b981",
  transaction: "#f59e0b",
  financial: "#8b5cf6",
  inventory: "#14b8a6",
  accounting: "#f97316",
};

const NODE_RADIUS = 24;
const ARROW_SIZE = 8;

export function KnowledgeGraph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedPath, setHighlightedPath] = useState<string[] | null>(null);
  const [pathTarget, setPathTarget] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const [showClusters, setShowClusters] = useState(true);

  const stats = useMemo(() => getGraphStats(), []);

  // Compute layout once
  const layout = useMemo(() => {
    const nodes = getAllNodes();
    const edges = getAllEdges();
    return computeLayout(nodes, edges, { width: 1400, height: 900, iterations: 250 });
  }, []);

  const nodeMap = useMemo(() => {
    const m = new Map<string, GraphNode>();
    layout.forEach((n) => m.set(n.id, n));
    return m;
  }, [layout]);

  const allEdges = useMemo(() => getAllEdges(), []);

  // Filter nodes by search
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return layout;
    const q = searchQuery.toLowerCase();
    return layout.filter(
      (n) =>
        n.label.toLowerCase().includes(q) ||
        n.entity.toLowerCase().includes(q) ||
        n.description.toLowerCase().includes(q),
    );
  }, [layout, searchQuery]);

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  // Connected nodes for highlight
  const connectedIds = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    return new Set(getConnectedNodes(selectedNode).map((n) => n.id));
  }, [selectedNode]);

  // Path finding
  const handlePathFind = useCallback(
    (targetId: string) => {
      if (!selectedNode) return;
      const path = getShortestPath(selectedNode, targetId);
      setHighlightedPath(path);
      setPathTarget(targetId);
    },
    [selectedNode],
  );

  const clearPath = useCallback(() => {
    setHighlightedPath(null);
    setPathTarget(null);
  }, []);

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(z * 1.2, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z / 1.2, 0.3));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedNode(null);
    clearPath();
  };

  // Pan handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === svgRef.current || (e.target as SVGElement).tagName === "rect") {
        setIsPanning(true);
        panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      }
    },
    [pan],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setPan({
          x: e.clientX - panStart.current.x,
          y: e.clientY - panStart.current.y,
        });
      }
    },
    [isPanning],
  );

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.3, Math.min(3, z * delta)));
  }, []);

  const selectedNodeData = selectedNode ? nodeMap.get(selectedNode) : null;

  return (
    <div className="relative flex h-[calc(100vh-8rem)] w-full overflow-hidden rounded-lg border bg-card">
      {/* Toolbar */}
      <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search entities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-52 pl-8 text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={handleZoomIn}
          title="Zoom in"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={handleZoomOut}
          title="Zoom out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={handleReset}
          title="Reset view"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant={showClusters ? "default" : "outline"}
          size="icon"
          className="h-8 w-8"
          onClick={() => setShowClusters((s) => !s)}
          title="Toggle cluster backgrounds"
        >
          <Network className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Stats bar */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-3 rounded-md border bg-background/90 px-3 py-1.5 text-[10px] text-muted-foreground backdrop-blur">
        <span>{stats.totalNodes} entities</span>
        <span>{stats.totalEdges} relationships</span>
        {highlightedPath && (
          <span className="flex items-center gap-1 text-primary">
            <ArrowRight className="h-3 w-3" />
            Path: {highlightedPath.length} hops
            <button onClick={clearPath} className="ml-1 text-destructive hover:underline">
              clear
            </button>
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 right-3 z-20 flex flex-wrap gap-1.5 rounded-md border bg-background/90 px-3 py-2 text-[10px] backdrop-blur">
        {CLUSTERS.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setSearchQuery(c.label);
            }}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-muted"
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: c.color }}
            />
            <span className="text-muted-foreground">{c.label}</span>
          </button>
        ))}
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        className="h-full w-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isPanning ? "grabbing" : "grab" }}
      >
        <defs>
          {/* Arrow markers */}
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth={ARROW_SIZE}
            markerHeight={ARROW_SIZE}
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
          </marker>
          <marker
            id="arrow-highlight"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth={ARROW_SIZE}
            markerHeight={ARROW_SIZE}
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
          </marker>
          <marker
            id="arrow-dim"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth={ARROW_SIZE}
            markerHeight={ARROW_SIZE}
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#cbd5e1" />
          </marker>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Background */}
          <rect x="-5000" y="-5000" width="10000" height="10000" fill="transparent" />

          {/* Cluster backgrounds */}
          {showClusters &&
            CLUSTERS.map((cluster) => {
              const clusterNodes = cluster.nodeIds
                .map((id) => nodeMap.get(id))
                .filter(Boolean) as GraphNode[];
              if (clusterNodes.length === 0) return null;

              const minX = Math.min(...clusterNodes.map((n) => n.x)) - 60;
              const maxX = Math.max(...clusterNodes.map((n) => n.x)) + 60;
              const minY = Math.min(...clusterNodes.map((n) => n.y)) - 60;
              const maxY = Math.max(...clusterNodes.map((n) => n.y)) + 60;

              return (
                <g key={cluster.id}>
                  <rect
                    x={minX}
                    y={minY}
                    width={maxX - minX}
                    height={maxY - minY}
                    rx={12}
                    fill={cluster.color}
                    fillOpacity={0.04}
                    stroke={cluster.color}
                    strokeOpacity={0.12}
                    strokeWidth={1}
                    strokeDasharray="4 2"
                  />
                  <text
                    x={minX + 8}
                    y={minY + 14}
                    fill={cluster.color}
                    fillOpacity={0.5}
                    fontSize={10}
                    fontWeight={600}
                  >
                    {cluster.label}
                  </text>
                </g>
              );
            })}

          {/* Edges */}
          {allEdges.map((edge) => {
            const source = nodeMap.get(edge.source);
            const target = nodeMap.get(edge.target);
            if (!source || !target) return null;

            // Compute curve offset for parallel edges
            const parallelCount = allEdges
              .filter(
                (e) =>
                  (e.source === edge.source && e.target === edge.target) ||
                  (e.source === edge.target && e.target === edge.source),
              )
              .indexOf(edge);
            const curveOffset = parallelCount * 15;

            const path = getEdgePath(source, target, curveOffset);
            const midpoint = getEdgeMidpoint(source, target);

            const isHighlighted =
              highlightedPath &&
              highlightedPath.includes(edge.source) &&
              highlightedPath.includes(edge.target) &&
              Math.abs(
                highlightedPath.indexOf(edge.source) - highlightedPath.indexOf(edge.target),
              ) === 1;

            const isDimmed =
              selectedNode &&
              edge.source !== selectedNode &&
              edge.target !== selectedNode &&
              !isHighlighted;

            return (
              <g
                key={edge.id}
                className="transition-opacity duration-200"
                style={{ opacity: isDimmed ? 0.15 : 1 }}
              >
                <path
                  d={path}
                  fill="none"
                  stroke={isHighlighted ? "#3b82f6" : "#94a3b8"}
                  strokeWidth={isHighlighted ? 2.5 : 1}
                  markerEnd={isHighlighted ? "url(#arrow-highlight)" : "url(#arrow)"}
                />
                {zoom > 0.6 && (
                  <text
                    x={midpoint.x}
                    y={midpoint.y - 4}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize={8}
                    className="pointer-events-none select-none"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {layout.map((node) => {
            const color = NODE_COLORS[node.type] || "#64748b";
            const isSelected = selectedNode === node.id;
            const isConnected = connectedIds.has(node.id);
            const isPathNode = highlightedPath?.includes(node.id);
            const isSearchMatch = searchQuery && filteredNodeIds.has(node.id);
            const isDimmed =
              selectedNode && !isSelected && !isConnected && !isPathNode && !isSearchMatch;

            const r = isSelected ? NODE_RADIUS + 4 : isConnected ? NODE_RADIUS + 2 : NODE_RADIUS;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                className="cursor-pointer transition-all duration-200"
                style={{ opacity: isDimmed ? 0.2 : 1 }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (pathTarget || (selectedNode && selectedNode !== node.id && highlightedPath)) {
                    handlePathFind(node.id);
                  } else {
                    setSelectedNode(isSelected ? null : node.id);
                    clearPath();
                  }
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setSelectedNode(node.id);
                }}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {/* Glow for selected/connected */}
                {(isSelected || isConnected || isPathNode) && (
                  <circle
                    r={r + 6}
                    fill={color}
                    fillOpacity={0.15}
                    stroke={color}
                    strokeOpacity={0.3}
                    strokeWidth={1}
                  />
                )}

                {/* Node circle */}
                <circle
                  r={r}
                  fill={isSelected ? color : `${color}20`}
                  stroke={color}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  className="transition-all duration-200"
                />

                {/* Node label */}
                <text
                  textAnchor="middle"
                  dy={-r - 6}
                  fill={isSelected || isConnected ? color : "#475569"}
                  fontSize={isSelected ? 12 : 10}
                  fontWeight={isSelected ? 700 : 500}
                  className="pointer-events-none select-none"
                >
                  {node.label}
                </text>

                {/* Entity name (small) */}
                {zoom > 0.5 && (
                  <text
                    textAnchor="middle"
                    dy={r + 12}
                    fill="#94a3b8"
                    fontSize={8}
                    className="pointer-events-none select-none"
                  >
                    {node.entity}
                  </text>
                )}

                {/* Edge count badge */}
                {zoom > 0.4 && (
                  <g transform={`translate(${r - 4}, ${-r + 4})`}>
                    <circle r={7} fill={color} />
                    <text
                      textAnchor="middle"
                      dy={3}
                      fill="white"
                      fontSize={7}
                      fontWeight={700}
                      className="pointer-events-none select-none"
                    >
                      {node.outgoing.length + node.incoming.length}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Tooltip on hover */}
          {hoveredNode &&
            !selectedNode &&
            (() => {
              const node = nodeMap.get(hoveredNode);
              if (!node) return null;
              const color = NODE_COLORS[node.type] || "#64748b";
              return (
                <g transform={`translate(${node.x}, ${node.y + NODE_RADIUS + 20})`}>
                  <rect
                    x={-90}
                    y={-8}
                    width={180}
                    height={30}
                    rx={6}
                    fill="hsl(var(--popover))"
                    stroke="hsl(var(--border))"
                    strokeWidth={1}
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
                  />
                  <text
                    textAnchor="middle"
                    dy={5}
                    fill="hsl(var(--popover-foreground))"
                    fontSize={9}
                  >
                    {node.description.slice(0, 50)}
                    {node.description.length > 50 ? "..." : ""}
                  </text>
                </g>
              );
            })()}
        </g>
      </svg>

      {/* Selected node panel */}
      {selectedNodeData && (
        <GraphNodePanel
          node={selectedNodeData}
          allNodes={layout}
          onClose={() => {
            setSelectedNode(null);
            clearPath();
          }}
          onNavigate={(id) => {
            setSelectedNode(id);
            clearPath();
          }}
          onFindPath={handlePathFind}
          highlightedPath={highlightedPath}
          pathTarget={pathTarget}
        />
      )}
    </div>
  );
}
