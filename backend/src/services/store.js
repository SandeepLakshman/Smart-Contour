import { getDb, firebaseStatus } from "../firebase/admin.js";
import { DEFAULT_THRESHOLDS } from "../analysis/pressureAnalysis.js";

const defaultPatient = {
  id: "patient-sandeep-01",
  name: "Sandeep Lakshman",
  age: 38,
  notes: "Prototype socket contour assessment · Transtibial fitting support",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const defaultSession = {
  id: "session-smartcontour-01",
  patientId: "patient-sandeep-01",
  patientName: "Sandeep Lakshman",
  clinician: "Dr. Priya Sharma · Demo Clinician",
  deviceId: "SMARTCONTOUR-001",
  startTime: new Date(Date.now() - 3600000).toISOString(),
  endTime: null,
  status: "active",
};

const memory = {
  patients: new Map([[defaultPatient.id, defaultPatient]]),
  sessions: new Map([[defaultSession.id, defaultSession]]),
  readings: [],
  recommendations: [],
  reports: [],
  settings: {
    thresholds: { ...DEFAULT_THRESHOLDS },
    defaultDeviceId: "SMARTCONTOUR-001",
  },
};

function hasDb() {
  return firebaseStatus().available && Boolean(getDb());
}

export async function getSettings() {
  if (hasDb()) {
    try {
      const snap = await Promise.race([
        getDb().collection("settings").doc("system").get(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 2500)),
      ]);
      if (snap.exists) return { ...memory.settings, ...snap.data() };
    } catch (e) {
      // Fall through to memory
    }
  }
  return memory.settings;
}

export async function saveSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  memory.settings = next;
  if (hasDb()) {
    try {
      await Promise.race([
        getDb().collection("settings").doc("system").set(next, { merge: true }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 2500)),
      ]);
    } catch (e) {
      // Keep in memory
    }
  }
  return next;
}

export async function addPatient(patient) {
  memory.patients.set(patient.id, patient);
  if (hasDb()) {
    try {
      await Promise.race([
        getDb().collection("patients").doc(patient.id).set(patient),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 2500)),
      ]);
    } catch (e) {}
  }
  return patient;
}

export async function listPatients() {
  if (hasDb()) {
    try {
      const snap = await Promise.race([
        getDb().collection("patients").orderBy("createdAt", "desc").get(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 2500)),
      ]);
      if (snap && snap.docs) {
        return snap.docs.map((d) => d.data());
      }
    } catch (e) {}
  }
  return [...memory.patients.values()].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export async function getPatient(id) {
  if (hasDb()) {
    try {
      const snap = await Promise.race([
        getDb().collection("patients").doc(id).get(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 2500)),
      ]);
      if (snap.exists) return snap.data();
    } catch (e) {}
  }
  return memory.patients.get(id) || null;
}

export async function updatePatient(id, patch) {
  const current = await getPatient(id);
  if (!current) return null;
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  memory.patients.set(id, next);
  if (hasDb()) {
    try {
      await Promise.race([
        getDb().collection("patients").doc(id).set(next, { merge: true }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 2500)),
      ]);
    } catch (e) {}
  }
  return next;
}

export async function addSession(session) {
  memory.sessions.set(session.id, session);
  if (hasDb()) {
    try {
      await Promise.race([
        getDb().collection("sessions").doc(session.id).set(session),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 2500)),
      ]);
    } catch (e) {}
  }
  return session;
}

export async function listSessions() {
  if (hasDb()) {
    try {
      const snap = await Promise.race([
        getDb().collection("sessions").get(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 2500)),
      ]);
      if (snap && snap.docs) {
        return snap.docs
          .map((d) => d.data())
          .sort((a, b) => String(b.startTime || "").localeCompare(String(a.startTime || "")));
      }
    } catch (e) {}
  }
  return [...memory.sessions.values()].sort((a, b) => String(b.startTime || "").localeCompare(String(a.startTime || "")));
}

