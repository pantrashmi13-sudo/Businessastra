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

      <div className="flex-1 p-3 flex flex-col h-full overflow-hidden">
        <Tabs defaultValue="data" className="h-full flex flex-col">
          <TabsList className="w-[400px] grid w-full grid-cols-2 mb-2">
            <TabsTrigger value="data" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Data Explorer
            </TabsTrigger>
            <TabsTrigger value="schema" className="flex items-center gap-2">
              <Network className="h-4 w-4" />
              Schema Map
            </TabsTrigger>
          </TabsList>
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
