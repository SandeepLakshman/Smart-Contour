function tokenize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

export function buildVocabulary(chunks) {
  const vocab = new Map();
  for (const chunk of chunks) {
    const unique = new Set(tokenize(chunk.text));
    for (const token of unique) vocab.set(token, (vocab.get(token) || 0) + 1);
  }
  return { vocab, n: chunks.length };
}

export function vectorize(text, { vocab, n }) {
  const counts = new Map();
  for (const token of tokenize(text)) counts.set(token, (counts.get(token) || 0) + 1);
  const vector = [];
  for (const [token, df] of vocab.entries()) {
    const tf = counts.get(token) || 0;
    const idf = Math.log((n + 1) / (df + 1)) + 1;
    vector.push(tf * idf);
  }
  return vector;
}

export function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
