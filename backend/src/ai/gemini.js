import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config.js";

const MODEL_NAME = "gemini-3.8-flash";

export function geminiStatus() {
  return {
    configured: Boolean(config.geminiApiKey),
    model: MODEL_NAME,
  };
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

export async function generateGeminiResponse({ system, user }, maxRetries = 3) {
  if (!config.geminiApiKey) {
    const error = new Error("GEMINI_API_KEY is missing");
    error.code = "MISSING_GEMINI";
    throw error;
  }

  const client = new GoogleGenerativeAI(config.geminiApiKey);
  const model = client.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: system,
  });

  let lastError;
  let delayMs = 1000;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const result = await model.generateContent(user);
      return result.response.text();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries && isRetryableError(err)) {
        console.warn(
          `[Gemini] Transient error (${err.message}). Retrying ${attempt + 1}/${maxRetries} after ${delayMs}ms...`
        );
        await sleep(delayMs);
        delayMs *= 2;
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

export function parseAssistantSections(text) {
  const keys = ["Answer", "Reasoning", "Relevant evidence", "Current sensor context", "Recommendation"];
  const out = {};
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const next = keys[i + 1];
    const start = text.search(new RegExp(`${key}\\s*:?`, "i"));
    if (start === -1) {
      out[key] = "";
      continue;
    }
    const after = text.slice(start).replace(new RegExp(`^${key}\\s*:?\\s*`, "i"), "");
    const end = next ? after.search(new RegExp(`${next}\\s*:?`, "i")) : -1;
    out[key] = (end === -1 ? after : after.slice(0, end)).trim();
  }
  if (!out.Answer) out.Answer = text.trim();
  return out;
}
