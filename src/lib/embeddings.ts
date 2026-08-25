import { pipeline } from '@xenova/transformers';

let embedder: any = null;
let modelReadyPromise: Promise<void> | null = null;

// Initialize the embedding model as a singleton
export async function initEmbedder() {
  if (embedder) return;
  if (modelReadyPromise) return modelReadyPromise;
  
  modelReadyPromise = new Promise(async (resolve, reject) => {
    try {
      // Use the all-MiniLM-L6-v2 model which produces 384-dimensional vectors
      embedder = await pipeline('feature-extraction', 'Supabase/bge-small-en', {
        quantized: true, // Use a smaller 8-bit quantized model to load faster
      });
      resolve();
    } catch (e) {
      console.error("Failed to load embedding model:", e);
      reject(e);
    }
  });

  return modelReadyPromise;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  await initEmbedder();
  if (!embedder) throw new Error("Embedder not initialized");

  // Generate the embedding
  const output = await embedder(text, {
    pooling: 'mean',
    normalize: true,
  });
  
  // Extract the vector data (converting from Float32Array to regular array)
  const vector = Array.from(output.data);
  return vector as number[];
}

export function chunkText(text: string, maxChunkLength: number = 500): string[] {
  // A simple chunking function that splits by paragraphs and tries to keep chunks under maxChunkLength
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const p of paragraphs) {
    if ((currentChunk.length + p.length) > maxChunkLength && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }
    
    // If a single paragraph is still larger than max chunk, we split it by sentences
    if (p.length > maxChunkLength) {
      const sentences = p.split(/(?<=[.?!])\s+/);
      for (const s of sentences) {
        if ((currentChunk.length + s.length) > maxChunkLength && currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = "";
        }
        currentChunk += s + " ";
      }
    } else {
      currentChunk += p + "\n\n";
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
