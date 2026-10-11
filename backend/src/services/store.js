import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getDb, firebaseStatus, isFirestoreVerified } from "../firebase/admin.js";
import { DEFAULT_THRESHOLDS } from "../analysis/pressureAnalysis.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const STORE_FILE = path.join(DATA_DIR, "store.json");

// Clean in-memory cache + persistent backing
const memory = {
  patients: new Map(),
  sessions: new Map(),
  readings: [],
  recommendations: [],
  reports: [],
  settings: {
    thresholds: { ...DEFAULT_THRESHOLDS },
    defaultDeviceId: "SMARTCONTOUR-001",
  },
};

// Load existing persistent storage from disk on startup
function loadDurableStore() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.patients)) {
        parsed.patients.forEach((p) => memory.patients.set(p.id, p));
      }
      if (Array.isArray(parsed.sessions)) {
        parsed.sessions.forEach((s) => memory.sessions.set(s.id, s));
      }
      if (Array.isArray(parsed.readings)) {
        memory.readings = parsed.readings;
      }
      if (Array.isArray(parsed.recommendations)) {
        memory.recommendations = parsed.recommendations;
      }
      if (Array.isArray(parsed.reports)) {
        memory.reports = parsed.reports;
      }
      if (parsed.settings) {
        memory.settings = { ...memory.settings, ...parsed.settings };
      }
    }
  } catch (err) {
    console.warn("[Store] Could not load store.json, using defaults:", err.message);
  }
}

let saveTimer = null;
function persistToDisk() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const snapshot = {
        patients: [...memory.patients.values()],
        sessions: [...memory.sessions.values()],
        readings: memory.readings.slice(-1000), // keep latest 1000 readings durable
        recommendations: memory.recommendations.slice(0, 200),
        reports: memory.reports.slice(0, 100),
        settings: memory.settings,
        savedAt: new Date().toISOString(),
      };
      fs.writeFileSync(STORE_FILE, JSON.stringify(snapshot, null, 2), "utf8");
    } catch (err) {
      console.warn("[Store] Error writing store.json:", err.message);
    }
  }, 200);
}

// Initialize on module load
loadDurableStore();

function hasDb() {
  return isFirestoreVerified() && Boolean(getDb());
}

export function persistenceMode() {
  if (hasDb()) return "firestore";
  if (fs.existsSync(STORE_FILE)) return "local_persistent";
  return "ephemeral";
}

export function getStoreStatus() {
  return {
    mode: persistenceMode(),
    firestoreVerified: isFirestoreVerified(),
    firebaseConfigured: firebaseStatus().configured,
    firebaseError: firebaseStatus().error,
    persistentFilePath: STORE_FILE,
    counts: {
      patients: memory.patients.size,
      sessions: memory.sessions.size,
      readings: memory.readings.length,
      recommendations: memory.recommendations.length,
      reports: memory.reports.length,
    },
  };
}

// ==========================================
// Settings
// ==========================================
export async function getSettings() {
  if (hasDb()) {
    try {
      const snap = await Promise.race([
        getDb().collection("settings").doc("system").get(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 2500)),
      ]);
      if (snap.exists) return { ...memory.settings, ...snap.data() };
    } catch (e) {}
  }
  return memory.settings;
}

export async function saveSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  memory.settings = next;
  persistToDisk();
  if (hasDb()) {
    try {
      await Promise.race([
        getDb().collection("settings").doc("system").set(next, { merge: true }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 2500)),
      ]);
    } catch (e) {}
  }
  return next;
}

