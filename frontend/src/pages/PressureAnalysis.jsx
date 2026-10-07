import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import PressureHeatmap from "../components/PressureHeatmap";
import { useApp } from "../context/AppContext";
import { SENSOR_META } from "../utils/pressure";
import EmptyState from "../components/EmptyState";

export default function PressureAnalysis() {
  const { history, analysis, thresholds, reading, live } = useApp();
  const chart = history.map((h, i) => ({
    i,
    time: new Date(h.serverTimestamp || h.timestamp).toLocaleTimeString(),
    fsr1: h.sensors?.fsr1,
    fsr2: h.sensors?.fsr2,
    fsr3: h.sensors?.fsr3,
    fsr4: h.sensors?.fsr4,
  }));
  const comparison = SENSOR_META.map((s) => ({
    name: s.zone,
    value: analysis.analysis?.[s.key]?.value ?? 0,
  }));
  const vals = history.flatMap((h) => SENSOR_META.map((s) => h.sensors?.[s.key]).filter((v) => typeof v === "number"));
  const peak = vals.length ? Math.max(...vals) : "—";
  const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "—";
  const highEvents = history.reduce(
    (n, h) => n + SENSOR_META.filter((s) => (h.sensors?.[s.key] ?? 0) >= (thresholds.mediumMax + 1)).length,
    0
  );

  if (!reading) {
    return <EmptyState title="No pressure data" body="Collect live ESP32 readings or use Demo Mode." />;
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl">Pressure analysis</h1>
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Maximum pressure" value={peak} />
        <StatCard label="Average pressure" value={avg} />
        <StatCard label="Highest pressure zone" value={analysis.highestPressureZone?.zone || "—"} />
        <StatCard label="High-pressure events" value={highEvents} />
      </div>
      <div className="grid grid-cols-12 gap-6">
        <div className="glass col-span-5 rounded-[2rem] p-5">
          <PressureHeatmap sensors={reading.sensors} thresholds={thresholds} live={live} history={history} />
        </div>
        <div className="glass col-span-7 rounded-[2rem] p-5">
          <h2 className="mb-3 font-display text-2xl">Pressure over time</h2>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={chart}>
                <CartesianGrid stroke="#efe4d3" />
                <XAxis dataKey="time" hide />
                <YAxis />
                <Tooltip />
                <Area dataKey="fsr1" stroke="#A65D45" fill="#C98A68" fillOpacity={0.35} />
                <Area dataKey="fsr2" stroke="#3A2921" fill="#EFE4D3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="glass rounded-[2rem] p-5">
          <h2 className="mb-3 font-display text-2xl">Sensor comparison</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={comparison}>
                <CartesianGrid stroke="#efe4d3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#A65D45" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass rounded-[2rem] p-5">
          <h2 className="mb-3 font-display text-2xl">Zone pressure trend</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={chart}>
                <CartesianGrid stroke="#efe4d3" />
                <XAxis dataKey="time" hide />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line dataKey="fsr1" stroke="#A65D45" dot={false} name="Zone 1" />
                <Line dataKey="fsr2" stroke="#3A2921" dot={false} name="Zone 2" />
                <Line dataKey="fsr3" stroke="#C98A68" dot={false} name="Zone 3" />
                <Line dataKey="fsr4" stroke="#6A8F71" dot={false} name="Zone 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="glass rounded-3xl p-5">
      <div className="text-[11px] uppercase tracking-widest text-brown/50">{label}</div>
      <div className="mt-2 font-display text-3xl">{value}</div>
    </div>
  );
}
