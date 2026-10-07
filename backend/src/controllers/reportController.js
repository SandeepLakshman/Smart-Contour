import { analyzeSensors, summarizeReadings } from "../analysis/pressureAnalysis.js";
import { generateGeminiResponse, geminiStatus } from "../ai/gemini.js";
import { buildRagContext } from "../rag/contextBuilder.js";
import { retrieve } from "../rag/retrieval/retrieve.js";
import { buildReportPayload, renderPdfBuffer } from "../services/reportService.js";
import {
  addReport,
  getPatient,
  getReport,
  getSession,
  getSettings,
  latestReading,
  listReadings,
  listRecommendations,
  listReports,
} from "../services/store.js";

export async function generateReport(req, res) {
  try {
    const { sessionId, includeAi = true } = req.body || {};
    if (!sessionId) return res.status(400).json({ success: false, error: "sessionId is required" });
    const session = await getSession(sessionId);
    if (!session) return res.status(404).json({ success: false, error: "Session not found" });
    const patient = await getPatient(session.patientId);
    const settings = await getSettings();
    const readings = await listReadings({ sessionId, limit: 800 });
    const latest = readings.at(-1) || (await latestReading());
    const analyzed = latest ? analyzeSensors(latest.sensors, settings.thresholds) : { analysis: {}, highestPressureZone: null };
    const stats = summarizeReadings(readings, settings.thresholds);
    const recommendations = await listRecommendations({ sessionId });

    let gemini = null;
    let sources = [];
    if (includeAi && geminiStatus().configured) {
      const question = "Explain this session's pressure pattern and why cushioning may have been recommended.";
      const retrieved = await retrieve(question, 4);
      const context = buildRagContext({
        question,
        retrieved,
        session,
        analysis: analyzed,
        recommendations,
      });
      gemini = await generateGeminiResponse({ system: context.system, user: context.user });
      sources = retrieved.length ? context.sources : [];
    }

    const report = buildReportPayload({
      patient,
      session,
      analysis: analyzed,
      stats,
      recommendations,
      gemini,
      sources,
    });
    await addReport(report);
    return res.status(201).json({ success: true, report });
  } catch (err) {
    console.error("Report gen error:", err);
    return res.status(500).json({ success: false, error: "Failed to generate report", details: err?.message });
  }
}

export async function getReports(_req, res) {
  const reports = await listReports();
  return res.json({ success: true, reports });
}

export async function previewReport(req, res) {
  const report = await getReport(req.params.id);
  if (!report) return res.status(404).json({ success: false, error: "Report not found" });
  return res.json({ success: true, report });
}

export async function downloadReport(req, res) {
  const report = await getReport(req.params.id);
  if (!report) return res.status(404).json({ success: false, error: "Report not found" });
  const pdf = await renderPdfBuffer(report);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="SmartContour-${report.id}.pdf"`);
  return res.send(pdf);
}
