import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FileText, Loader2, Database, Trash2, BrainCircuit } from "lucide-react";
import { generateEmbedding, chunkText, initEmbedder } from "@/lib/embeddings";

export function RAGManager() {
  const [loading, setLoading] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [text, setText] = useState("");
  const [docName, setDocName] = useState("");
  const [documents, setDocuments] = useState<any[]>([]);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    fetchDocuments();
    // Pre-load the embedding model in the background
    setModelLoading(true);
    initEmbedder().finally(() => setModelLoading(false));
  }, []);

  async function fetchDocuments() {
    try {
      // Just fetch metadata to list what's been embedded
      const { data, error } = await supabase
        .from("knowledge_base")
        .select("id, metadata, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        if (error.message.includes("does not exist")) {
          // Table doesn't exist yet, user hasn't run the SQL
          toast.error("Please run the SQL migration in Supabase to create the knowledge_base table!");
        }
        return;
      }
      
      // Group chunks by document name
      const docsMap = new Map();
      for (const row of data || []) {
        const name = row.metadata?.name || "Untitled";
        if (!docsMap.has(name)) docsMap.set(name, { name, chunks: 0, date: row.created_at });
        docsMap.get(name).chunks += 1;
      }
      
      setDocuments(Array.from(docsMap.values()));
    } catch (e) {
      console.error(e);
    }
  }

  async function handleEmbedAndSave() {
    if (!text.trim() || !docName.trim()) {
      toast.error("Please provide a document name and some text content.");
      return;
    }

    setLoading(true);
    try {
      setStatus("Chunking text...");
      const chunks = chunkText(text, 500);
      
      setStatus(`Generating embeddings for ${chunks.length} chunks...`);
      for (let i = 0; i < chunks.length; i++) {
        setStatus(`Embedding chunk ${i + 1} of ${chunks.length}...`);
        const chunk = chunks[i];
        const vector = await generateEmbedding(chunk);

        // Save to Supabase
        const { error } = await supabase.from("knowledge_base").insert({
          content: chunk,
          metadata: { name: docName, chunk_index: i, total_chunks: chunks.length },
          embedding: vector
        });

        if (error) throw error;
      }

      toast.success("Document embedded and saved successfully!");
      setText("");
      setDocName("");
      fetchDocuments();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to process document");
    } finally {
      setLoading(false);
      setStatus("");
    }
  }

  async function handleDelete(name: string) {
    if (!confirm(`Are you sure you want to delete all chunks for "${name}"?`)) return;
    
    setLoading(true);
    try {
      // We have to use a generic delete since metadata is JSONB
      // Supabase JS doesn't easily support deleting by jsonb arrow operator in all versions,
      // so we might need to fetch IDs first or use a raw SQL function. 
      // For simplicity in this demo, we'll fetch IDs matching the name and delete them.
      const { data } = await supabase.from("knowledge_base").select("id, metadata");
      const idsToDelete = (data || [])
        .filter((row) => row.metadata?.name === name)
        .map((row) => row.id);

      if (idsToDelete.length > 0) {
        await supabase.from("knowledge_base").delete().in("id", idsToDelete);
      }
      toast.success("Document deleted");
      fetchDocuments();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full gap-4 p-4">
      {/* Upload Section */}
      <div className="flex-1 flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-primary" />
            Add to Knowledge Base
          </h2>
          <p className="text-sm text-muted-foreground">
            Paste business policies, manuals, or documents here. They will be chunked, embedded locally, and stored in the database for the AI Chat to retrieve.
          </p>
        </div>

        <div className="space-y-4 bg-card border rounded-xl p-4 flex-1 flex flex-col">
          <div className="space-y-2">
            <Label>Document Name</Label>
            <Input 
              placeholder="e.g., Return Policy 2026" 
              value={docName} 
              onChange={(e) => setDocName(e.target.value)} 
            />
          </div>
          
          <div className="space-y-2 flex-1 flex flex-col">
            <Label>Document Content (Text)</Label>
            <Textarea 
              placeholder="Paste the full text here..." 
              className="flex-1 resize-none font-mono text-xs"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          <Button 
            className="w-full" 
            onClick={handleEmbedAndSave}
            disabled={loading || modelLoading}
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {status}</>
            ) : modelLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading AI Model (30MB)...</>
            ) : (
              <><Database className="h-4 w-4 mr-2" /> Chunk, Embed & Save</>
            )}
          </Button>
        </div>
      </div>

      {/* Embedded Documents List */}
      <div className="w-[300px] border-l pl-4 flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold">Indexed Documents</h3>
          <p className="text-xs text-muted-foreground">These can be searched by the AI.</p>
        </div>

        <div className="space-y-2 overflow-y-auto">
          {documents.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-8 bg-muted/30 rounded-lg border border-dashed">
              No documents indexed yet.
            </div>
          ) : (
            documents.map((doc, idx) => (
              <div key={idx} className="bg-card border rounded-lg p-3 text-sm flex items-start justify-between group">
                <div>
                  <div className="font-medium flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-blue-500" />
                    <span className="line-clamp-1" title={doc.name}>{doc.name}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {doc.chunks} chunks • {new Date(doc.date).toLocaleDateString()}
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
                  onClick={() => handleDelete(doc.name)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
