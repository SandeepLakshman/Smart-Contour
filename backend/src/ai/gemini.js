import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config.js";

const MODEL_NAME = "gemini-3.8-flash";

export function geminiStatus() {
  return {
    configured: Boolean(config.geminiApiKey),
    model: MODEL_NAME,
  };
}

export async function generateGeminiResponse({ system, user }) {
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
  const result = await model.generateContent(user);
  return result.response.text();
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
