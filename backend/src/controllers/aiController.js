import { analyzeSensors, summarizeReadings } from "../analysis/pressureAnalysis.js";
import { generateGeminiResponse, geminiStatus, parseAssistantSections } from "../ai/gemini.js";
import { buildRagContext } from "../rag/contextBuilder.js";
import { retrieve } from "../rag/retrieval/retrieve.js";
import {
  getSession,
  getSettings,
  latestReading,
  listReadings,
  listRecommendations,
} from "../services/store.js";

export async function chat(req, res) {
  try {
    const { sessionId, question } = req.body || {};
    if (!question || String(question).trim() === "") {
      return res.status(400).json({ success: false, error: "question is required" });
    }
    if (!geminiStatus().configured) {
      return res.status(503).json({
        success: false,
        error: "GEMINI_API_KEY is missing. Add it to backend/.env and restart the server.",
      });
    }

    const trimmedQuestion = String(question).trim();
    const session = sessionId ? await getSession(sessionId) : null;
    const settings = await getSettings();
    const latest = await latestReading();
    const readings = session ? await listReadings({ sessionId: session.id, limit: 200 }) : latest ? [latest] : [];
    const analyzed = latest ? analyzeSensors(latest.sensors, settings.thresholds) : null;
    const stats = summarizeReadings(readings, settings.thresholds);
    const recommendations = await listRecommendations({ sessionId: session?.id });

    // Step 1: Real document chunk retrieval with semantic vector search
    const retrieved = await retrieve(trimmedQuestion, 4);

    // If query has no relevance in knowledge base
    if (!retrieved || retrieved.length === 0) {
      return res.json({
        success: true,
        answer: "I could not find sufficient information in the provided knowledge base.",
        reasoning: "The question did not match relevant passages in the stored prosthetic socket fitting knowledge base.",
        evidence: "No relevant documents found above relevance threshold.",
        sensorContext: analyzed?.highestPressureZone
          ? `Highest pressure zone: ${analyzed.highestPressureZone.zone} (${analyzed.highestPressureZone.value})`
          : "No active sensor hotspot.",
        recommendation: "Please refer to clinical prosthetic documentation or formulate a question regarding socket pressure mapping and cushioning.",
        sources: [],
        evidenceFound: false,
        stats,
        analysis: analyzed,
      });
    }

    // Step 2: Build strict context with retrieved chunks ONLY
    const context = buildRagContext({
      question: trimmedQuestion,
      retrieved,
      session,
      analysis: analyzed,
      recommendations,
    });

    // Step 3: Send retrieved context to Gemini
    const raw = await generateGeminiResponse({ system: context.system, user: context.user });
    const sections = parseAssistantSections(raw);

    return res.json({
      success: true,
      answer: sections.Answer,
      reasoning: sections.Reasoning,
      evidence: sections["Relevant evidence"],
      sensorContext: sections["Current sensor context"],
      recommendation: sections.Recommendation,
      sources: context.sources,
      evidenceFound: true,
      stats,
      analysis: analyzed,
    });
  } catch (error) {
    console.error("AI Assistant error:", error);
    if (error.code === "MISSING_GEMINI") {
      return res.status(503).json({ success: false, error: "GEMINI_API_KEY is missing" });
    }
    return res.status(500).json({ success: false, error: "AI assistant error: " + (error.message || "Unknown") });
  }
}
