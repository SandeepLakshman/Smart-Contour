import { useState } from "react";
import { api } from "../services/api";
import { useApp } from "../context/AppContext";
import EmptyState from "../components/EmptyState";

export default function Sessions() {
  const { sessions, patients, refreshSessions, refreshPatients, selectedSessionId, selectSession } = useApp();
  const [patientId, setPatientId] = useState("");
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");

  async function start(e) {
    e.preventDefault();
    setError("");
    try {
      const res = await api.createSession({ patientId });
      await refreshSessions();
      if (res?.session?.id) {
        selectSession(res.session.id);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function open(id) {
    const data = await api.session(id);
    setDetail(data.session);
  }

  async function end(id) {
    await api.endSession(id);
    await refreshSessions();
    if (detail?.id === id) open(id);
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-7 space-y-4">
        <h1 className="font-display text-4xl">Fitting sessions</h1>
        <form onSubmit={start} className="glass flex items-end gap-3 rounded-3xl p-4">
          <label className="flex-1 text-sm">
            Patient
            <select
              className="mt-1 w-full rounded-2xl border border-brown/10 bg-white/80 px-3 py-2"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              onFocus={refreshPatients}
            >
              <option value="">Select patient</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button className="rounded-full bg-deep px-4 py-2 text-sm text-ivory">Start session</button>
        </form>
        {error && <p className="text-sm text-terracotta">{error}</p>}
        {!sessions.length && <EmptyState title="No sessions" body="Start a session to collect ESP32 readings." />}
        {sessions.map((s) => {
          const isSelected = selectedSessionId === s.id;
          return (
            <div
              key={s.id}
              className={`glass w-full rounded-3xl p-5 text-left border transition ${
                isSelected ? "border-terracotta bg-white/90 shadow-md ring-1 ring-terracotta" : "border-brown/10"
              }`}
            >
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => open(s.id)}
                  className="font-display text-2xl text-left hover:text-terracotta"
                >
                  {s.patientName || "Anonymous Patient"}
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => selectSession(s.id)}
                    className={`text-xs font-semibold px-3 py-1 rounded-full transition ${
                      isSelected
                        ? "bg-terracotta text-white"
                        : "bg-stone-100 hover:bg-stone-200 text-stone-700"
                    }`}
                  >
                    {isSelected ? "Active Session" : "Activate"}
                  </button>
                  <span className="text-xs uppercase tracking-widest text-terracotta px-2 py-0.5 rounded bg-amber-50">
                    {s.status}
                  </span>
                </div>
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => open(s.id)}
                className="mt-1 text-sm text-brown/60 cursor-pointer"
              >
                {s.deviceId} · {s.id} · {new Date(s.startTime).toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
      <div className="col-span-5">
        {detail ? (
          <div className="glass rounded-[2rem] p-6 space-y-3">
            <h2 className="font-display text-2xl">Session detail</h2>
            <Row k="Session ID" v={detail.id} />
            <Row k="Patient" v={detail.patientName} />
            <Row k="Device" v={detail.deviceId} />
            <Row k="Start" v={new Date(detail.startTime).toLocaleString()} />
            <Row k="End" v={detail.endTime ? new Date(detail.endTime).toLocaleString() : "In progress"} />
            <Row k="Duration" v={detail.durationMs ? `${Math.round(detail.durationMs / 1000)}s` : "—"} />
            <Row k="Total readings" v={detail.totalReadings} />
            <Row k="Peak pressure" v={detail.peakPressure ?? "—"} />
            <Row k="Average pressure" v={detail.averagePressure ?? "—"} />
            <Row k="Highest-pressure zone" v={detail.highestPressureZone?.zone || "—"} />
            {detail.status === "active" && (
              <button type="button" onClick={() => end(detail.id)} className="rounded-full bg-terracotta px-4 py-2 text-sm text-ivory">
                End session
              </button>
            )}
          </div>
        ) : (
          <EmptyState title="Select a session" body="Open a session to see duration, peaks, and zone statistics." />
        )}
      </div>
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
