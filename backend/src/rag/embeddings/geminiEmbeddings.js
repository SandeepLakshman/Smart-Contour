import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../../config.js";

const MODEL = "gemini-embedding-001";

export function embeddingsAvailable() {
  return Boolean(config.geminiApiKey);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryableError(error) {
  if (!error) return false;
  const status = error.status || error.statusCode || error.response?.status;
  if (status === 503 || status === 429) return true;
  const msg = String(error.message || "");
  return (
    msg.includes("503") ||
    msg.includes("429") ||
    /overloaded/i.test(msg) ||
    /resource has been exhausted/i.test(msg) ||
    /service unavailable/i.test(msg) ||
    /high demand/i.test(msg) ||
    /rate limit/i.test(msg)
  );
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
    let vector = null;
    let delayMs = 800;
    for (let attempt = 0; attempt <= 3; attempt += 1) {
      try {
        const result = await model.embedContent(text.slice(0, 8000));
        vector = result.embedding.values;
        break;
      } catch (e) {
        if (attempt < 3 && isRetryableError(e)) {
          console.warn(`[Gemini Embeddings] Transient error (${e.message}). Retrying in ${delayMs}ms...`);
          await sleep(delayMs);
          delayMs *= 2;
          continue;
        }
        console.warn("Embedding error for chunk:", e.message);
        break;
      }
    }
    vectors.push(vector);
  }
  return vectors;
}
