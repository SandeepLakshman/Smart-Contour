import { retrieve } from "../rag/retrieval/retriever.js";
import { buildContext } from "../rag/contextBuilder.js";
import { generateJson } from "./gemini.js";
import { getLatest } from "../services/deviceState.js";
import * as store from "../services/firestoreService.js";
import { getFirebaseStatus } from "../firebase/admin.js";

async function sessionContext(sessionId) {
  const live = getLatest();
  let recs = [];
  if (sessionId && getFirebaseStatus().configured) {
    try {
      recs = await store.listRecommendations(sessionId);
    } catch {
      recs = [];
    }
  }
  return {
    sessionId: sessionId || live?.sessionId || null,
    deviceId: live?.deviceId || null,
    sensors: live?.sensors || null,
    analysis: live?.analysis || null,
    highestPressureZone: live?.highestPressureZone || null,
    hotspots: live?.hotspots || [],
    recommendations: recs.slice(0, 5).map((r) => ({
      zone: r.zone,
      text: r.text,
      current: r.current,
    })),
    disclaimer: "Prototype fitting-support context. Not a medical diagnosis.",
  };
}

export async function chat({ sessionId, question }) {
  if (!question || !String(question).trim()) {
    const err = new Error("question is required");
    err.code = "BAD_REQUEST";
    throw err;
  }
  const context = await sessionContext(sessionId);
  const retrieval = await retrieve(question, 5);
  const packed = buildContext({
    question,
    matches: retrieval.matches,
    sessionContext: context,
  });
  const raw = await generateJson(packed.system);
  const evidence =
    retrieval.matches.length > 0
      ? retrieval.matches.map((m) => ({
          title: m.title,
          source: m.source,
          note: "Retrieved from the SmartContour knowledge base.",
        }))
      : [{ title: "No evidence", source: null, note: retrieval.note || "Evidence was not found in the knowledge base." }];

  return {
    answer: raw.answer || "",
    reasoning: raw.reasoning || "",
    evidence,
    sensorContext: raw.sensorContext || packed.sensorBlock,
    recommendation: raw.recommendation || "",
    retrieved: retrieval.matches.map((m) => ({ title: m.title, source: m.source, score: m.score })),
    knowledgeNote: retrieval.note,
  };
}
