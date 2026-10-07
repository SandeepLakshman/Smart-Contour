import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function requiredMissing(keys) {
  return keys.filter((key) => !process.env[key] || String(process.env[key]).trim() === "");
}

export const config = {
  port: Number(process.env.PORT || 4000),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  defaultDeviceId: process.env.DEFAULT_DEVICE_ID || "SMARTCONTOUR-001",
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  },
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  knowledgeDir: path.resolve(__dirname, "../../knowledge/documents"),
};

export function credentialStatus() {
  return {
    firebase: requiredMissing(["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"]).length === 0,
    gemini: Boolean(config.geminiApiKey),
    missingFirebase: requiredMissing(["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"]),
    missingGemini: config.geminiApiKey ? [] : ["GEMINI_API_KEY"],
  };
}
