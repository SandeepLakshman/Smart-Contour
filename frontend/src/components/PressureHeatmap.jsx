import { useEffect, useRef, useState } from "react";
import { heatColor, SENSOR_META, classify, severityColor, severityTone } from "../utils/pressure";
import { AlertTriangle, CheckCircle, Info, Sparkles, X } from "lucide-react";

// Spatial zones on the prosthetic socket projection
const ZONES = [
  {
    key: "fsr1",
    x: 0.50,
    y: 0.26,
    name: "Zone 1 (Anterior Patellar Bar)",
    region: "Patellar Tendon / Proximal Shelf",
    gpio: "GPIO 34",
    recommendation: "High anterior pressure detected. Consider placing a 3mm to 4mm contoured Poron/Plastazote soft insert beneath the patellar bar to distribute proximal load and prevent tissue erythema.",
  },
  {
    key: "fsr2",
    x: 0.73,
    y: 0.44,
    name: "Zone 2 (Posterior Popliteal Fossa)",
    region: "Posterior Counter-Wall / Popliteal",
    gpio: "GPIO 35",
    recommendation: "Elevated posterior counter-pressure. Review posterior brim height; add a chamfered soft insert relief or lower trim line to prevent hamstring tendon impingement during knee flexion.",
  },
  {
    key: "fsr3",
    x: 0.27,
    y: 0.60,
    name: "Zone 3 (Distal Lateral Tibia / Fibula)",
    region: "Distal Lateral Shaft (Expansion)",
    gpio: "GPIO 32",
    recommendation: "Fibular head/shaft friction or pressure noted. Apply an adhesive 2mm soft silicone or EVA cushion donut around the bony prominence to relieve direct wall contact.",
  },
  {
    key: "fsr4",
    x: 0.50,
    y: 0.83,
    name: "Zone 4 (Distal Residual Apex)",
    region: "Terminal Distal End (Expansion)",
    gpio: "GPIO 33",
    recommendation: "Distal end bearing alert! Risk of bottoming out. Verify proximal suspension and socket volumetric fit; apply a distal silicone gel end-pad or distal total-surface cushion.",
  },
];

// Socket shape boundary polygon/function
function insideSocketContour(nx, ny) {
  const cx = 0.5;
  const top = 0.08;
  const bottom = 0.92;
  if (ny < top || ny > bottom) return false;

  // Curvature modeling a transtibial socket/residual limb
  const progress = (ny - top) / (bottom - top);
  // Width profile: wide at proximal brim (knee), tapering along distal shaft, rounded at apex
  let halfWidth;
  if (progress < 0.25) {
    // Proximal brim flare
    halfWidth = 0.32 - progress * 0.16;
  } else if (progress < 0.75) {
    // Tibial shaft gentle taper
    halfWidth = 0.28 - (progress - 0.25) * 0.18;
  } else {
    // Distal apex rounding
    const apexProgress = (progress - 0.75) / 0.25;
    halfWidth = 0.19 * Math.sqrt(Math.max(0, 1 - apexProgress * apexProgress));
  }

  const dx = Math.abs(nx - cx);
  return dx <= halfWidth;
}

