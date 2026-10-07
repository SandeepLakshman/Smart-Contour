import { loadIndex } from "../knowledgeStore.js";
import { embedTexts, embeddingsAvailable } from "../embeddings/geminiEmbeddings.js";

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function lexicalScore(query, content) {
  const q = new Set(tokenize(query));
  const words = tokenize(content);
  if (!words.length) return 0;
  let hits = 0;
  for (const w of words) if (q.has(w)) hits += 1;
  return hits / Math.sqrt(words.length);
}

function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function retrieve(question, k = 5) {
  const index = loadIndex();
  const chunks = index.chunks || [];
  if (!chunks.length) {
    return { matches: [], note: "No knowledge source is available in the index." };
  }

  let queryEmbedding = null;
  const hasVectors = chunks.some((c) => Array.isArray(c.embedding) && c.embedding.length);
  if (hasVectors && embeddingsAvailable()) {
    try {
      queryEmbedding = (await embedTexts([question]))[0];
    } catch {
      queryEmbedding = null;
    }
  }

  const scored = chunks.map((c) => {
    const lex = lexicalScore(question, `${c.title} ${c.content}`);
    const sem = queryEmbedding ? cosine(queryEmbedding, c.embedding) : 0;
    return {
      id: c.id,
      title: c.title,
      source: c.source,
      content: c.content,
      score: queryEmbedding ? sem * 0.78 + lex * 0.22 : lex,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const matches = scored.filter((m) => m.score > 0).slice(0, k);
  if (!matches.length) {
    return { matches: [], note: "Evidence was not found in the knowledge base." };
  }
  return { matches, note: null };
}
