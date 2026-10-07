import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../../config.js";

const MODEL = "gemini-embedding-001";

export function embeddingsAvailable() {
  return Boolean(config.geminiApiKey);
}

export async function embedTexts(texts) {
  if (!config.geminiApiKey) {
    const err = new Error("GEMINI_API_KEY is not configured.");
    err.code = "GEMINI_UNAVAILABLE";
    throw err;
  }
  const genAI = new GoogleGenerativeAI(config.geminiApiKey);
  const model = genAI.getGenerativeModel({ model: MODEL });
  const vectors = [];
  for (const text of texts) {
    try {
      const result = await model.embedContent(text.slice(0, 8000));
      vectors.push(result.embedding.values);
    } catch (e) {
      console.warn("Embedding error for chunk:", e.message);
      vectors.push(null);
    }
  }
  return vectors;
}