export default function PressureHeatmap({
  sensors = {},
  thresholds = { lowMax: 349, mediumMax: 699 },
  selected = "fsr1",
  onSelect,
  live = false,
  history = [],
}) {
  const canvasRef = useRef(null);
  const [activeModalZone, setActiveModalZone] = useState(null);
  const [hoveredZone, setHoveredZone] = useState(null);

  // Compute live readings, peaks, and averages for each zone
  const zoneStats = ZONES.reduce((acc, z) => {
    const currentVal = sensors?.[z.key] != null ? Number(sensors[z.key]) : null;
    const historyVals = (history || [])
      .map((h) => h?.sensors?.[z.key])
      .filter((v) => typeof v === "number");

    const allVals = currentVal != null ? [...historyVals, currentVal] : historyVals;
    const peak = allVals.length ? Math.max(...allVals) : currentVal ?? "—";
    const avg = allVals.length
      ? Math.round(allVals.reduce((a, b) => a + b, 0) / allVals.length)
      : currentVal ?? "—";
    const severity = classify(currentVal, thresholds);

    acc[z.key] = {
      ...z,
      current: currentVal,
      peak,
      average: avg,
      severity,
    };
    return acc;
  }, {});

  // Find highest pressure zone
  let highestZoneKey = null;
  let highestVal = -1;
  ZONES.forEach((z) => {
    const val = zoneStats[z.key]?.current;
    if (typeof val === "number" && val > highestVal) {
      highestVal = val;
      highestZoneKey = z.key;
    }
  });

  // Render heatmap interpolation on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    const values = ZONES.map((z) => {
      const v = sensors?.[z.key];
      return typeof v === "number" ? Math.max(0, Math.min(1023, v)) : 0;
    });

    const img = ctx.createImageData(w, h);
    const data = img.data;

    // Inverse distance weighting interpolation across socket shape
    for (let y = 0; y < h; y += 1) {
      const ny = y / h;
      for (let x = 0; x < w; x += 1) {
        const nx = x / w;
        const i = (y * w + x) * 4;

        if (!insideSocketContour(nx, ny)) {
          data[i + 3] = 0; // Transparent outside socket
          continue;
        }

        let num = 0;
        let den = 0;
        ZONES.forEach((z, idx) => {
          const dx = nx - z.x;
          const dy = ny - z.y;
          const d2 = dx * dx + dy * dy * 1.3 + 0.0035; // slightly elliptical weight
          const wgt = 1 / (d2 * d2); // sharp localized falloff
          num += wgt * values[idx];
          den += wgt;
        });

        const interpolated = den > 0 ? num / den : 0;
        // Normalize against prototype max scale (1023 raw 10-bit / 12-bit scaled ADC)
        const normalizedT = Math.max(0, Math.min(1, interpolated / 1000));

        const rgbStr = heatColor(normalizedT);
        const rgb = rgbStr.match(/\d+/g).map(Number);

        data[i] = rgb[0];
        data[i + 1] = rgb[1];
        data[i + 2] = rgb[2];
        data[i + 3] = 230; // High opacity socket fill
      }
    }

    ctx.clearRect(0, 0, w, h);
    ctx.putImageData(img, 0, 0);

    // Draw socket contour vector outlines and trim lines
    ctx.save();
    ctx.strokeStyle = "rgba(58, 41, 33, 0.4)";
    ctx.lineWidth = 3.5;
    ctx.beginPath();

    // Trace smooth socket boundary
    const steps = 120;
    for (let step = 0; step <= steps; step++) {
      const progress = step / steps;
      const ny = 0.08 + progress * (0.92 - 0.08);
      let halfWidth;
      if (progress < 0.25) halfWidth = 0.32 - progress * 0.16;
      else if (progress < 0.75) halfWidth = 0.28 - (progress - 0.25) * 0.18;
      else {
        const ap = (progress - 0.75) / 0.25;
        halfWidth = 0.19 * Math.sqrt(Math.max(0, 1 - ap * ap));
      }
      const px = (0.5 + halfWidth) * w;
      const py = ny * h;
      if (step === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    for (let step = steps; step >= 0; step--) {
      const progress = step / steps;
      const ny = 0.08 + progress * (0.92 - 0.08);
      let halfWidth;
      if (progress < 0.25) halfWidth = 0.32 - progress * 0.16;
      else if (progress < 0.75) halfWidth = 0.28 - (progress - 0.25) * 0.18;
      else {
        const ap = (progress - 0.75) / 0.25;
        halfWidth = 0.19 * Math.sqrt(Math.max(0, 1 - ap * ap));
      }
      const px = (0.5 - halfWidth) * w;
      const py = ny * h;
      ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    // Internal socket guide ribs / brim lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);

    // Proximal patellar brim line
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.16, w * 0.24, h * 0.06, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Mid-socket transition line
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.52, w * 0.20, h * 0.05, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Draw sensor zone anchors and hotspot beacons
    ZONES.forEach((z) => {
      const stat = zoneStats[z.key];
      const isSelected = selected === z.key;
      const isHighest = highestZoneKey === z.key;
      const isHighSeverity = stat.severity === "HIGH";
      const zx = z.x * w;
      const zy = z.y * h;

      // Pulsing hotspot beacon ring for HIGH severity zones
      if (isHighSeverity || isHighest) {
        ctx.beginPath();
        ctx.arc(zx, zy, 20, 0, Math.PI * 2);
        ctx.fillStyle = isHighSeverity ? "rgba(220, 38, 38, 0.25)" : "rgba(245, 158, 11, 0.25)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(zx, zy, 14, 0, Math.PI * 2);
        ctx.strokeStyle = isHighSeverity ? "#DC2626" : "#D97706";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Selected ring
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(zx, zy, 24, 0, Math.PI * 2);
        ctx.strokeStyle = "#241914";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Zone core point
      ctx.beginPath();
      ctx.arc(zx, zy, 8, 0, Math.PI * 2);
      ctx.fillStyle = stat.severity === "HIGH" ? "#B42318" : stat.severity === "MEDIUM" ? "#D97706" : "#2E7D32";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#FFFFFF";
      ctx.stroke();

      // Label zone tag next to point
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillStyle = "#241914";
      ctx.fillText(z.key.toUpperCase(), zx + 12, zy + 4);
    });
  }, [sensors, thresholds, selected, highestZoneKey]);

  // Handle click on canvas
  function handleCanvasClick(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    const nx = (event.clientX - rect.left) / rect.width;
    const ny = (event.clientY - rect.top) / rect.height;

    let clicked = null;
    let minD = 0.14; // click tolerance
    ZONES.forEach((z) => {
      const d = Math.hypot(nx - z.x, ny - z.y);
      if (d < minD) {
        minD = d;
        clicked = z.key;
      }
    });

    if (clicked) {
      if (onSelect) onSelect(clicked);
      setActiveModalZone(clicked);
    }
  }

  // Handle hover on canvas to change cursor
  function handleCanvasMouseMove(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    const nx = (event.clientX - rect.left) / rect.width;
    const ny = (event.clientY - rect.top) / rect.height;
    const hit = ZONES.find((z) => Math.hypot(nx - z.x, ny - z.y) < 0.12);
    setHoveredZone(hit ? hit.key : null);
  }

  const activeStat = activeModalZone ? zoneStats[activeModalZone] : null;

  return (
    <div className="relative flex flex-col items-center">
      {/* Live Badge & Highest Zone Indicator */}
      <div className="w-full flex items-center justify-between px-2 mb-2">
        <div className="flex items-center gap-2">
          {live ? (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 text-xs font-semibold tracking-wider">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              LIVE ESP32 FEED
            </span>
          ) : (
            <span className="rounded-full bg-stone-100 text-stone-600 border border-stone-300 px-3 py-1 text-xs font-medium">
              Awaiting Stream
            </span>
          )}
        </div>

        {highestZoneKey && (
          <div className="flex items-center gap-1.5 rounded-full bg-rose-50 text-rose-800 border border-rose-300 px-3 py-1 text-xs font-semibold">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
            <span>Peak Hotspot: {zoneStats[highestZoneKey]?.name} ({highestVal})</span>
          </div>
        )}
      </div>

      {/* Main Heatmap Canvas */}
      <div className="relative w-full max-w-[420px] bg-gradient-to-b from-[#FAF6F0] to-[#EFE7DC] rounded-3xl p-4 shadow-inner border border-[#3A2921]/15">
        <canvas
          ref={canvasRef}
          width={400}
          height={520}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={() => setHoveredZone(null)}
          className={`mx-auto w-full h-auto rounded-2xl block transition-all ${
            hoveredZone ? "cursor-pointer drop-shadow-md" : "cursor-crosshair"
          }`}
          title="Click any sensor zone to inspect pressure details and cushioning recommendations"
        />

        {/* Floating tooltip hint on canvas */}
        <div className="mt-2 text-center text-xs text-[#3A2921]/70 font-medium">
          💡 Click any hotspot zone or button below to inspect peak, average & recommendation
        </div>
      </div>

      {/* Zone Quick Selection Bar */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 w-full max-w-[420px]">
        {ZONES.map((z) => {
          const stat = zoneStats[z.key];
          const tone = severityTone(stat.severity);
          const isSelected = selected === z.key;
          return (
            <button
              key={z.key}
              type="button"
              onClick={() => {
                onSelect?.(z.key);
                setActiveModalZone(z.key);
              }}
              style={{
                borderColor: isSelected ? "#3A2921" : tone.border,
                backgroundColor: isSelected ? "#FFFFFF" : tone.bg,
              }}
              className={`rounded-2xl p-2.5 text-left border transition-all ${
                isSelected ? "ring-2 ring-[#3A2921] shadow-md" : "hover:shadow-sm"
              }`}
            >
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-stone-500">
                <span>{z.key.toUpperCase()}</span>
                <span>{z.gpio}</span>
              </div>
              <div className="font-display text-base font-semibold text-[#241914] truncate mt-0.5">
                {z.name.split(" ")[0]} {z.name.split(" ")[1]}
              </div>
              <div className="flex justify-between items-baseline mt-1">
                <span className="text-lg font-bold font-mono" style={{ color: tone.text }}>
                  {stat.current != null ? stat.current : "—"}
                </span>
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded" style={{ color: tone.text }}>
                  {stat.severity}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Mandatory Color Legend & Prototype Threshold Banner */}
      <div className="mt-5 w-full max-w-[420px] rounded-2xl bg-white/80 border border-[#3A2921]/15 p-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-[#241914]">
          <span>Pressure Heatmap Gradient</span>
          <span className="text-[11px] text-stone-500">Raw Sensor Scale (0–1023)</span>
        </div>

        {/* Visual Gradient Bar */}
        <div className="h-3 w-full rounded-full bg-gradient-to-r from-[#2E7D32] via-[#F59E0B] via-60% to-[#B42318] shadow-inner" />

        <div className="flex justify-between text-[11px] font-medium text-stone-600">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#2E7D32]" />
            LOW (0–{thresholds.lowMax})
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#D97706]" />
            MED ({thresholds.lowMax + 1}–{thresholds.mediumMax})
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#B42318]" />
            HIGH ({thresholds.mediumMax + 1}+)
          </span>
        </div>

        {/* Mandatory Disclaimer */}
        <div className="text-[10px] text-center font-bold tracking-wider uppercase text-amber-800 bg-amber-50 rounded-lg py-1 border border-amber-200">
          PROTOTYPE THRESHOLDS — NOT CLINICAL DIAGNOSTIC LIMITS
        </div>
      </div>

      {/* Interactive Hotspot Inspection Modal / Popover */}
      {activeModalZone && activeStat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="relative w-full max-w-md rounded-3xl bg-[#FAF6F0] border border-[#3A2921]/20 p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-amber-800">
                  {activeStat.key.toUpperCase()} · {activeStat.gpio}
                </span>
                <h3 className="font-display text-2xl font-bold text-[#241914] mt-0.5">
                  {activeStat.name}
                </h3>
                <p className="text-xs text-stone-600 font-medium">{activeStat.region}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalZone(null)}
                className="rounded-full p-1.5 text-stone-500 hover:bg-stone-200 hover:text-stone-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Pressure Metrics Card */}
            <div className="grid grid-cols-3 gap-3 rounded-2xl bg-white p-4 border border-[#3A2921]/10">
              <div className="text-center">
                <span className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold">Current</span>
                <div className="text-2xl font-bold font-mono text-[#241914] mt-1">
                  {activeStat.current ?? "—"}
                </div>
                <span
                  className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                  style={severityTone(activeStat.severity)}
                >
                  {activeStat.severity}
                </span>
              </div>
              <div className="text-center border-x border-stone-200">
                <span className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold">Peak</span>
                <div className="text-2xl font-bold font-mono text-[#241914] mt-1">
                  {activeStat.peak ?? "—"}
                </div>
                <span className="text-[10px] text-stone-500">Session Max</span>
              </div>
              <div className="text-center">
                <span className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold">Average</span>
                <div className="text-2xl font-bold font-mono text-[#241914] mt-1">
                  {activeStat.average ?? "—"}
                </div>
                <span className="text-[10px] text-stone-500">Session Mean</span>
              </div>
            </div>

            {/* Soft Insert Recommendation Box */}
            <div className="rounded-2xl border border-amber-300 bg-amber-50/80 p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-900">
                <Sparkles className="h-4 w-4 text-amber-600" />
                <span>Soft Insert Contouring Recommendation</span>
              </div>
              <p className="text-sm leading-relaxed text-[#241914]">
                {activeStat.recommendation}
              </p>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setActiveModalZone(null)}
              className="w-full rounded-2xl bg-[#3A2921] text-[#F7F1E8] py-2.5 text-sm font-semibold hover:bg-[#241914] transition shadow-md"
            >
              Close Inspection
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
