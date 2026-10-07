import fs from "fs";
import path from "path";
import { buildVocabulary, cosine, vectorize } from "../embeddings/embed.js";
import { embedTexts, embeddingsAvailable } from "../embeddings/geminiEmbeddings.js";
import { ingestKnowledge } from "../ingestion/ingest.js";
import { config } from "../../config.js";

const CACHE_FILE = path.resolve("./data/knowledge_embeddings.json");

let cache = {
  chunks: [],
  vocab: null,
  vectors: [],
  embeddings: [],
};

export async function loadKnowledgeIndex() {
  const chunks = await ingestKnowledge();
  const vocab = buildVocabulary(chunks);
  const vectors = chunks.map((chunk) => vectorize(chunk.text, vocab));

  let embeddings = [];
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const saved = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
      if (saved.chunksCount === chunks.length && saved.embeddings?.length === chunks.length) {
        embeddings = saved.embeddings;
      }
    }
  } catch {}

  if ((!embeddings || embeddings.length !== chunks.length) && embeddingsAvailable()) {
    try {
      console.log(`Generating dense Gemini vector embeddings for ${chunks.length} knowledge chunks...`);
      embeddings = await embedTexts(chunks.map((c) => `${c.source}\n${c.text}`));
      try {
        fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
        fs.writeFileSync(
          CACHE_FILE,
          JSON.stringify({ chunksCount: chunks.length, embeddings }),
          "utf8"
        );
      } catch {}
    } catch (e) {
      console.warn("Could not generate dense embeddings, using lexical TF-IDF:", e.message);
    }
  }

  cache = { chunks, vocab, vectors, embeddings };
  return { documents: new Set(chunks.map((c) => c.source)).size, chunks: chunks.length };
}

export async function retrieve(query, k = 4) {
  if (!cache.chunks.length) return [];

  // Check dense vector retrieval
  let queryEmbedding = null;
  if (embeddingsAvailable() && cache.embeddings && cache.embeddings.length) {
    try {
      const qVecs = await embedTexts([query]);
      if (qVecs && qVecs[0]) queryEmbedding = qVecs[0];
    } catch {}
  }

  // Lexical TF-IDF vector
  const qLex = vectorize(query, cache.vocab);

  const scored = cache.chunks.map((chunk, i) => {
    const lexScore = cosine(qLex, cache.vectors[i]) || 0;
    let denseScore = 0;
    if (queryEmbedding && cache.embeddings[i]) {
      denseScore = cosine(queryEmbedding, cache.embeddings[i]) || 0;
    }
    const finalScore = queryEmbedding ? denseScore * 0.75 + lexScore * 0.25 : lexScore;
    return {
      ...chunk,
      score: Number(finalScore.toFixed(4)),
      denseScore: Number(denseScore.toFixed(4)),
      lexScore: Number(lexScore.toFixed(4)),
    };
  });

  // Strict threshold to prevent hallucinated citations when user query is unrelated
  const threshold = queryEmbedding ? 0.35 : 0.08;
  const filtered = scored
    .filter((item) => item.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  return filtered;
}

export function knowledgeStatus() {
  return {
    ready: cache.chunks.length > 0,
    chunks: cache.chunks.length,
    denseVectorsReady: Boolean(cache.embeddings && cache.embeddings.length),
    sources: [...new Set(cache.chunks.map((c) => c.source))],
  };
}
