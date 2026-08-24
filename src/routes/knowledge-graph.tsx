import { createFileRoute } from "@tanstack/react-router";
import { KnowledgeGraph } from "@/components/knowledge-graph/KnowledgeGraph";
import { DataKnowledgeGraph } from "@/components/knowledge-graph/DataKnowledgeGraph";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Network, Database } from "lucide-react";

export const Route = createFileRoute("/knowledge-graph")({
  component: KnowledgeGraphPage,
});

function KnowledgeGraphPage() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-background">
      {/* Responsive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b bg-card/60 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Network className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-foreground">Knowledge Graph</h1>
            <p className="text-[11px] text-muted-foreground line-clamp-1">
              Visual intelligence & relational data explorer for Bizastra ERP
            </p>
          </div>
        </div>

        {/* View Tabs */}
        <Tabs defaultValue="data" className="w-full sm:w-auto">
          <TabsList className="grid w-full sm:w-[280px] grid-cols-2 h-8 p-0.5">
            <TabsTrigger value="data" className="text-xs flex items-center gap-1.5 py-1">
              <Database className="h-3.5 w-3.5" />
              Data Explorer
            </TabsTrigger>
            <TabsTrigger value="schema" className="text-xs flex items-center gap-1.5 py-1">
              <Network className="h-3.5 w-3.5" />
              Schema Map
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden p-2 sm:p-3">
        <Tabs defaultValue="data" className="h-full flex flex-col">
          <TabsContent value="data" className="flex-1 h-full m-0">
            <DataKnowledgeGraph />
          </TabsContent>
          <TabsContent value="schema" className="flex-1 h-full m-0">
            <KnowledgeGraph />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
