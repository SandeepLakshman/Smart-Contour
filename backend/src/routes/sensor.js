import { Router } from "express";
import { analyzeReading, SENSOR_KEYS } from "../analysis/pressure.js";
import { persistHotspotRecommendations } from "../analysis/recommendations.js";
import { broadcast } from "../services/realtime.js";
import {
  noteDeviceActivity,
  setLatest,
  getLatest,
  getMemoryHistory,
  getDeviceStatus,
} from "../services/deviceState.js";
import * as store from "../services/firestoreService.js";
import { getFirebaseStatus } from "../firebase/admin.js";
import { config } from "../config.js";

const router = Router();

router.post("/sensor-data", async (req, res) => {
  try {
    const body = req.body || {};
    const deviceId = body.deviceId || config.defaultDeviceId;
    if (!body.sensors || typeof body.sensors !== "object") {
      return res.status(400).json({
        success: false,
        error: "Request must include a sensors object (fsr1, fsr2, optional fsr3/fsr4).",
      });
    }

    const hasAny = SENSOR_KEYS.some((k) => body.sensors[k] !== undefined && body.sensors[k] !== null);
    if (!hasAny) {
      return res.status(400).json({ success: false, error: "At least one sensor value is required." });
    }

    let session = null;
    if (getFirebaseStatus().configured) {
      try {
        session = body.sessionId
          ? await store.getSession(body.sessionId)
          : await store.getActiveSession(deviceId);
      } catch {
        session = null;
      }
    }

    const history = getMemoryHistory(40);
    const result = analyzeReading(body.sensors, history);
    const timestamp = Number(body.timestamp) || Date.now();
    const serverTimestamp = Date.now();

    const reading = {
      deviceId,
      sessionId: session?.sessionId || session?.id || body.sessionId || null,
      timestamp,
      serverTimestamp,
      sensors: result.sensors,
      analysis: result.analysis,
      highestPressureZone: result.highestPressureZone,
      hotspots: result.hotspots,
      summary: result.summary,
      source: "esp32",
      demo: false,
    };

    noteDeviceActivity(deviceId, reading);
    setLatest(reading);

    let persisted = false;
    let persistError = null;
    if (getFirebaseStatus().configured) {
      try {
        await store.saveSensorReading(reading);
        persisted = true;
      } catch (err) {
        persistError = err.message;
      }
    } else {
      persistError = "Database unavailable — reading kept in live memory only, not stored as session data.";
    }

    const recommendations = await persistHotspotRecommendations({
      sessionId: reading.sessionId,
      deviceId,
      result,
    });

    const payload = {
      ...reading,
      recommendations,
      persisted,
      persistError,
      thresholds: result.thresholds,
      thresholdDisclaimer: result.thresholdDisclaimer,
      device: getDeviceStatus(deviceId),
    };

    broadcast("sensor", payload);

    res.json({
      success: true,
      analysis: result.analysis,
      highestPressureZone: result.highestPressureZone,
      hotspots: result.hotspots,
      recommendations,
      persisted,
      persistError,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || "Sensor ingest failed." });
  }
});

router.get("/sensor-data/latest", async (req, res) => {
  try {
    const sessionId = req.query.sessionId;
    const mem = getLatest();
    if (mem && (!sessionId || mem.sessionId === sessionId)) {
      return res.json({ success: true, reading: mem, source: "live-memory" });
    }
    if (getFirebaseStatus().configured) {
      const stored = await store.latestReading(sessionId);
      return res.json({ success: true, reading: stored, source: "firestore" });
    }
    return res.json({ success: true, reading: null, source: "none" });
  } catch (err) {
    const code = err.code === "FIREBASE_UNAVAILABLE" ? 503 : 500;
    res.status(code).json({ success: false, error: err.message, code: err.code });
  }
});

router.get("/sessions/:sessionId/readings", async (req, res) => {
  try {
    if (!getFirebaseStatus().configured) {
      return res.status(503).json({ success: false, error: "Database unavailable" });
    }
    const readings = await store.sessionReadings(req.params.sessionId);
    res.json({ success: true, readings });
  } catch (err) {
    const code = err.code === "FIREBASE_UNAVAILABLE" ? 503 : 500;
    res.status(code).json({ success: false, error: err.message });
  }
});

export default router;
