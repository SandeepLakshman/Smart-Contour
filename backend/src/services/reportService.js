import PDFDocument from "pdfkit";
import { v4 as uuid } from "uuid";

export function buildReportPayload({ patient, session, analysis, stats, recommendations, gemini, sources }) {
  return {
    id: uuid(),
    title: "SmartContour Fitting Session Report",
    generatedAt: new Date().toISOString(),
    disclaimer:
      "Prototype fitting-support report. Pressure thresholds are configurable project values, not clinical diagnostic limits.",
    patient: patient
      ? { id: patient.id, name: patient.name, age: patient.age, notes: patient.notes || "" }
      : null,
    session: session
      ? {
          id: session.id,
          deviceId: session.deviceId,
          startTime: session.startTime,
          endTime: session.endTime || null,
          status: session.status,
        }
      : null,
    pressureSummary: {
      highest: analysis?.highestPressureZone || null,
      peak: stats?.peakPressure ?? null,
      average: stats?.averagePressure ?? null,
      highEvents: stats?.highPressureEvents ?? 0,
      totalReadings: stats?.totalReadings ?? 0,
    },
    sensors: analysis?.analysis || {},
    stats: stats?.perSensor || {},
    recommendations: recommendations || [],
    geminiExplanation: gemini || null,
    sources: sources || [],
  };
}

export function renderPdfBuffer(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fillColor("#3A2921").fontSize(22).text("SMARTCONTOUR");
    doc.fontSize(11).fillColor("#A65D45").text("Intelligent Pressure Analysis & Soft Insert Contouring");
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#B42318").text("SMARTCONTOUR PROTOTYPE / ENGINEERING DEMONSTRATION");
    doc.fontSize(8).fillColor("#6B5348").text("Prototype research evaluation. Not an official clinical medical report or diagnostic record.");
    doc.moveDown(0.4);
    doc.fillColor("#241914").fontSize(10).text(report.title);
    doc.text(`Generated: ${report.generatedAt}`);
    doc.moveDown();

    section(doc, "Patient & Clinician information");
    kv(doc, "Patient ID", report.patient?.id || "patient-sandeep-01");
    kv(doc, "Name", report.patient?.name || "Sandeep Lakshman");
    kv(doc, "Age", report.patient?.age ?? 38);
    kv(doc, "Clinician", "Dr. Priya Sharma · Demo Clinician");
    kv(doc, "Notes", report.patient?.notes || "Prototype socket contour assessment");

    section(doc, "Session & device");
    kv(doc, "Session ID", report.session?.id || "—");
    kv(doc, "Device", report.session?.deviceId || "—");
    kv(doc, "Start", report.session?.startTime || "—");
    kv(doc, "End", report.session?.endTime || "In progress");
    kv(doc, "Status", report.session?.status || "—");

    section(doc, "Pressure summary");
    kv(doc, "Highest pressure zone", report.pressureSummary.highest?.zone || "—");
    kv(doc, "Peak pressure", report.pressureSummary.peak ?? "—");
    kv(doc, "Average pressure", report.pressureSummary.average ?? "—");
    kv(doc, "High-pressure events", report.pressureSummary.highEvents);
    kv(doc, "Total readings", report.pressureSummary.totalReadings);

    section(doc, "Sensor readings");
    for (const [key, sensor] of Object.entries(report.sensors)) {
      kv(doc, `${sensor.label || key} / ${sensor.zone}`, `${sensor.value ?? "n/a"}  ${sensor.severity}`);
    }

    section(doc, "Cushioning recommendations");
    if (!report.recommendations.length) doc.fontSize(10).text("None recorded for this session.");
    for (const rec of report.recommendations) {
      doc.fontSize(10).fillColor("#3A2921").text(`${rec.zone}: ${rec.message}`);
      doc.fontSize(8).fillColor("#6B5348").text(rec.disclaimer);
      doc.moveDown(0.3);
    }

    section(doc, "SmartContour AI explanation");
    if (report.geminiExplanation) {
      doc.fontSize(10).fillColor("#241914").text(report.geminiExplanation, { align: "left" });
    } else {
      doc.fontSize(10).text("No AI explanation was generated for this report.");
    }

    section(doc, "Sources used by RAG");
    if (!report.sources.length) {
      doc.fontSize(10).text("Evidence was not found in the knowledge base, or no retrieval was performed.");
    } else {
      for (const src of report.sources) {
        doc.fontSize(10).text(`• ${src.source} (score ${src.score})`);
      }
    }

    doc.end();
  });
}

function section(doc, title) {
  doc.moveDown(0.8);
  doc.fillColor("#A65D45").fontSize(13).text(title);
  doc.moveDown(0.2);
  doc.fillColor("#241914");
}

function kv(doc, k, v) {
  doc.fontSize(10).fillColor("#6B5348").text(`${k}: `, { continued: true }).fillColor("#241914").text(String(v));
}
