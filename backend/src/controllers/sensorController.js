import { v4 as uuid } from "uuid";
import { analyzeSensors, summarizeReadings } from "../analysis/pressureAnalysis.js";
import { buildRecommendations } from "../analysis/recommendationEngine.js";
import { broadcast } from "../services/realtime.js";
import { markDeviceSeen } from "../services/deviceStatus.js";
import {
  addReading,
  addRecommendations,
  getActiveSessionForDevice,
  getSettings,
  latestReading,
  listReadings,
} from "../services/store.js";

export async function ingestSensorData(req, res) {
  try {
    const { deviceId, timestamp, sensors, sessionId } = req.body || {};
    if (!deviceId || typeof deviceId !== "string") {
      return res.status(400).json({ success: false, error: "deviceId is required" });
    }
    if (!sensors || typeof sensors !== "object") {
      return res.status(400).json({ success: false, error: "sensors object is required" });
    }

    const settings = await getSettings();
    const previous = await latestReading();
    const analyzed = analyzeSensors(sensors, settings.thresholds, previous);
    const session = sessionId
      ? { id: sessionId }
      : await getActiveSessionForDevice(deviceId);

    const reading = {
      id: uuid(),
      deviceId,
      sessionId: session?.id || null,
      timestamp: timestamp ?? Date.now(),
      serverTimestamp: new Date().toISOString(),
      sensors: analyzed.sensors,
      analysis: analyzed.analysis,
      highestPressureZone: analyzed.highestPressureZone,
      hotspots: analyzed.hotspots,
      source: "esp32",
    };

    await addReading(reading);
    markDeviceSeen(deviceId, { lastReadingId: reading.id });

    const history = session?.id ? await listReadings({ sessionId: session.id, limit: 200 }) : [reading];
    const stats = summarizeReadings(history, settings.thresholds);
    const recs = buildRecommendations(analyzed, stats).map((r) => ({
      ...r,
      id: uuid(),
      sessionId: session?.id || null,
      deviceId,
      readingId: reading.id,
      createdAt: new Date().toISOString(),
    }));
    if (recs.length) await addRecommendations(recs);

    const payload = {
      type: "sensor",
      live: true,
      reading,
      analysis: analyzed.analysis,
      highestPressureZone: analyzed.highestPressureZone,
      hotspots: analyzed.hotspots,
      recommendations: recs,
      stats,
    };
    broadcast(payload);

    const hotspot = analyzed.highestPressureZone
      ? {
          sensor: analyzed.highestPressureZone.sensor?.toUpperCase() || "FSR1",
          value: analyzed.highestPressureZone.value,
          severity: analyzed.highestPressureZone.severity,
          zone: analyzed.highestPressureZone.zone,
        }
      : null;

    return res.json({
      success: true,
      message: "Sensor data received",
      hotspot,
      reading,
      analysis: analyzed.analysis,
      highestPressureZone: analyzed.highestPressureZone,
      hotspots: analyzed.hotspots,
      recommendations: recs,
    });
  } catch (err) {
    console.error("ingestSensorData error:", err);
    return res.status(500).json({ success: false, error: "Failed to ingest sensor data", details: err?.message });
  }
}

export async function getLatestSensorData(_req, res) {
  try {
    const reading = await latestReading();
    if (!reading) return res.json({ success: true, reading: null, live: false });
    return res.json({ success: true, reading, live: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getSensorHistory(req, res) {
  try {
    const limit = Number(req.query.limit) || 100;
    const sessionId = req.query.sessionId || undefined;
    const readings = await listReadings({ sessionId, limit });
    return res.json({ success: true, count: readings.length, readings });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getSessionReadings(req, res) {
  try {
    const readings = await listReadings({ sessionId: req.params.sessionId, limit: 800 });
    const settings = await getSettings();
    const stats = summarizeReadings(readings, settings.thresholds);
    return res.json({ success: true, readings, stats });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
