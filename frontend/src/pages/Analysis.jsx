import { useState } from "react";
import { useApp } from "../hooks/AppContext.jsx";
import PressureHeatmap from "../components/PressureHeatmap.jsx";
import { EmptyState } from "../components/StatusPills.jsx";
import { SENSOR_KEYS } from "../utils/pressure.js";

export default function Analysis() {
  const { reading, history, thresholds, liveConnected, mode } = useApp();
  const [selected, setSelected] = useState("fsr1");
  if (!reading) {
    return <EmptyState title="No analysis data" body="Use Demo Mode or send ESP32 readings." />;
  }
  const highEvents = history.filter((h) => h?.hotspots?.length).length;
  return (
    <div className="space-y-6">
      <PressureHeatmap
        reading={reading}
        thresholds={thresholds}
        onSelectZone={setSelected}
        selected={selected}
        live={liveConnected || (mode === "live" && !reading.demo)}
        demo={mode === "demo" || reading.demo}
      />
      <div className="grid md:grid-cols-4 gap-4">
        {[
          ["Maximum", reading?.summary?.max ?? "—"],
          ["Average", reading?.summary?.average ?? "—"],
          ["Highest zone", reading?.highestPressureZone?.zone ?? "—"],
          ["High-pressure events", highEvents],
        ].map(([l, v]) => (
          <div key={l} className="glass rounded-3xl p-5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{l}</p>
            <p className="font-display text-3xl mt-1">{v}</p>
          </div>
        ))}
      </div>
      <div className="glass rounded-3xl p-5">
        <p className="text-sm font-semibold mb-3">Recent samples</p>
        {SENSOR_KEYS.map((k) => (
          <p key={k} className="text-sm py-1">
            {k.toUpperCase()}: {reading.sensors?.[k] ?? "unavailable"}
          </p>
        ))}
      </div>
    </div>
  );
}
