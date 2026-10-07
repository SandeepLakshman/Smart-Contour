import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PressureHeatmap from "../components/PressureHeatmap";
import EmptyState from "../components/EmptyState";
import { useApp } from "../context/AppContext";
import { SENSOR_META, classify, severityColor, severityTone } from "../utils/pressure";
import { Activity, Play, Radio, Sparkles, Wifi, Server, Database, Clock } from "lucide-react";

export default function Dashboard() {
  const { reading, analysis, recommendations, thresholds, live, mode, setMode, history, backendOk, device, health } = useApp();
  const [selected, setSelected] = useState("fsr1");
  const sensors = reading?.sensors || {};
  const selectedMeta = analysis.analysis?.[selected];
  const hotspot = analysis.highestPressureZone;
  const rec = recommendations[0];

  const esp32Connected = mode === "demo" || Boolean(device?.connected || (reading && (Date.now() - new Date(reading.serverTimestamp || reading.timestamp).getTime()) < 15000));
  const firebaseOk = health?.firebase?.configured;

  return (
    <div className="space-y-6">
      {/* Top Header & Live / Demo Switch */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold text-deep">Live Socket Pressure Field</h1>
          <p className="mt-1 max-w-2xl text-sm text-brown/70">
            Real-time contact pressure analysis across 3D-printed prosthetic socket zones. Hotspots signal where soft insert contouring is recommended.
          </p>
        </div>

        {/* Live vs Demo Toggle */}
        <div className="flex items-center gap-2 bg-white/70 border border-[#3A2921]/15 p-1 rounded-full shadow-sm self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMode("live")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wider transition ${
              mode === "live"
                ? "bg-[#3A2921] text-[#F7F1E8] shadow-sm"
                : "text-brown/70 hover:text-brown"
            }`}
          >
            <Radio className="h-3 w-3" />
            <span>LIVE ESP32</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("demo")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wider transition ${
              mode === "demo"
                ? "bg-terracotta text-ivory shadow-sm"
                : "text-brown/70 hover:text-brown"
            }`}
          >
            <Play className="h-3 w-3" />
            <span>DEMO SIMULATION</span>
          </button>
        </div>
      </div>

      {/* Mandatory Connection Status Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white/85 p-3 rounded-2xl border border-[#3A2921]/15 text-xs shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className={`h-2.5 w-2.5 rounded-full ${esp32Connected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
          <div>
            <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider block">ESP32 Hardware</span>
            <span className="font-semibold text-deep">{esp32Connected ? (mode === "demo" ? "Connected (Sim)" : "Connected (WiFi)") : "Disconnected"}</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className={`h-2.5 w-2.5 rounded-full ${backendOk ? "bg-emerald-500" : "bg-rose-500"}`} />
          <div>
            <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider block">Express Backend</span>
            <span className="font-semibold text-deep">{backendOk ? "Connected (:5000)" : "Disconnected"}</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className={`h-2.5 w-2.5 rounded-full ${firebaseOk ? "bg-emerald-500" : "bg-amber-500"}`} />
          <div>
            <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider block">Firebase Firestore</span>
            <span className="font-semibold text-deep">{firebaseOk ? "Connected" : "In-Memory Store"}</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-stone-400" />
          <div className="truncate">
            <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider block">Last Sensor Update</span>
            <span className="font-mono text-deep font-medium">
              {reading?.serverTimestamp
                ? new Date(reading.serverTimestamp).toLocaleTimeString()
                : reading?.timestamp
                ? new Date(reading.timestamp).toLocaleTimeString()
                : "Waiting for ESP32 data"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Centerpiece Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Heatmap Section (Centerpiece) */}
        <section className="glass lg:col-span-7 rounded-[2rem] p-6 flex flex-col justify-between">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-deep">Socket Pressure Heatmap</h2>
              <p className="text-xs text-brown/60">Anatomical spatial interpolation</p>
            </div>
            <Legend />
          </div>

          {!reading && mode === "live" ? (
            <div className="my-8">
              <EmptyState
                title="Waiting for ESP32 data"
                body="Flash the ESP32 and send pressure data to http://192.168.0.159:5000/api/sensor-data, or switch to DEMO SIMULATION to preview."
              />
            </div>
          ) : (
            <PressureHeatmap
              sensors={sensors}
              thresholds={thresholds}
              selected={selected}
              onSelect={setSelected}
              live={live}
              history={history}
            />
          )}
        </section>

        {/* Sidebar Cards */}
        <section className="lg:col-span-5 space-y-4 flex flex-col justify-between">
          {/* Highest Pressure Zone Card */}
          <div className="glass rounded-[2rem] p-6 shadow-sm border border-[#3A2921]/10">
            <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-terracotta">
              Highest Pressure Hotspot
            </div>
            <div className="mt-2 font-display text-4xl font-bold text-deep">
              {hotspot?.zone || hotspot?.name || "Awaiting Data"}
            </div>
            <div
              className="mt-2 text-3xl font-mono font-bold flex items-baseline gap-2"
              style={{ color: severityColor(hotspot?.severity) }}
            >
              <span>{hotspot?.value ?? "—"}</span>
              <span className="text-sm uppercase font-sans font-semibold tracking-wider px-2 py-0.5 rounded-full bg-stone-100 border border-stone-200">
                {hotspot?.severity || "STANDBY"}
              </span>
            </div>
            <p className="mt-2 text-xs text-stone-500">
              Anterior/posterior equilibrium ratio currently active.
            </p>
          </div>

          {/* High Pressure Alert Card */}
          {analysis.hotspots?.length > 0 ? (
            <div className="rounded-[2rem] border border-terracotta/40 bg-gradient-to-br from-[#FBECE3] to-[#F5D8C7] p-6 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-terracotta flex items-center gap-1.5">
                <Activity className="h-4 w-4" />
                <span>Active Hotspot Detected</span>
              </div>
              <p className="mt-2 text-sm text-deep font-medium">
                {hotspot?.zone || "A sensor zone"} is currently crossing the prototype HIGH threshold.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-3 text-xs bg-white/60 p-3 rounded-2xl border border-terracotta/20">
                <Stat label="Current" value={hotspot?.value} />
                <Stat label="Peak" value={rec?.peak ?? hotspot?.value} />
                <Stat label="Average" value={rec?.average ?? hotspot?.value} />
              </div>
            </div>
          ) : (
            <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50/80 p-5 text-emerald-900 text-xs flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
              <span>All monitored zones are currently within nominal prototype ranges.</span>
            </div>
          )}

          {/* Soft Insert Actionable Guidance */}
          <div className="glass rounded-[2rem] p-6 shadow-sm border border-[#3A2921]/10">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] font-bold text-amber-800">
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              <span>Soft Insert Recommendation</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-deep font-medium">
              {rec?.message ||
                "No hotspot above prototype HIGH threshold. Maintain current socket contour and monitor pressure during dynamic gait stance."}
            </p>
            <p className="mt-3 text-[11px] text-brown/60 italic border-t border-[#3A2921]/10 pt-2">
              Prototype fitting-support guidance only. Not a medical diagnostic limit.
            </p>
          </div>
        </section>
      </div>

      {/* 4 Sensor Zone Telemetry Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {SENSOR_META.map((meta) => {
          const item = analysis.analysis?.[meta.key];
          const prev = history.at(-8)?.sensors?.[meta.key];
          const trendPct =
            item?.value != null && prev
              ? (((item.value - prev) / prev) * 100).toFixed(0)
              : item?.trendPercent;
          const isSelected = selected === meta.key;
          const tone = severityTone(item?.severity);

          return (
            <button
              key={meta.key}
              type="button"
              onClick={() => setSelected(meta.key)}
              className={`glass rounded-3xl p-4 text-left transition ${
                isSelected ? "ring-2 ring-terracotta shadow-md bg-white" : "hover:bg-white/60"
              }`}
            >
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-brown/60">
                <span>{meta.label}</span>
                <span>{meta.gpio}</span>
              </div>
              <div className="mt-1 font-display text-lg font-bold text-deep truncate">
                {meta.name}
              </div>
              <div className="mt-1 text-2xl font-bold font-mono" style={{ color: tone.text }}>
                {item?.value ?? "—"}
              </div>
              <div className="mt-2 flex justify-between items-center text-xs">
                <span
                  className="font-bold uppercase text-[10px] px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: tone.bg, color: tone.text }}
                >
                  {item?.severity || "—"}
                </span>
                <span className="font-mono text-[11px] text-brown/70 font-semibold">
                  {trendPct > 0 ? "↑" : trendPct < 0 ? "↓" : "→"} {trendPct || 0}%
                </span>
              </div>
              <MiniSpark history={history} k={meta.key} />
            </button>
          );
        })}
      </div>

      {/* Selected Zone Deep Dive */}
      <AnimatePresence>
        {selectedMeta && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-[2rem] p-6 shadow-sm border border-[#3A2921]/15"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs uppercase font-bold text-copper tracking-wider">
                  Zone Inspection
                </span>
                <h3 className="font-display text-2xl font-bold text-deep">
                  {selectedMeta.name || selectedMeta.zone} ({selectedMeta.gpio})
                </h3>
              </div>
              <span
                className="text-xs font-bold uppercase px-3 py-1 rounded-full font-mono"
                style={severityTone(selectedMeta.severity)}
              >
                {selectedMeta.severity}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm bg-white/70 p-4 rounded-2xl border border-[#3A2921]/10">
              <Stat label="Current" value={selectedMeta.value ?? "n/a"} />
              <Stat label="Peak" value={peakFor(history, selected)} />
              <Stat label="Average" value={avgFor(history, selected)} />
              <Stat label="Classification" value={classify(selectedMeta.value, thresholds)} />
              <Stat
                label="Action Suggestion"
                value={
                  classify(selectedMeta.value, thresholds) === "HIGH"
                    ? "Apply soft insert relief contour"
                    : "Nominal contact"
                }
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-[11px] uppercase tracking-widest text-brown/60 font-semibold">
      <span className="flex items-center gap-1">
        <i className="h-2 w-4 rounded-full bg-[#2E7D32]" /> Low
      </span>
      <span className="flex items-center gap-1">
        <i className="h-2 w-4 rounded-full bg-[#D97706]" /> Med
      </span>
      <span className="flex items-center gap-1">
        <i className="h-2 w-4 rounded-full bg-[#B42318]" /> High
      </span>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase font-bold tracking-widest text-stone-500">{label}</div>
      <div className="mt-1 font-mono font-bold text-deep text-base">{value}</div>
    </div>
  );
}

function peakFor(history, key) {
  const vals = history.map((h) => h.sensors?.[key]).filter((v) => typeof v === "number");
  return vals.length ? Math.max(...vals) : "—";
}

function avgFor(history, key) {
  const vals = history.map((h) => h.sensors?.[key]).filter((v) => typeof v === "number");
  if (!vals.length) return "—";
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(0);
}

function MiniSpark({ history, k }) {
  const pts = history.slice(-20).map((h) => h.sensors?.[k] ?? 0);
  if (pts.length < 2) return <div className="mt-2 h-7" />;
  const max = Math.max(...pts, 10);
  const d = pts
    .map((v, i) => `${(i / (pts.length - 1)) * 100},${26 - (v / max) * 22}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 28" className="mt-2 h-7 w-full overflow-visible">
      <polyline fill="none" stroke="#A65D45" strokeWidth="2.5" strokeLinecap="round" points={d} />
    </svg>
  );
}
