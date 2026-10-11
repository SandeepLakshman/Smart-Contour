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
  if (patient.clinicianId && req.user?.uid && patient.clinicianId !== req.user.uid) {
    return res.status(403).json({ success: false, error: "Access denied to patient" });
  }

  const settings = await getSettings();
  const targetDevice = deviceId || settings.defaultDeviceId || "SMARTCONTOUR-001";
  const clinicianId = req.user?.uid || null;

  // Concurrency-safe check: prevent duplicate active session for the same patient or same device
  const existingSessions = await listSessions({ patientId: patient.id });
  const alreadyActive = existingSessions.find((s) => s.status === "active");
  if (alreadyActive) {
    return res.status(409).json({
      success: false,
      isConflict: true,
      error: `Patient already has an active session (${alreadyActive.id.slice(0, 8)}) in progress. Please complete or activate the existing session.`,
      activeSessionId: alreadyActive.id,
    });
  }

  const session = {
    id: uuid(),
    patientId: patient.id,
    patientName: patient.name,
    clinicianId,
    clinician: req.user?.displayName || req.user?.email || "Attending Clinician",
    deviceId: targetDevice,
    startTime: new Date().toISOString(),
    endTime: null,
    durationMs: null,
    status: "active",
  };
  await addSession(session);
  return res.status(201).json({ success: true, session });
}

export async function getSessions(req, res) {
  const patientId = req.query?.patientId || undefined;
  const clinicianId = req.user?.uid || undefined;
  const sessions = await listSessions({ patientId, clinicianId });
  return res.json({ success: true, sessions });
}

export async function getSessionById(req, res) {
  const session = await getSession(req.params.id);
  if (!session) return res.status(404).json({ success: false, error: "Session not found" });
  if (session.clinicianId && req.user?.uid && session.clinicianId !== req.user.uid) {
    return res.status(403).json({ success: false, error: "Access denied to session" });
  }
  const settings = await getSettings();
  const readings = await listReadings({ sessionId: session.id, limit: 800 });
  const stats = summarizeReadings(readings, settings.thresholds);
  const end = session.endTime ? new Date(session.endTime) : new Date();
  const start = new Date(session.startTime);
  const durationMs = Math.max(0, end.getTime() - start.getTime());

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
  const existing = await getSession(req.params.id);
  if (!existing) return res.status(404).json({ success: false, error: "Session not found" });
  if (existing.clinicianId && req.user?.uid && existing.clinicianId !== req.user.uid) {
    return res.status(403).json({ success: false, error: "Access denied to session" });
  }
  if (existing.status === "completed") {
    return res.json({ success: true, session: existing, message: "Session was already completed" });
  }

  const endTimestamp = new Date().toISOString();
  const startTimestamp = new Date(existing.startTime);
  const durationMs = Math.max(0, new Date(endTimestamp).getTime() - startTimestamp.getTime());

  const session = await updateSession(req.params.id, {
    status: "completed",
    endTime: endTimestamp,
    durationMs,
  });

  return res.json({ success: true, session });
}
