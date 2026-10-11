import { SENSOR_ZONES } from "./pressureAnalysis.js";

const ZONE_KNOWLEDGE_PROFILES = {
  fsr1: {
    zone: "Zone 1",
    label: "FSR1 (GPIO 34)",
    anatomicalRegion: "Anterior / Tibial Crest & Patellar Tendon",
    citation: "cushioning-and-refit.md, soft-insert-contouring.md",
    high: {
      title: "Zone 1 (Anterior / Tibial Crest) Elevated Load",
      message:
        "High pressure detected in Zone 1. Knowledge guidance indicates common causes are local anterior socket tightness, insufficient relief over the tibial crest bony ridge, or sleeve sensor contact with a firm socket rim. Consider adding a contoured soft insert (silicone/Poron) or re-contouring the anterior relief zone. Reassess interface pressure under identical loading after fitting.",
      rationale:
        "Anterior prominence load concentration is documented in cushioning-and-refit.md. Refit protocol advises checking for limb volume change and verifying sensor placement before diagnosing socket failure.",
    },
    medium: {
      title: "Zone 1 (Anterior) Moderate Contact Pressure",
      message:
        "Zone 1 is reading in the moderate band. Monitor whether pressure creeps upward during prolonged standing. Ensure the liner does not have localized thinning over the anterior crest.",
      rationale:
        "Moderate readings represent normal load-bearing in patellar tendon bearing sockets, but sudden increases warrant inspection.",
    },
  },
  fsr2: {
    zone: "Zone 2",
    label: "FSR2 (GPIO 35)",
    anatomicalRegion: "Anterior-Lateral / Fibular Head",
    citation: "cushioning-and-refit.md, socket-pressure-mapping.md",
    high: {
      title: "Zone 2 (Lateral / Fibular Head) Hotspot Alert",
      message:
        "High pressure detected over Zone 2. The fibular head is a pressure-intolerant bony prominence. Guidance in cushioning-and-refit.md highlights inadequate relief or an overly aggressive lateral wall contour as primary factors. Check that the FSR is not stacked against a trim line. Recommend localized soft insert cushioning or relief channel expansion.",
      rationale:
        "Fibular head impingement can lead to peroneal nerve irritation and skin redness. Protocol recommends checking lateral alignment and verifying the sensor has not shifted.",
    },
    medium: {
      title: "Zone 2 (Lateral) Moderate Warning",
      message:
        "Zone 2 shows moderate interface pressure. Confirm that the fibular head has adequate relief clearance during stance and swing phases.",
      rationale:
        "Lateral pressure should remain well-distributed across soft tissues rather than focusing on the fibular head apex.",
    },
  },
  fsr3: {
    zone: "Zone 3",
    label: "FSR3 (GPIO 32)",
    anatomicalRegion: "Posterior / Popliteal Fossa",
    citation: "prosthetic-socket-pressure-overview.md",
    high: {
      title: "Zone 3 (Posterior / Popliteal) High Shelf Load",
      message:
        "Elevated posterior pressure indicates possible posterior brim shelf constriction or excessive counter-pressure during knee flexion. Consider softening the posterior brim flare or evaluating hamstring tendon clearance.",
      rationale:
        "Posterior shelf load supports anterior counter-pressure, but excessive peaks restrict circulation and comfort.",
    },
    medium: {
      title: "Zone 3 (Posterior) Moderate Counter-Pressure",
      message:
        "Posterior interface pressure is in the expected counter-bearing range. Verify comfort during seated 90-degree flexion.",
      rationale:
        "Moderate posterior wall loading is expected to maintain socket suspension and counter anterior patellar forces.",
    },
  },
  fsr4: {
    zone: "Zone 4",
    label: "FSR4 (GPIO 33)",
    anatomicalRegion: "Distal Apex",
    citation: "soft-insert-contouring.md, prosthetic-socket-pressure-overview.md",
    high: {
      title: "Zone 4 (Distal Apex) High End-Bearing Contact",
      message:
        "High reading at the distal apex signals possible socket bottoming-out or limb pistoning. Check suspension sleeve integrity and limb volume. Add distal soft cushioning only after confirming proper circumferential load distribution.",
      rationale:
        "Distal end tissues cannot tolerate excessive direct axial loading without circumferential load sharing.",
    },
    medium: {
      title: "Zone 4 (Distal Apex) Moderate Contact",
      message:
        "Distal contact is present in the moderate range. Ensure total contact without distal pooling or shear.",
      rationale:
        "Total contact sockets aim for light distal contact to prevent distal edema.",
    },
  },
};

export function buildRecommendations(analyzed, stats = null) {
  const recommendations = [];
  const now = new Date().toISOString();

  for (const [key, item] of Object.entries(analyzed.analysis || {})) {
    const profile = ZONE_KNOWLEDGE_PROFILES[key];
    if (!profile) continue;

    const peak = stats?.perSensor?.[key]?.peak ?? item.value;
    const average = stats?.perSensor?.[key]?.average ?? item.value;

    // HIGH severity: Full actionable insert contouring recommendation
    if (item.severity === "HIGH") {
      recommendations.push({
        sensor: key,
        zone: item.zone,
        label: profile.label,
        anatomicalRegion: profile.anatomicalRegion,
        severity: "HIGH",
        current: item.value,
        peak,
        average,
        title: profile.high.title,
        message: profile.high.message,
        rationale: profile.high.rationale,
        sourceEvidence: profile.citation,
        hasSufficientEvidence: true,
        disclaimer:
          "Prototype fitting-support guidance only. Not a clinical diagnosis or medical recommendation. Thresholds are engineering demonstration values.",
        createdAt: now,
      });
    } else if (item.severity === "MEDIUM" && (item.trend === "up" || item.value > 500)) {
      // Elevated MEDIUM with upward trend: Early intervention recommendation
      recommendations.push({
        sensor: key,
        zone: item.zone,
        label: profile.label,
        anatomicalRegion: profile.anatomicalRegion,
        severity: "MEDIUM",
        current: item.value,
        peak,
        average,
        title: profile.medium.title,
        message: profile.medium.message,
        rationale: profile.medium.rationale,
        sourceEvidence: profile.citation,
        hasSufficientEvidence: true,
        disclaimer:
          "Prototype fitting-support guidance only. Not a clinical diagnosis or medical recommendation. Thresholds are engineering demonstration values.",
        createdAt: now,
      });
    } else if (item.severity === "UNAVAILABLE" && (key === "fsr3" || key === "fsr4")) {
      // Expansion slots without connected sensors: explicit acknowledgement of insufficient evidence
      // Note: we do not invent advice for unavailable zones
    }
  }

  return recommendations;
}
