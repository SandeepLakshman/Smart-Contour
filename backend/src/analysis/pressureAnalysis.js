export const DEFAULT_THRESHOLDS = {
  lowMax: 349,
  mediumMax: 699,
};

export const SENSOR_ZONES = {
  fsr1: { id: "fsr1", label: "FSR1", zone: "Zone 1", gpio: 34 },
  fsr2: { id: "fsr2", label: "FSR2", zone: "Zone 2", gpio: 35 },
  fsr3: { id: "fsr3", label: "FSR3", zone: "Zone 3", gpio: null, expansion: true },
  fsr4: { id: "fsr4", label: "FSR4", zone: "Zone 4", gpio: null, expansion: true },
};

export function normalizeSensors(input = {}) {
  const toNumber = (value) => {
    if (value === undefined || value === null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  return {
    fsr1: toNumber(input.fsr1),
    fsr2: toNumber(input.fsr2),
    fsr3: toNumber(input.fsr3),
    fsr4: toNumber(input.fsr4),
  };
}

export function classifySeverity(value, thresholds = DEFAULT_THRESHOLDS) {
  if (value === null || value === undefined) return "UNAVAILABLE";
  if (value <= thresholds.lowMax) return "LOW";
  if (value <= thresholds.mediumMax) return "MEDIUM";
  return "HIGH";
}

export function analyzeSensors(sensors, thresholds = DEFAULT_THRESHOLDS, previous = null) {
  const normalized = normalizeSensors(sensors);
  const analysis = {};
  let highest = { key: null, value: -1, zone: null, severity: "UNAVAILABLE" };

  for (const [key, meta] of Object.entries(SENSOR_ZONES)) {
    const value = normalized[key];
    const severity = classifySeverity(value, thresholds);
    const prevValue = previous?.sensors?.[key] ?? null;
    let trend = "stable";
    let trendPercent = 0;
    if (value !== null && prevValue !== null && prevValue !== 0) {
      trendPercent = Number((((value - prevValue) / prevValue) * 100).toFixed(1));
      if (trendPercent > 5) trend = "up";
      else if (trendPercent < -5) trend = "down";
    }

    analysis[key] = {
      value,
      severity,
      zone: meta.zone,
      label: meta.label,
      gpio: meta.gpio,
      expansion: Boolean(meta.expansion),
      trend,
      trendPercent,
    };

    if (value !== null && value > highest.value) {
      highest = { key, value, zone: meta.zone, severity };
    }
  }

  const hotspots = Object.values(analysis).filter((item) => item.severity === "HIGH");

  return {
    sensors: normalized,
    analysis,
    highestPressureZone: highest.key
      ? {
          sensor: highest.key,
          zone: highest.zone,
          value: highest.value,
          severity: highest.severity,
        }
      : null,
    hotspotCount: hotspots.length,
    hotspots,
  };
}

export function summarizeReadings(readings = [], thresholds = DEFAULT_THRESHOLDS) {
  const stats = {};
  for (const key of Object.keys(SENSOR_ZONES)) {
    const values = readings
      .map((r) => r.sensors?.[key])
      .filter((v) => typeof v === "number");
    const peak = values.length ? Math.max(...values) : null;
    const average = values.length
      ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1))
      : null;
    stats[key] = {
      peak,
      average,
      count: values.length,
      highEvents: values.filter((v) => classifySeverity(v, thresholds) === "HIGH").length,
      severity: classifySeverity(average, thresholds),
      zone: SENSOR_ZONES[key].zone,
    };
  }

  const allPeaks = Object.values(stats)
    .filter((s) => s.peak !== null)
    .sort((a, b) => b.peak - a.peak);

  return {
    perSensor: stats,
    totalReadings: readings.length,
    peakPressure: allPeaks[0]?.peak ?? null,
    averagePressure: (() => {
      const avgs = Object.values(stats).filter((s) => s.average !== null).map((s) => s.average);
      if (!avgs.length) return null;
      return Number((avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(1));
    })(),
    highestPressureZone: allPeaks[0]
      ? { zone: allPeaks[0].zone, peak: allPeaks[0].peak }
      : null,
    highPressureEvents: Object.values(stats).reduce((sum, s) => sum + s.highEvents, 0),
  };
}
