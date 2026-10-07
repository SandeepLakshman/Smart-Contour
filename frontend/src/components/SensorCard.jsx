import { ZONE_META, classify, severityTone } from "../utils/pressure.js";

export default function SensorCard({ sensorKey, reading, history, thresholds }) {
  const a = reading?.analysis?.[sensorKey];
  const value = a?.value ?? reading?.sensors?.[sensorKey];
  const severity = a?.severity || classify(value, thresholds);
  const tone = severityTone(severity);
  const meta = ZONE_META[sensorKey];
  const ts = reading?.serverTimestamp || reading?.timestamp;
  const last = history.slice(-12).map((h) => h?.sensors?.[sensorKey] || 0);
  const max = Math.max(1, ...last);

  return (
    <div className={`glass rounded-2xl p-4 ring-1 ${tone.ring}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold tracking-wide">{sensorKey.toUpperCase()}</p>
        <span className={`text-[11px] px-2 py-0.5 rounded-full ${tone.bg} ${tone.text}`}>{severity}</span>
      </div>
      <p className="text-xs text-muted mt-1">{meta.zone} · {meta.gpio}</p>
      <p className="text-3xl font-semibold mt-2">{value ?? "—"}</p>
      <div className="flex items-center justify-between mt-1 text-xs text-muted">
        <span>{a?.trend === "rising" ? "↑" : a?.trend === "falling" ? "↓" : "→"} {a?.trendPct ?? 0}%</span>
        <span>{ts ? new Date(ts).toLocaleTimeString() : "No update"}</span>
      </div>
      <div className="h-10 mt-2 flex items-end gap-0.5">
        {last.map((v, i) => (
          <div key={i} className="flex-1 bg-terra/70 rounded-t" style={{ height: `${Math.max(8, (v / max) * 100)}%` }} />
        ))}
      </div>
    </div>
  );
}
