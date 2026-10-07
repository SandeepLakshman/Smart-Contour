import admin from "firebase-admin";
import { config, credentialStatus } from "../config.js";

let db = null;
let initialized = false;
let lastError = null;

export function initFirebase() {
  const status = credentialStatus();
  if (!status.firebase) {
    initialized = false;
    db = null;
    lastError = `Missing Firebase credentials: ${status.missingFirebase.join(", ")}`;
    return { available: false, error: lastError };
  }

  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: config.firebase.projectId,
          clientEmail: config.firebase.clientEmail,
          privateKey: config.firebase.privateKey,
        }),
      });
    }
    db = admin.firestore();
    try {
      db.settings({ preferRest: true, ignoreUndefinedProperties: true });
    } catch {}
    initialized = true;
    lastError = null;
    return { available: true, error: null };
  } catch (error) {
    initialized = false;
    db = null;
    lastError = error?.message || "Firebase initialization failed";
    return { available: false, error: lastError };
  }
}

export function getDb() {
  return db;
}

export function firebaseStatus() {
  return {
    configured: initialized && Boolean(db),
    available: initialized && Boolean(db),
    error: lastError,
  };
}

export async function pingFirestore() {
  if (!db) return { ok: false, error: lastError || "Database unavailable" };
  try {
    const promise = db.collection("settings").doc("system").get();
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3500));
    await Promise.race([promise, timeout]);
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err.message || "Database unavailable" };
  }
}
