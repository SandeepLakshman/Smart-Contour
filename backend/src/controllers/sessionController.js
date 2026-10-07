import { v4 as uuid } from "uuid";
import { summarizeReadings } from "../analysis/pressureAnalysis.js";
import {
  addSession,
  getPatient,
  getSession,
  getSettings,
  listReadings,
  listSessions,
  updateSession,
} from "../services/store.js";

export async function createSession(req, res) {
  const { patientId, deviceId } = req.body || {};
  if (!patientId) return res.status(400).json({ success: false, error: "patientId is required" });
  const patient = await getPatient(patientId);
  if (!patient) return res.status(404).json({ success: false, error: "Patient not found" });
  const settings = await getSettings();
  const session = {
    id: uuid(),
    patientId: patient.id,
    patientName: patient.name,
    deviceId: deviceId || settings.defaultDeviceId || "SMARTCONTOUR-001",
    startTime: new Date().toISOString(),
    endTime: null,
    status: "active",
  };
  await addSession(session);
  return res.status(201).json({ success: true, session });
}

export async function getSessions(_req, res) {
  const sessions = await listSessions();
  return res.json({ success: true, sessions });
}

export async function getSessionById(req, res) {
  const session = await getSession(req.params.id);
  if (!session) return res.status(404).json({ success: false, error: "Session not found" });
  const settings = await getSettings();
  const readings = await listReadings({ sessionId: session.id, limit: 800 });
  const stats = summarizeReadings(readings, settings.thresholds);
  const durationMs = (session.endTime ? new Date(session.endTime) : new Date()) - new Date(session.startTime);
  return res.json({
    success: true,
    session: {
      ...session,
      durationMs,
      totalReadings: stats.totalReadings,
      peakPressure: stats.peakPressure,
      averagePressure: stats.averagePressure,
      highestPressureZone: stats.highestPressureZone,
    },
    stats,
  });
}

export async function endSession(req, res) {
  const session = await updateSession(req.params.id, {
    status: "completed",
    endTime: new Date().toISOString(),
  });
  if (!session) return res.status(404).json({ success: false, error: "Session not found" });
  return res.json({ success: true, session });
}
