import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { api } from "../services/api.js";
import { EmptyState, ErrorState, LoadingState } from "../components/StatusPills.jsx";
import { Download, FileText, Sparkles } from "lucide-react";

export default function Reports() {
  const { activeSession, sessions } = useApp();
  const [list, setList] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const effectiveSessionId = selectedSessionId || activeSession?.sessionId || activeSession?.id;

  async function load() {
    try {
      const r = await api.reports();
      setList(r.reports || []);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    if (activeSession?.id && !selectedSessionId) {
      setSelectedSessionId(activeSession.id);
    }
  }, [activeSession]);

  async function generate() {
    if (!effectiveSessionId) {
      setError("Please select or start a fitting session first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await api.generateReport({ sessionId: effectiveSessionId, includeAi: true });
      if (res.report) {
        setPreview(res.report);
        window.open(api.reportPdfUrl(res.report.id), "_blank");
      }
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function showPreview(id) {
    try {
      const res = await api.report(id);
      setPreview(res.report);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold text-deep">Prosthetic Socket Fitting Reports</h1>
          <p className="mt-1 text-sm text-brown/70">
            Export comprehensive session pressure telemetry, hotspot severity maps, and AI cushioning guidance.
          </p>
        </div>

        {/* Generate Button & Session Picker */}
        <div className="flex items-center gap-3">
          <select
            value={effectiveSessionId || ""}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="rounded-2xl border border-[#3A2921]/15 bg-white px-3 py-2 text-xs font-semibold"
          >
            <option value="">Select session…</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.patientName || "Patient"} · {s.status.toUpperCase()} ({s.id.slice(0, 6)})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={generate}
            disabled={busy || !effectiveSessionId}
            className="rounded-2xl bg-[#3A2921] hover:bg-[#241914] text-[#F7F1E8] px-5 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            <span>Generate PDF Report</span>
          </button>
        </div>
      </div>

      {error && <ErrorState title="Report error" body={error} />}
      {busy && <LoadingState label="Synthesizing session readings and compiling PDF…" />}

      {preview && (
        <div className="glass rounded-[2rem] p-6 space-y-4 border border-[#3A2921]/15 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-copper">Generated Report</span>
              <h2 className="font-display text-3xl font-bold text-deep mt-0.5">
                Session {preview.id?.slice(0, 8)} Summary
              </h2>
              <p className="text-xs text-stone-600 mt-1">
                Patient: <span className="font-bold">{preview.patient?.name || "Anonymous Patient"}</span> · Device: {preview.session?.deviceId}
              </p>
            </div>
            <a
              href={api.reportPdfUrl(preview.id)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-full bg-terracotta text-white px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-terracotta/90 transition shadow-sm"
            >
              <Download className="h-4 w-4" />
              <span>Download PDF</span>
            </a>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/70 p-4 rounded-2xl border border-[#3A2921]/10 text-xs">
            <div>
              <span className="text-stone-500 uppercase text-[10px] font-bold">Total Readings</span>
              <div className="text-lg font-bold font-mono text-deep">{preview.stats?.totalReadings ?? "—"}</div>
            </div>
            <div>
              <span className="text-stone-500 uppercase text-[10px] font-bold">Peak Pressure</span>
              <div className="text-lg font-bold font-mono text-deep">{preview.stats?.peakPressure ?? "—"}</div>
            </div>
            <div>
              <span className="text-stone-500 uppercase text-[10px] font-bold">Mean Pressure</span>
              <div className="text-lg font-bold font-mono text-deep">{preview.stats?.averagePressure ?? "—"}</div>
            </div>
            <div>
              <span className="text-stone-500 uppercase text-[10px] font-bold">Peak Zone</span>
              <div className="text-lg font-bold font-mono text-deep">{preview.stats?.highestPressureZone?.zone || "—"}</div>
            </div>
          </div>

          {preview.ai && (
            <div className="rounded-2xl bg-amber-50/90 border border-amber-200 p-4 space-y-2 text-xs">
              <span className="text-amber-900 font-bold uppercase tracking-wider text-[10px]">
                Clinical Engineering Evaluation
              </span>
              <p className="text-stone-800 leading-relaxed text-sm whitespace-pre-wrap">{preview.ai}</p>
            </div>
          )}
        </div>
      )}

      {/* Stored Reports Table */}
      <div className="glass rounded-[2rem] p-6 space-y-4">
        <h3 className="font-display text-2xl font-bold text-deep">Archived Session Reports</h3>
        {list.length === 0 ? (
          <EmptyState
            title="No stored reports"
            body="Start a session or select an existing one above to generate your first PDF report."
          />
        ) : (
          <div className="divide-y divide-[#3A2921]/10">
            {list.map((r) => (
              <div key={r.id} className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-stone-100 p-2 text-deep">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => showPreview(r.id)}
                      className="font-bold text-sm text-deep hover:text-terracotta text-left"
                    >
                      Report {r.id?.slice(0, 8)} ({r.patient?.name || "Patient"})
                    </button>
                    <p className="text-xs text-stone-500">
                      Session {r.session?.id?.slice(0, 8)} · Generated {new Date(r.generatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => showPreview(r.id)}
                    className="px-3 py-1.5 rounded-xl border border-[#3A2921]/15 text-xs font-semibold hover:bg-white"
                  >
                    View
                  </button>
                  <a
                    href={api.reportPdfUrl(r.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#3A2921] text-ivory text-xs font-semibold hover:bg-deep"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>PDF</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
