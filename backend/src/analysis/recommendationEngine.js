import { SENSOR_ZONES } from "./pressureAnalysis.js";

export function buildRecommendations(analyzed, stats = null) {
  const recommendations = [];
  const now = new Date().toISOString();

  for (const [key, item] of Object.entries(analyzed.analysis || {})) {
    if (item.severity !== "HIGH") continue;
    const peak = stats?.perSensor?.[key]?.peak ?? item.value;
    const average = stats?.perSensor?.[key]?.average ?? item.value;
    recommendations.push({
      sensor: key,
      zone: item.zone,
      label: SENSOR_ZONES[key].label,
      severity: item.severity,
      current: item.value,
      peak,
      average,
      title: `Soft insert contouring suggested for ${item.zone}`,
      message:
        `Consider additional soft cushioning in the corresponding socket region (${item.zone}) and reassess pressure after fitting.`,
      disclaimer:
        "Prototype fitting-support guidance only. Not a clinical diagnosis or medical recommendation.",
      createdAt: now,
    });
  }

  return recommendations;
}
