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

// Concurrency mutex queue keyed by patientId to prevent race conditions during session creation/activation/ending
const patientLocks = new Map();

async function withPatientLock(patientId, fn) {
  const key = String(patientId || "global");
  const prevPromise = patientLocks.get(key) || Promise.resolve();
  let release;
  const currentPromise = new Promise((resolve) => {
    release = resolve;
  });
  patientLocks.set(key, prevPromise.then(() => currentPromise));
  try {
    await prevPromise;
    return await fn();
  } finally {
    release();
    if (patientLocks.get(key) === currentPromise) {
      patientLocks.delete(key);
    }
  }
}

export async function createSession(req, res) {
  const { patientId, deviceId } = req.body || {};
  if (!patientId) return res.status(400).json({ success: false, error: "patientId is required" });
  const patient = await getPatient(patientId);
  if (!patient) return res.status(404).json({ success: false, error: "Patient not found" });
  if (patient.clinicianId && req.user?.uid && patient.clinicianId !== req.user.uid) {
    return res.status(403).json({ success: false, error: "Access denied to patient" });
  }

  return await withPatientLock(patient.id, async () => {
    const settings = await getSettings();
    const targetDevice = deviceId || settings.defaultDeviceId || "SMARTCONTOUR-001";
    const clinicianId = req.user?.uid || null;

    // Concurrency-safe check: prevent duplicate active session for the same patient
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
  });
}

export async function getSessions(req, res) {
  const patientId = req.query?.patientId || undefined;
  const clinicianId = req.user?.uid || undefined;
  const rawSessions = await listSessions({ patientId, clinicianId });

  // Ensure consistent presentation: only one session per patient can be presented as active.
  // The most recent active session remains 'active'; any prior concurrently active session is presented as completed.
  const activePatients = new Set();
  const sessions = rawSessions.map((s) => {
    if (s.status === "active") {
      const pKey = s.patientId || s.patientName || "unknown";
      if (activePatients.has(pKey)) {
        return {
          ...s,
          status: "completed",
          endTime: s.endTime || s.startTime,
        };
      }
      activePatients.add(pKey);
    }
    return s;
  });

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

  return await withPatientLock(existing.patientId, async () => {
    // Re-fetch under lock to guarantee fresh status
    const current = (await getSession(req.params.id)) || existing;
    if (current.status === "completed") {
      return res.json({ success: true, session: current, message: "Session was already completed" });
    }

    const endTimestamp = new Date().toISOString();
    const startTimestamp = new Date(current.startTime);
    const durationMs = Math.max(0, new Date(endTimestamp).getTime() - startTimestamp.getTime());

    const session = await updateSession(req.params.id, {
      status: "completed",
      endTime: endTimestamp,
      durationMs,
    });

    return res.json({ success: true, session });
  });
}

export async function activateSession(req, res) {
  const target = await getSession(req.params.id);
  if (!target) return res.status(404).json({ success: false, error: "Session not found" });
  if (target.clinicianId && req.user?.uid && target.clinicianId !== req.user.uid) {
    return res.status(403).json({ success: false, error: "Access denied to session" });
  }

  return await withPatientLock(target.patientId, async () => {
    // 1. Atomically complete any other active sessions for this patient in persistent storage
    const patientSessions = await listSessions({ patientId: target.patientId });
    const now = new Date().toISOString();
    for (const s of patientSessions) {
      if (s.id !== target.id && s.status === "active") {
        const start = new Date(s.startTime);
        const durationMs = Math.max(0, new Date(now).getTime() - start.getTime());
        await updateSession(s.id, {
          status: "completed",
          endTime: s.endTime || now,
          durationMs: s.durationMs || durationMs,
        });
      }
    }

    // 2. Mark target session active and clear endTime
    const updated = await updateSession(target.id, {
      status: "active",
      endTime: null,
    });

    return res.json({ success: true, session: updated });
  });
}
