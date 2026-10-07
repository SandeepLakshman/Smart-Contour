import { ZONE_MAP, cushioningRecommendation } from "./pressure.js";
import * as store from "../services/firestoreService.js";

const lastHigh = new Map();
const COOLDOWN_MS = 20000;

export async function persistHotspotRecommendations({ sessionId, deviceId, result }) {
  const created = [];
  if (!result.hotspots?.length) return created;

  for (const hotspot of result.hotspots) {
    const key = `${sessionId || "none"}:${hotspot.sensor}`;
    const prev = lastHigh.get(key) || 0;
    if (Date.now() - prev < COOLDOWN_MS) continue;
    lastHigh.set(key, Date.now());

    const rec = {
      sessionId: sessionId || null,
      deviceId,
      sensor: hotspot.sensor,
      zone: hotspot.zone,
      severity: "HIGH",
      current: hotspot.value,
      peak: hotspot.peak,
      average: hotspot.average,
      text: cushioningRecommendation(ZONE_MAP[hotspot.sensor]),
      disclaimer: "Prototype fitting-support guidance. Not a medical diagnosis.",
    };

    try {
      const saved = await store.saveRecommendation(rec);
      created.push(saved);
    } catch {
      created.push({ ...rec, persisted: false });
    }
  }
  return created;
}
