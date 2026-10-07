export const SENSOR_META = [
  {
    key: "fsr1",
    label: "FSR1",
    zone: "Zone 1",
    name: "Zone 1 (Anterior / Patellar)",
    region: "Anterior (Patellar Tendon Bar)",
    gpio: "GPIO 34",
    expansion: false,
    tip: "Proximal weight-bearing shelf; high pressure indicates excessive anterior loading.",
  },
  {
    key: "fsr2",
    label: "FSR2",
    zone: "Zone 2",
    name: "Zone 2 (Posterior / Popliteal)",
    region: "Posterior (Popliteal Fossa)",
    gpio: "GPIO 35",
    expansion: false,
    tip: "Posterior counter-pressure zone; high pressure can cause neurovascular pinch.",
  },
  {
    key: "fsr3",
    label: "FSR3",
    zone: "Zone 3",
    name: "Zone 3 (Distal Lateral)",
    region: "Lateral (Fibular Shaft & Head)",
    gpio: "GPIO 32",
    expansion: true,
    tip: "Pressure-sensitive bony prominence; requires relief pocket or soft insert.",
  },
  {
    key: "fsr4",
    label: "FSR4",
    zone: "Zone 4",
    name: "Zone 4 (Distal Apex)",
    region: "Distal Residual Limb Apex",
    gpio: "GPIO 33",
    expansion: true,
    tip: "Terminal end; high pressure indicates bottoming out, requiring distal pad or proximal suspension check.",
  },
];

export const SENSOR_KEYS = ["fsr1", "fsr2", "fsr3", "fsr4"];

export const ZONE_META = {
  fsr1: SENSOR_META[0],
  fsr2: SENSOR_META[1],
  fsr3: SENSOR_META[2],
  fsr4: SENSOR_META[3],
};

export const DEFAULT_THRESHOLDS = { lowMax: 349, mediumMax: 699 };

export function classify(value, thresholds = DEFAULT_THRESHOLDS) {
  if (value === null || value === undefined || value === "") return "UNAVAILABLE";
  const num = Number(value);
  if (!Number.isFinite(num)) return "UNAVAILABLE";
  if (num <= thresholds.lowMax) return "LOW";
  if (num <= thresholds.mediumMax) return "MEDIUM";
  return "HIGH";
}

export function severityColor(severity) {
  if (severity === "HIGH") return "#B42318";
  if (severity === "MEDIUM") return "#D97706";
  if (severity === "LOW") return "#2E7D32";
  return "#9A8B80";
}

export function severityTone(severity) {
  if (severity === "HIGH") return { bg: "rgba(180, 35, 24, 0.12)", text: "#B42318", border: "rgba(180, 35, 24, 0.35)" };
  if (severity === "MEDIUM") return { bg: "rgba(217, 119, 6, 0.12)", text: "#D97706", border: "rgba(217, 119, 6, 0.35)" };
  if (severity === "LOW") return { bg: "rgba(46, 125, 50, 0.12)", text: "#2E7D32", border: "rgba(46, 125, 50, 0.35)" };
  return { bg: "rgba(154, 139, 128, 0.12)", text: "#78685C", border: "rgba(154, 139, 128, 0.25)" };
}

export function heatColor(t) {
  // Continuous smooth interpolation: LOW (Green) -> MEDIUM (Yellow/Orange) -> HIGH (Red)
  const stops = [
    [0.0, [46, 125, 50]],      // Forest Green
    [0.35, [139, 195, 74]],    // Light Green
    [0.55, [245, 158, 11]],    // Amber / Yellow
    [0.72, [217, 119, 6]],     // Copper Orange
    [0.85, [225, 29, 72]],     // Deep Red-Orange
    [1.0, [180, 35, 24]],      // High Hotspot Red
  ];
  const clamped = Math.max(0, Math.min(1, t));
  let i = 0;
  while (i < stops.length - 1 && clamped > stops[i + 1][0]) i += 1;
  const [p0, c0] = stops[i];
  const [p1, c1] = stops[Math.min(i + 1, stops.length - 1)];
  const f = p1 === p0 ? 0 : (clamped - p0) / (p1 - p0);
  const r = Math.round(c0[0] + (c1[0] - c0[0]) * f);
  const g = Math.round(c0[1] + (c1[1] - c0[1]) * f);
  const b = Math.round(c0[2] + (c1[2] - c0[2]) * f);
  return `rgb(${r},${g},${b})`;
}

export function emptySensors() {
  return { fsr1: null, fsr2: null, fsr3: null, fsr4: null };
}

export function analysisFromSensors(sensors, thresholds = DEFAULT_THRESHOLDS) {
  const analysis = {};
  let highest = null;
  for (const meta of SENSOR_META) {
    const value = sensors?.[meta.key] ?? null;
    const severity = classify(value, thresholds);
    analysis[meta.key] = {
      ...meta,
      value,
      severity,
      trend: "stable",
      trendPercent: 0,
    };
    if (value !== null && (!highest || value > highest.value)) {
      highest = { sensor: meta.key, zone: meta.zone, name: meta.name, region: meta.region, value, severity };
    }
  }
  return {
    sensors,
    analysis,
    highestPressureZone: highest,
    hotspots: Object.values(analysis).filter((s) => s.severity === "HIGH"),
  };
}
