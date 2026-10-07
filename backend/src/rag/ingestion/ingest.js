import fs from "fs/promises";
import path from "path";
import { config } from "../../config.js";

export function chunkText(text, source, size = 700, overlap = 90) {
  const clean = text.replace(/\r\n/g, "\n").trim();
  const chunks = [];
  let start = 0;
  let index = 0;
  while (start < clean.length) {
    const end = Math.min(clean.length, start + size);
    const slice = clean.slice(start, end).trim();
    if (slice) {
      chunks.push({
        id: `${source}#${index}`,
        source,
        text: slice,
      });
      index += 1;
    }
    if (end >= clean.length) break;
    start = end - overlap;
  }
  return chunks;
}

export async function ingestKnowledge() {
  let files = [];
  try {
    files = (await fs.readdir(config.knowledgeDir)).filter((f) => f.endsWith(".md") || f.endsWith(".txt"));
  } catch {
    return [];
  }

  const chunks = [];
  for (const file of files) {
    const full = path.join(config.knowledgeDir, file);
    const text = await fs.readFile(full, "utf8");
    chunks.push(...chunkText(text, file));
  }
  return chunks;
}
