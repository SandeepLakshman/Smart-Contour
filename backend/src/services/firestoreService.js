import { getDb, serverTimestamp } from "../firebase/admin.js";

function wrap(err) {
  if (err.code === "FIREBASE_UNAVAILABLE") throw err;
  const error = new Error(err.message || "Database unavailable");
  error.code = "FIREBASE_UNAVAILABLE";
  throw error;
}

export async function createPatient(data) {
  try {
    const db = getDb();
    const ref = db.collection("patients").doc();
    const doc = {
      patientId: ref.id,
      name: data.name,
      age: data.age ?? null,
      notes: data.notes || "",
      createdAt: serverTimestamp(),
    };
    await ref.set(doc);
    return { ...doc, patientId: ref.id, createdAt: new Date().toISOString() };
  } catch (e) {
    wrap(e);
  }
}

export async function listPatients() {
  try {
    const snap = await getDb().collection("patients").get();
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  } catch (e) {
    wrap(e);
  }
}

export async function getPatient(id) {
  try {
    const snap = await getDb().collection("patients").doc(id).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() };
  } catch (e) {
    wrap(e);
  }
}

export async function updatePatient(id, data) {
  try {
    const ref = getDb().collection("patients").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return null;
    const patch = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.age !== undefined) patch.age = data.age;
    if (data.notes !== undefined) patch.notes = data.notes;
    patch.updatedAt = serverTimestamp();
    await ref.update(patch);
    const next = await ref.get();
    return { id: next.id, ...next.data() };
  } catch (e) {
    wrap(e);
  }
}

export async function createSession(data) {
  try {
    const db = getDb();
    const ref = db.collection("sessions").doc();
    const doc = {
      sessionId: ref.id,
      patientId: data.patientId,
      patientName: data.patientName || "",
      deviceId: data.deviceId,
      startTime: serverTimestamp(),
      endTime: null,
      status: "active",
      totalReadings: 0,
      peakPressure: null,
      averagePressure: null,
      highestPressureZone: null,
    };
    await ref.set(doc);
    return { ...doc, sessionId: ref.id, startTime: new Date().toISOString() };
  } catch (e) {
    wrap(e);
  }
}

export async function listSessions(patientId) {
  try {
    const snap = patientId
      ? await getDb().collection("sessions").where("patientId", "==", patientId).get()
      : await getDb().collection("sessions").get();
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(b.startTime || "").localeCompare(String(a.startTime || "")));
  } catch (e) {
    wrap(e);
  }
}

export async function getSession(id) {
  try {
    const snap = await getDb().collection("sessions").doc(id).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() };
  } catch (e) {
    wrap(e);
  }
}

export async function endSession(id) {
  try {
    const ref = getDb().collection("sessions").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return null;
    await ref.update({ status: "completed", endTime: serverTimestamp() });
    const next = await ref.get();
    return { id: next.id, ...next.data() };
  } catch (e) {
    wrap(e);
  }
}

export async function getActiveSession(deviceId) {
  try {
    const snap = await getDb()
      .collection("sessions")
      .where("status", "==", "active")
      .limit(10)
      .get();
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (deviceId) {
      const match = docs.find((d) => d.deviceId === deviceId);
      if (match) return match;
    }
    return docs[0] || null;
  } catch (e) {
    wrap(e);
  }
}

export async function saveSensorReading(reading) {
  try {
    const db = getDb();
    const ref = db.collection("sensorReadings").doc();
    await ref.set({
      ...reading,
      storedAt: serverTimestamp(),
    });
    if (reading.sessionId) {
      const sessionRef = db.collection("sessions").doc(reading.sessionId);
      const session = await sessionRef.get();
      if (session.exists) {
        const prev = session.data();
        const total = (prev.totalReadings || 0) + 1;
        const peak = Math.max(prev.peakPressure || 0, reading.summary?.max || 0);
        const avg =
          prev.averagePressure == null
            ? reading.summary?.average
            : Math.round(((prev.averagePressure * (total - 1)) + (reading.summary?.average || 0)) / total);
        await sessionRef.update({
          totalReadings: total,
          peakPressure: peak || prev.peakPressure,
          averagePressure: avg,
          highestPressureZone: reading.highestPressureZone || prev.highestPressureZone,
        });
      }
    }
    return { id: ref.id, ...reading };
  } catch (e) {
    wrap(e);
  }
}

export async function latestReading(sessionId) {
  try {
    const snap = sessionId
      ? await getDb().collection("sensorReadings").where("sessionId", "==", sessionId).get()
      : await getDb().collection("sensorReadings").limit(80).get();
    const rows = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return rows[0] || null;
  } catch (e) {
    wrap(e);
  }
}

export async function sessionReadings(sessionId, limit = 300) {
  try {
    const snap = await getDb().collection("sensorReadings").where("sessionId", "==", sessionId).get();
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
      .slice(-limit);
  } catch (e) {
    wrap(e);
  }
}

export async function saveRecommendation(rec) {
  try {
    const ref = getDb().collection("recommendations").doc();
    await ref.set({ ...rec, createdAt: serverTimestamp() });
    return { id: ref.id, ...rec };
  } catch (e) {
    wrap(e);
  }
}

export async function listRecommendations(sessionId) {
  try {
    const snap = sessionId
      ? await getDb().collection("recommendations").where("sessionId", "==", sessionId).get()
      : await getDb().collection("recommendations").get();
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, 50);
  } catch (e) {
    wrap(e);
  }
}

export async function saveReportMeta(meta) {
  try {
    const ref = getDb().collection("reports").doc();
    await ref.set({ ...meta, createdAt: serverTimestamp() });
    return { id: ref.id, ...meta };
  } catch (e) {
    wrap(e);
  }
}

export async function listReports() {
  try {
    const snap = await getDb().collection("reports").get();
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, 40);
  } catch (e) {
    wrap(e);
  }
}
