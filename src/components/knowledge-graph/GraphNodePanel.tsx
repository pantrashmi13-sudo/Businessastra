import {
  type GraphNode,
  getClusterForNode,
  getConnectedNodes,
  type GraphEdge,
} from "@/lib/knowledge-graph/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, ArrowRight, Database, Link2, Unlink, GitBranch, Table2 } from "lucide-react";

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
  const connected = getConnectedNodes(node.id);

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
    <div className="absolute right-0 top-0 z-30 h-full w-80 border-l bg-card shadow-xl">
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b p-4">
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

            {/* Stats */}
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
                {node.columns.map((col) => (
                  <div
                    key={col}
                    className="flex items-center gap-2 rounded bg-muted/30 px-2 py-1 text-[10px]"
                  >
                    <Database className="h-2.5 w-2.5 shrink-0 text-muted-foreground/50" />
                    <span className="font-mono text-foreground">{col}</span>
                  </div>
                ))}
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