// ==========================================
// Patients
// ==========================================
export async function addPatient(patient) {
  memory.patients.set(patient.id, patient);
  persistToDisk();
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

export async function listPatients({ clinicianId } = {}) {
  if (hasDb()) {
    try {
      let query = getDb().collection("patients");
      if (clinicianId) {
        query = query.where("clinicianId", "==", clinicianId);
      }
      const snap = await Promise.race([
        query.get(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 2500)),
      ]);
      if (snap && snap.docs) {
        let list = snap.docs.map((d) => d.data());
        return list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      }
    } catch (e) {}
  }
  let list = [...memory.patients.values()];
  if (clinicianId) {
    list = list.filter((p) => p.clinicianId === clinicianId);
  }
  return list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
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
  persistToDisk();
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

// ==========================================
// Sessions
// ==========================================
export async function addSession(session) {
  memory.sessions.set(session.id, session);
  persistToDisk();
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

export async function listSessions({ patientId, clinicianId } = {}) {
  let allSessions = [];
  if (hasDb()) {
    try {
      let query = getDb().collection("sessions");
      if (patientId) query = query.where("patientId", "==", patientId);
      if (clinicianId) query = query.where("clinicianId", "==", clinicianId);
      const snap = await Promise.race([
        query.get(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 2500)),
      ]);
      if (snap && snap.docs) {
        allSessions = snap.docs.map((d) => d.data());
      }
    } catch (e) {}
  }
  if (!allSessions.length) {
    allSessions = [...memory.sessions.values()];
    if (patientId) {
      allSessions = allSessions.filter((s) => s.patientId === patientId);
    }
    if (clinicianId) {
      allSessions = allSessions.filter((s) => s.clinicianId === clinicianId);
    }
  }
  return allSessions.sort((a, b) => String(b.startTime || "").localeCompare(String(a.startTime || "")));
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
  persistToDisk();
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

export async function getActiveSessionForDevice(deviceId, patientId = null) {
  const sessions = await listSessions({ patientId });
  if (patientId) {
    const match = sessions.find((s) => s.deviceId === deviceId && s.status === "active" && s.patientId === patientId);
    if (match) return match;
  }
  return sessions.find((s) => s.deviceId === deviceId && s.status === "active") || null;
}

export async function getActiveSessionForPatient(patientId) {
  const sessions = await listSessions({ patientId });
  return sessions.find((s) => s.status === "active") || null;
}

// ==========================================
// Sensor Readings (Patient & Session Isolated)
// ==========================================
export async function addReading(reading) {
  memory.readings.push(reading);
  if (memory.readings.length > 5000) {
    memory.readings.splice(0, memory.readings.length - 4000);
  }
  persistToDisk();
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

export async function latestReading({ sessionId, patientId } = {}) {
  // If patientId is supplied but no sessionId, resolve patient's session IDs
  let targetSessionIds = null;
  if (sessionId) {
    targetSessionIds = new Set([sessionId]);
  } else if (patientId) {
    const pSessions = [...memory.sessions.values()].filter((s) => s.patientId === patientId);
    targetSessionIds = new Set(pSessions.map((s) => s.id));
  }

  if (hasDb()) {
    try {
      let query = getDb().collection("sensorReadings").orderBy("serverTimestamp", "desc");
      if (sessionId) {
        query = query.where("sessionId", "==", sessionId);
      }
      const snap = await Promise.race([
        query.limit(1).get(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 2500)),
      ]);
      if (snap && !snap.empty) {
        const item = snap.docs[0].data();
        if (!targetSessionIds || targetSessionIds.has(item.sessionId)) {
          return item;
        }
      }
    } catch (e) {}
  }

  if (targetSessionIds) {
    for (let i = memory.readings.length - 1; i >= 0; i -= 1) {
      if (targetSessionIds.has(memory.readings[i].sessionId)) {
        return memory.readings[i];
      }
    }
    return null;
  }

  return memory.readings.at(-1) || null;
}

export async function listReadings({ sessionId, patientId, limit = 400 } = {}) {
  let targetSessionIds = null;
  if (sessionId) {
    targetSessionIds = new Set([sessionId]);
  } else if (patientId) {
    const pSessions = [...memory.sessions.values()].filter((s) => s.patientId === patientId);
    targetSessionIds = new Set(pSessions.map((s) => s.id));
  }

  if (hasDb()) {
    try {
      let query = getDb().collection("sensorReadings").orderBy("serverTimestamp", "desc").limit(limit);
      if (sessionId) {
        query = getDb().collection("sensorReadings").where("sessionId", "==", sessionId).limit(limit);
      }
      const snap = await Promise.race([
        query.get(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 2500)),
      ]);
      if (snap && snap.docs) {
        let items = snap.docs.map((d) => d.data()).reverse();
        if (targetSessionIds && !sessionId) {
          items = items.filter((r) => targetSessionIds.has(r.sessionId));
        }
        return items;
      }
    } catch (e) {}
  }

  let filtered = memory.readings;
  if (targetSessionIds) {
    filtered = memory.readings.filter((r) => targetSessionIds.has(r.sessionId));
  }
  return filtered.slice(-limit);
}

// ==========================================
// Recommendations (Patient & Session Isolated)
// ==========================================
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
  persistToDisk();
  return items;
}

export async function listRecommendations({ sessionId, patientId } = {}) {
  let targetSessionIds = null;
  if (sessionId) {
    targetSessionIds = new Set([sessionId]);
  } else if (patientId) {
    const pSessions = [...memory.sessions.values()].filter((s) => s.patientId === patientId);
    targetSessionIds = new Set(pSessions.map((s) => s.id));
  }

  if (hasDb()) {
    try {
      let query = getDb().collection("recommendations").orderBy("createdAt", "desc").limit(80);
      if (sessionId) query = getDb().collection("recommendations").where("sessionId", "==", sessionId);
      const snap = await Promise.race([
        query.get(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 2500)),
      ]);
      if (snap && snap.docs) {
        let items = snap.docs.map((d) => d.data());
        if (targetSessionIds && !sessionId) {
          items = items.filter((r) => targetSessionIds.has(r.sessionId));
        }
        return items;
      }
    } catch (e) {}
  }

  if (targetSessionIds) {
    return memory.recommendations.filter((r) => targetSessionIds.has(r.sessionId)).slice(0, 80);
  }
  return memory.recommendations.slice(0, 80);
}

// ==========================================
// Reports (Patient & Session Isolated)
// ==========================================
export async function addReport(report) {
  memory.reports.unshift(report);
  persistToDisk();
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

export async function listReports({ sessionId, patientId } = {}) {
  if (hasDb()) {
    try {
      let query = getDb().collection("reports").orderBy("generatedAt", "desc");
      if (sessionId) query = query.where("session.id", "==", sessionId);
      if (patientId) query = query.where("patient.id", "==", patientId);
      const snap = await Promise.race([
        query.get(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 2500)),
      ]);
      if (snap && snap.docs) return snap.docs.map((d) => d.data());
    } catch (e) {}
  }

  let filtered = memory.reports;
  if (sessionId) {
    filtered = filtered.filter((r) => r.session?.id === sessionId);
  }
  if (patientId) {
    filtered = filtered.filter((r) => r.patient?.id === patientId);
  }
  return filtered;
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
