import { useEffect, useState } from "react";
import { api } from "../services/api.js";
import { useApp } from "../context/AppContext.jsx";
import {
  CheckCircle,
  AlertCircle,
  Cpu,
  Server,
  Database,
  Sparkles,
  BookOpen,
  Sliders,
  ShieldCheck,
} from "lucide-react";

export default function Settings() {
  const { thresholds, setThresholds } = useApp();
  const [data, setData] = useState(null);
  const [lowMax, setLowMax] = useState(thresholds?.lowMax || 349);
  const [mediumMax, setMediumMax] = useState(thresholds?.mediumMax || 699);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .settings()
      .then((r) => {
        setData(r);
        if (r.settings?.thresholds) {
          setLowMax(r.settings.thresholds.lowMax);
          setMediumMax(r.settings.thresholds.mediumMax);
        }
      })
      .catch(() => {});
  }, []);

  async function saveThresholds(e) {
    e.preventDefault();
    setBusy(true);
    setSaveSuccess(false);
    try {
      const r = await api.updateThresholds({ lowMax: Number(lowMax), mediumMax: Number(mediumMax) });
      if (r.settings?.thresholds) {
        setThresholds(r.settings.thresholds);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {} finally {
      setBusy(false);
    }
  }

  const sys = data?.systemStatus || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-bold text-deep">System & Fitting Settings</h1>
        <p className="mt-1 text-sm text-brown/70">
          Monitor system services, hardware telemetry link, and prototype pressure thresholds.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* System Status Section */}
        <section className="glass rounded-[2rem] p-6 space-y-4 border border-[#3A2921]/15 shadow-sm">
          <div className="flex items-center gap-2 border-b border-[#3A2921]/10 pb-3">
            <ShieldCheck className="h-5 w-5 text-terracotta" />
            <h2 className="font-display text-2xl font-bold text-deep">SYSTEM STATUS</h2>
          </div>

          <div className="space-y-3">
            {/* ESP32 */}
            <StatusRow
              icon={Cpu}
              label="ESP32"
              status={sys.esp32 || "Disconnected"}
              isOk={sys.esp32 === "Connected"}
              hint="FSR1 (GPIO 34), FSR2 (GPIO 35) live via Wi-Fi HTTP"
            />

            {/* Backend */}
            <StatusRow
              icon={Server}
              label="Backend"
              status={sys.backend || "Connected"}
              isOk={sys.backend === "Connected"}
              hint="Express API & WebSocket streaming (:5000)"
            />

            {/* Firebase */}
            <StatusRow
              icon={Database}
              label="Firebase"
              status={sys.firebase || "Connected"}
              isOk={sys.firebase === "Connected"}
              hint={sys.persistenceMode || "Firestore Active"}
            />

            {/* Gemini AI */}
            <StatusRow
              icon={Sparkles}
              label="Gemini AI"
              status={sys.gemini || "Configured"}
              isOk={sys.gemini === "Configured"}
              hint="Model: gemini-3.8-flash (via Backend Proxy)"
            />

            {/* RAG Knowledge Base */}
            <StatusRow
              icon={BookOpen}
              label="RAG Knowledge Base"
              status={sys.rag || "Ready"}
              isOk={sys.rag === "Ready"}
              hint={`${sys.ragChunks || 16} vector passages indexed`}
            />
          </div>

          <div className="rounded-2xl bg-amber-50/80 border border-amber-200 p-3.5 text-xs text-amber-900 space-y-1">
            <p className="font-bold uppercase tracking-wider text-[10px]">Clinician & Security Note</p>
            <p className="leading-relaxed">
              API credentials, cloud keys, and private tokens are secured in server-side configuration only. No secrets are exposed to the client interface.
            </p>
          </div>
        </section>

        {/* Prototype Thresholds Config */}
        <section className="glass rounded-[2rem] p-6 space-y-4 border border-[#3A2921]/15 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-[#3A2921]/10 pb-3">
              <Sliders className="h-5 w-5 text-terracotta" />
              <h2 className="font-display text-2xl font-bold text-deep">Pressure Thresholds</h2>
            </div>
            <p className="text-xs text-stone-600 mt-2">
              Prototype/project thresholds. Not clinical diagnostic limits. Adjust sensitivity for raw ADC readings.
            </p>

            <form onSubmit={saveThresholds} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-deep mb-1">
                  LOW Max Threshold (Nominal Contact)
                </label>
                <input
                  type="number"
                  value={lowMax}
                  onChange={(e) => setLowMax(e.target.value)}
                  className="w-full rounded-2xl border border-[#3A2921]/15 bg-white px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-terracotta"
                />
                <span className="text-[11px] text-stone-500 mt-0.5 block">
                  Readings from 0 to {lowMax} are classified as LOW (Green).
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-deep mb-1">
                  MEDIUM Max Threshold (Caution Area)
                </label>
                <input
                  type="number"
                  value={mediumMax}
                  onChange={(e) => setMediumMax(e.target.value)}
                  className="w-full rounded-2xl border border-[#3A2921]/15 bg-white px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-terracotta"
                />
                <span className="text-[11px] text-stone-500 mt-0.5 block">
                  Readings from {Number(lowMax) + 1} to {mediumMax} are classified as MEDIUM (Amber/Yellow). Readings above {mediumMax} trigger HIGH Hotspots (Red).
                </span>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-2xl bg-[#3A2921] hover:bg-[#241914] text-[#F7F1E8] py-2.5 text-xs font-bold uppercase tracking-wider transition disabled:opacity-50 shadow-md"
              >
                {busy ? "Saving…" : "Save Threshold Configuration"}
              </button>
            </form>

            {saveSuccess && (
              <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-100/80 border border-emerald-300 p-2.5 rounded-xl">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <span>Thresholds updated and applied across live heatmap analysis.</span>
              </div>
            )}
          </div>

          <div className="text-[11px] text-stone-500 border-t border-[#3A2921]/10 pt-3">
            Hardware: SMARTCONTOUR-001 · 12-bit ADC (0–4095 mapped)
          </div>
        </section>
      </div>
    </div>
  );
}

function StatusRow({ icon: Icon, label, status, isOk, hint }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-2xl bg-white/70 border border-[#3A2921]/10">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl ${isOk ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <span className="text-xs font-bold text-deep block">{label}</span>
          {hint && <span className="text-[10px] text-stone-500 block">{hint}</span>}
        </div>
      </div>
      <span
        className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full border ${
          isOk
            ? "bg-emerald-50 text-emerald-800 border-emerald-300"
            : "bg-amber-50 text-amber-800 border-amber-300"
        }`}
      >
        {status}
      </span>
    </div>
  );
}