export async function getSession(id) {
  if (hasDb()) {
    try {
      const snap = await Promise.race([
        getDb().collection("sessions").doc(id).get(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 2500)),
      ]);
      if (snap.exists) return snap.data();
    } catch (e) {}
  }
  return memory.sessions.get(id) || null;
}

export async function updateSession(id, patch) {
  const current = await getSession(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  memory.sessions.set(id, next);
  if (hasDb()) {
    try {
      await Promise.race([
        getDb().collection("sessions").doc(id).set(next, { merge: true }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 2500)),
      ]);
    } catch (e) {}
  }
  return next;
}

export async function getActiveSessionForDevice(deviceId) {
  const sessions = await listSessions();
  return sessions.find((s) => s.deviceId === deviceId && s.status === "active") || null;
}

export async function addReading(reading) {
  memory.readings.push(reading);
  if (memory.readings.length > 5000) memory.readings.splice(0, memory.readings.length - 4000);
  if (hasDb()) {
    try {
      await Promise.race([
        getDb().collection("sensorReadings").add(reading),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 2500)),
      ]);
    } catch (e) {}
  }
  return reading;
}

export async function latestReading() {
  if (hasDb()) {
    try {
      const snap = await Promise.race([
        getDb().collection("sensorReadings").orderBy("serverTimestamp", "desc").limit(1).get(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 2500)),
      ]);
      if (snap && !snap.empty) return snap.docs[0].data();
    } catch (e) {}
  }
  return memory.readings.at(-1) || null;
}

export async function listReadings({ sessionId, limit = 400 } = {}) {
  if (hasDb()) {
    try {
      let query = getDb().collection("sensorReadings").orderBy("serverTimestamp", "desc").limit(limit);
      if (sessionId) query = getDb().collection("sensorReadings").where("sessionId", "==", sessionId).limit(limit);
      const snap = await Promise.race([
        query.get(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 2500)),
      ]);
      if (snap && snap.docs) return snap.docs.map((d) => d.data()).reverse();
    } catch (e) {}
  }
  const filtered = sessionId ? memory.readings.filter((r) => r.sessionId === sessionId) : memory.readings;
  return filtered.slice(-limit);
}

export async function addRecommendations(items) {
  for (const item of items) {
    memory.recommendations.unshift(item);
    if (hasDb()) {
      try {
        await Promise.race([
          getDb().collection("recommendations").add(item),
          new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 2500)),
        ]);
      } catch (e) {}
    }
  }
  return items;
}

export async function listRecommendations({ sessionId } = {}) {
  if (hasDb()) {
    try {
      let query = getDb().collection("recommendations").orderBy("createdAt", "desc").limit(80);
      if (sessionId) query = getDb().collection("recommendations").where("sessionId", "==", sessionId);
      const snap = await Promise.race([
        query.get(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 2500)),
      ]);
      if (snap && snap.docs) return snap.docs.map((d) => d.data());
    } catch (e) {}
  }
  return sessionId
    ? memory.recommendations.filter((r) => r.sessionId === sessionId)
    : memory.recommendations.slice(0, 80);
}

export async function addReport(report) {
  memory.reports.unshift(report);
  if (hasDb()) {
    try {
      await Promise.race([
        getDb().collection("reports").doc(report.id).set(report),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 2500)),
      ]);
    } catch (e) {}
  }
  return report;
}

export async function listReports() {
  if (hasDb()) {
    try {
      const snap = await Promise.race([
        getDb().collection("reports").orderBy("generatedAt", "desc").get(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 2500)),
      ]);
      if (snap && snap.docs) return snap.docs.map((d) => d.data());
    } catch (e) {}
  }
  return memory.reports;
}

export async function getReport(id) {
  if (hasDb()) {
    try {
      const snap = await Promise.race([
        getDb().collection("reports").doc(id).get(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 2500)),
      ]);
      if (snap.exists) return snap.data();
    } catch (e) {}
  }
  return memory.reports.find((r) => r.id === id) || null;
}

export function persistenceMode() {
  return hasDb() ? "firestore" : "ephemeral";
}
