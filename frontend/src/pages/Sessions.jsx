import { useState } from "react";
import { api } from "../services/api";
import { useApp } from "../context/AppContext";
import EmptyState from "../components/EmptyState";

export default function Sessions() {
  const { sessions, patients, refreshSessions, refreshPatients, selectedSessionId, selectSession } = useApp();
  const [patientId, setPatientId] = useState("");
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [sessionToEnd, setSessionToEnd] = useState(null);

  async function start(e) {
    e.preventDefault();
    if (!patientId) {
      setError("Please select a patient first.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const res = await api.createSession({ patientId });
      await refreshSessions();
      if (res?.session?.id) {
        selectSession(res.session.id);
        open(res.session.id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function open(id) {
    try {
      const data = await api.session(id);
      setDetail(data.session);
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmEndSession() {
    if (!sessionToEnd) return;
    setBusy(true);
    try {
      await api.endSession(sessionToEnd);
      await refreshSessions();
      await open(sessionToEnd);
      setShowEndConfirm(false);
      setSessionToEnd(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function promptEnd(id) {
    setSessionToEnd(id);
    setShowEndConfirm(true);
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-7 space-y-4">
        <h1 className="font-display text-4xl">Fitting sessions</h1>
        <p className="text-sm text-brown/70">
          Manage real-time prosthetic socket fitting sessions. Only one active session may run per patient.
        </p>

        <form onSubmit={start} className="glass flex items-end gap-3 rounded-3xl p-4">
          <label className="flex-1 text-sm">
            Patient
            <select
              className="mt-1 w-full rounded-2xl border border-brown/10 bg-white/80 px-3 py-2 text-sm"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              onFocus={refreshPatients}
            >
              <option value="">Select patient…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.age ? `(${p.age}y)` : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={busy || !patientId}
            className="rounded-full bg-deep hover:bg-[#241914] px-5 py-2 text-sm text-ivory font-semibold transition disabled:opacity-50"
          >
            {busy ? "Starting…" : "Start session"}
          </button>
        </form>

        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex justify-between items-center">
            <span>{error}</span>
            <button type="button" onClick={() => setError("")} className="text-stone-400 hover:text-stone-700 font-bold">×</button>
          </div>
        )}

        {!sessions.length && <EmptyState title="No sessions recorded" body="Select a patient above to start an active fitting session." />}

        <div className="space-y-3">
          {sessions.map((s) => {
            const isSelected = selectedSessionId === s.id;
            const isActive = s.status === "active";
            return (
              <div
                key={s.id}
                className={`glass w-full rounded-3xl p-5 text-left border transition ${
                  isSelected ? "border-terracotta bg-white/95 shadow-md ring-1 ring-terracotta" : "border-brown/10"
                }`}
              >
                <div className="flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => open(s.id)}
                    className="font-display text-2xl text-left hover:text-terracotta transition"
                  >
                    {s.patientName || "Anonymous Patient"}
                  </button>
                  <div className="flex items-center gap-2">
                    {isActive ? (
                      <>
                        <button
                          type="button"
                          onClick={() => selectSession(s.id)}
                          className={`text-xs font-semibold px-3 py-1 rounded-full transition ${
                            isSelected
                              ? "bg-terracotta text-white"
                              : "bg-stone-100 hover:bg-stone-200 text-stone-700"
                          }`}
                        >
                          {isSelected ? "Live Active" : "Activate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => promptEnd(s.id)}
                          className="text-xs font-semibold px-3 py-1 rounded-full bg-rose-100 text-rose-800 hover:bg-rose-200 transition"
                        >
                          End Session
                        </button>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                          ACTIVE
                        </span>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            selectSession(s.id);
                            open(s.id);
                          }}
                          className={`text-xs font-semibold px-3 py-1 rounded-full transition ${
                            isSelected
                              ? "bg-stone-700 text-white"
                              : "bg-stone-100 hover:bg-stone-200 text-stone-700"
                          }`}
                        >
                          {isSelected ? "Viewing" : "Review"}
                        </button>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full border border-stone-200">
                          COMPLETED
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => open(s.id)}
                  className="mt-2 text-xs text-brown/60 cursor-pointer flex items-center gap-2"
                >
                  <span className="font-mono">{s.id.slice(0, 10)}</span>
                  <span>·</span>
                  <span>{s.deviceId}</span>
                  <span>·</span>
                  <span>{new Date(s.startTime).toLocaleString()}</span>
                  {s.endTime && (
                    <>
                      <span>·</span>
                      <span>Ended {new Date(s.endTime).toLocaleTimeString()}</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="col-span-5">
        {detail ? (
          <div className="glass rounded-[2rem] p-6 space-y-3.5 border border-[#3A2921]/10 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-brown/10">
              <h2 className="font-display text-2xl text-deep">Session details</h2>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  detail.status === "active"
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : "bg-stone-100 text-stone-700 border border-stone-200"
                }`}
              >
                {detail.status}
              </span>
            </div>

            <Row k="Session ID" v={detail.id} />
            <Row k="Patient" v={detail.patientName} />
            <Row k="Attending Clinician" v={detail.clinician || "Clinician"} />
            <Row k="Device" v={detail.deviceId} />
            <Row k="Start time" v={new Date(detail.startTime).toLocaleString()} />
            <Row k="End time" v={detail.endTime ? new Date(detail.endTime).toLocaleString() : "In progress"} />
            <Row
              k="Duration"
              v={
                detail.durationMs
                  ? `${Math.round(detail.durationMs / 1000)}s`
                  : detail.status === "active"
                  ? `${Math.round((Date.now() - new Date(detail.startTime).getTime()) / 1000)}s (live)`
                  : "—"
              }
            />
            <Row k="Total readings" v={detail.totalReadings ?? 0} />
            <Row k="Peak pressure" v={detail.peakPressure ?? "—"} />
            <Row k="Average pressure" v={detail.averagePressure ?? "—"} />
            <Row k="Peak zone" v={detail.highestPressureZone?.zone || "—"} />

            {detail.status === "active" && (
              <div className="pt-3 border-t border-brown/10">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => promptEnd(detail.id)}
                  className="w-full rounded-2xl bg-terracotta hover:bg-[#A83220] py-2.5 text-sm font-bold text-ivory transition shadow-sm"
                >
                  End Active Session
                </button>
              </div>
            )}
          </div>
        ) : (
          <EmptyState title="Select a session" body="Open a session to inspect duration, sensor peaks, and recorded history." />
        )}
      </div>

      {/* Confirmation Dialog for Ending Session */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="glass w-full max-w-sm rounded-[2rem] p-6 shadow-2xl bg-[#F7F1E8] border border-white/80 space-y-4">
            <h3 className="font-display text-xl font-bold text-deep">End fitting session?</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Ending this session will freeze telemetry recording, calculate final duration, and prepare the report summary. Live ESP32 readings will no longer append to this session.
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setShowEndConfirm(false);
                  setSessionToEnd(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-200/50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={confirmEndSession}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-terracotta text-white hover:bg-[#A83220]"
              >
                {busy ? "Ending…" : "Confirm End Session"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-brown/60">{k}</span>
      <span className="text-right text-deep">{String(v)}</span>
    </div>
  );
}
