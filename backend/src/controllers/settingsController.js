import { credentialStatus } from "../config.js";
import { firebaseStatus, pingFirestore } from "../firebase/admin.js";
import { geminiStatus } from "../ai/gemini.js";
import { knowledgeStatus } from "../rag/retrieval/retrieve.js";
import { clientCount } from "../services/realtime.js";
import { getSettings, persistenceMode, saveSettings } from "../services/store.js";
import { getDeviceStatus, listDevices } from "../services/deviceStatus.js";
import { config } from "../config.js";

export async function readSettings(_req, res) {
  const settings = await getSettings();
  const creds = credentialStatus();
  const db = firebaseStatus();
  const ping = await pingFirestore();
  const devStatus = getDeviceStatus(settings.defaultDeviceId || config.defaultDeviceId);
  const kStatus = knowledgeStatus();

  return res.json({
    success: true,
    settings: {
      thresholds: settings.thresholds,
      defaultDeviceId: settings.defaultDeviceId || config.defaultDeviceId,
    },
    systemStatus: {
      esp32: devStatus.connected ? "Connected" : "Disconnected",
      backend: "Connected",
      firebase: creds.firebase ? (ping.ok ? "Connected" : "In-Memory Fallback") : "Configuration required",
      gemini: creds.gemini ? "Configured" : "Configuration required",
      rag: kStatus.ready ? "Ready" : "Configuration required",
      persistenceMode: persistenceMode() === "firestore" ? "Real Firestore" : "Development In-Memory Fallback",
      ragChunks: kStatus.chunks,
      deviceInfo: {
        deviceId: devStatus.deviceId,
        status: devStatus.status,
        lastSeen: devStatus.lastSeen,
      },
    },
    status: {
      firebaseConfigured: creds.firebase,
      firebaseAvailable: db.available && ping.ok,
      persistence: persistenceMode(),
      geminiConfigured: geminiStatus().configured,
      knowledge: kStatus,
      websocketClients: clientCount(),
      primaryDevice: devStatus,
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
