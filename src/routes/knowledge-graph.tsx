import { createFileRoute } from "@tanstack/react-router";
import { KnowledgeGraph } from "@/components/knowledge-graph/KnowledgeGraph";
import { Network } from "lucide-react";

export const Route = createFileRoute("/knowledge-graph")({
  component: KnowledgeGraphPage,
});

function KnowledgeGraphPage() {
  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="flex items-center gap-3 border-b bg-card px-6 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Network className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-foreground">Knowledge Graph</h1>
          <p className="text-[10px] text-muted-foreground">
            Explore all data entities and their relationships across the Bizastra ERP system
          </p>
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1 overflow-hidden p-3">
        <KnowledgeGraph />
      </div>
    </div>
  );
}
