import fs from "fs";
import path from "path";
import { config } from "../config.js";

let cache = null;

export function knowledgeIndexPath() {
  return config.knowledgeIndexPath;
}

export function hasIndex() {
  return fs.existsSync(config.knowledgeIndexPath);
}

export function loadIndex() {
  if (cache) return cache;
  if (!hasIndex()) {
    cache = { generatedAt: null, chunks: [] };
    return cache;
  }
  const raw = fs.readFileSync(config.knowledgeIndexPath, "utf8");
  cache = JSON.parse(raw);
  return cache;
}

export function saveIndex(index) {
  const dir = path.dirname(config.knowledgeIndexPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(config.knowledgeIndexPath, JSON.stringify(index, null, 2), "utf8");
  cache = index;
}

export function invalidate() {
  cache = null;
}
