import { credentialStatus } from "../config.js";
import { firebaseStatus, pingFirestore } from "../firebase/admin.js";
import { geminiStatus } from "../ai/gemini.js";
import { knowledgeStatus } from "../rag/retrieval/retrieve.js";
import { clientCount } from "../services/realtime.js";
import { getSettings, getStoreStatus, persistenceMode, saveSettings } from "../services/store.js";
import { getDeviceStatus, listDevices } from "../services/deviceStatus.js";
import { config } from "../config.js";

export async function readSettings(_req, res) {
  const settings = await getSettings();
  const creds = credentialStatus();
  const ping = await pingFirestore();
  const devStatus = getDeviceStatus(settings.defaultDeviceId || config.defaultDeviceId);
  const kStatus = knowledgeStatus();
  const storeStat = getStoreStatus();

  return res.json({
    success: true,
    settings: {
      thresholds: settings.thresholds,
      defaultDeviceId: settings.defaultDeviceId || config.defaultDeviceId,
    },
    systemStatus: {
      esp32: devStatus.connected ? "Connected" : "Disconnected",
      backend: "Connected",
      firebase: ping.ok ? "Connected" : (creds.firebase ? "Provisioning Required" : "Configuration Required"),
      firebaseDetails: ping.ok
        ? "Connected to Cloud Firestore"
        : (creds.firebase
            ? "Credentials valid, but Firestore (default) database is not yet created in the Firebase Console. Visit console.firebase.google.com/project/smart-contour/firestore and click 'Create database'."
            : "Firebase credentials missing from .env"),
      gemini: creds.gemini ? "Configured" : "Configuration required",
      rag: kStatus.ready ? "Ready" : "Configuration required",
      persistenceMode: storeStat.mode === "firestore"
        ? "Real Cloud Firestore"
        : "Durable Persistent Store (backend/data/store.json)",
      ragChunks: kStatus.chunks,
      deviceInfo: {
        deviceId: devStatus.deviceId,
        status: devStatus.status,
        lastSeen: devStatus.lastSeen,
      },
    },
    status: {
      firebaseConfigured: creds.firebase,
      firebaseAvailable: ping.ok,
      firebaseError: ping.error,
      persistence: storeStat.mode,
      geminiConfigured: geminiStatus().configured,
      knowledge: kStatus,
      websocketClients: clientCount(),
      primaryDevice: devStatus,
      store: storeStat,
    },
  });
}

export async function updateSettings(req, res) {
  const patch = {};
  if (req.body.thresholds) {
    patch.thresholds = {
      lowMax: Number(req.body.thresholds.lowMax),
      mediumMax: Number(req.body.thresholds.mediumMax),
    };
  }
  if (req.body.defaultDeviceId) patch.defaultDeviceId = String(req.body.defaultDeviceId);
  const settings = await saveSettings(patch);
  return res.json({ success: true, settings });
}
