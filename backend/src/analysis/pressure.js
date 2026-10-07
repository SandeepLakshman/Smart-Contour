import { config } from "../config.js";

export const SENSOR_KEYS = ["fsr1", "fsr2", "fsr3", "fsr4"];

export const ZONE_MAP = {
  fsr1: { zone: "Zone 1", region: "Anterior-medial residual limb / tibial crest", gpio: 34, hardware: "connected" },
  fsr2: { zone: "Zone 2", region: "Anterior-lateral residual limb / fibular head", gpio: 35, hardware: "connected" },
  fsr3: { zone: "Zone 3", region: "Posterior residual limb / popliteal region", gpio: null, hardware: "planned" },
  fsr4: { zone: "Zone 4", region: "Distal residual limb / end-bearing region", gpio: null, hardware: "planned" },
};

const DEFAULT_THRESHOLDS = {
  lowMax: config.thresholds.lowMax,
  mediumMax: config.thresholds.mediumMax,
};

let runtimeThresholds = { ...DEFAULT_THRESHOLDS };

export function getThresholds() {
  return { ...runtimeThresholds };
}

export function setThresholds({ lowMax, mediumMax }) {
  if (typeof lowMax === "number" && lowMax >= 0) runtimeThresholds.lowMax = lowMax;
  if (typeof mediumMax === "number" && mediumMax > runtimeThresholds.lowMax) {
    runtimeThresholds.mediumMax = mediumMax;
  }
  return getThresholds();
}

export function classifySeverity(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "UNAVAILABLE";
  }
  const n = Number(value);
  const { lowMax, mediumMax } = runtimeThresholds;
  if (n <= lowMax) return "LOW";
  if (n <= mediumMax) return "MEDIUM";
  return "HIGH";
}

export function normalizeSensors(raw = {}) {
  const sensors = {};
  for (const key of SENSOR_KEYS) {
    if (raw[key] === undefined || raw[key] === null || raw[key] === "") {
      sensors[key] = null;
    } else {
      const n = Number(raw[key]);
      sensors[key] = Number.isFinite(n) ? n : null;
    }
  }
  return sensors;
}

export function analyzeReading(sensorsInput, history = []) {
  const sensors = normalizeSensors(sensorsInput);
  const analysis = {};
  const values = [];

  for (const key of SENSOR_KEYS) {
    const meta = ZONE_MAP[key];
    const value = sensors[key];
    const severity = classifySeverity(value);
    const series = history
      .map((h) => h?.sensors?.[key])
      .filter((v) => typeof v === "number");
    const peak = series.length ? Math.max(...series, value ?? 0) : value;
    const average =
      series.length > 0
        ? Math.round(series.reduce((a, b) => a + b, 0) / series.length)
        : value;
    const prev = series.length >= 2 ? series[series.length - 2] : series[0];
    let trend = "stable";
    let trendPct = 0;
    if (typeof value === "number" && typeof prev === "number" && prev !== 0) {
      trendPct = Math.round(((value - prev) / prev) * 100);
      if (trendPct > 5) trend = "rising";
      else if (trendPct < -5) trend = "falling";
    }

    analysis[key] = {
      value,
      severity,
      zone: meta.zone,
      region: meta.region,
      gpio: meta.gpio,
      hardware: meta.hardware,
      peak: typeof peak === "number" ? peak : null,
      average: typeof average === "number" ? average : null,
      trend,
      trendPct,
    };

    if (typeof value === "number") {
      values.push({ key, ...analysis[key] });
    }
  }

  const highest = values.sort((a, b) => b.value - a.value)[0] || null;
  const hotspots = values.filter((v) => v.severity === "HIGH");

  return {
    sensors,
    analysis,
    highestPressureZone: highest
      ? { zone: highest.zone, sensor: highest.key, value: highest.value, severity: highest.severity }
      : null,
    hotspots: hotspots.map((h) => ({
      zone: h.zone,
      sensor: h.key,
      value: h.value,
      peak: h.peak,
      average: h.average,
    })),
    summary: {
      max: highest?.value ?? null,
      average:
        values.length > 0
          ? Math.round(values.reduce((a, v) => a + v.value, 0) / values.length)
          : null,
      highEventCount: hotspots.length,
      availableSensors: values.length,
    },
    thresholds: getThresholds(),
    thresholdDisclaimer:
      "These ranges are prototype/project thresholds for SmartContour and are not clinical diagnostic limits.",
  };
}

export function cushioningRecommendation(zoneMeta) {
  return `Consider additional soft cushioning in ${zoneMeta.zone} (${zoneMeta.region}) and reassess pressure after fitting. This is prototype fitting-support guidance, not a medical diagnosis.`;
}
