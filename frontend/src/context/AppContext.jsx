import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../services/api";
import {
  analysisFromSensors,
  DEFAULT_THRESHOLDS,
  emptySensors,
  SENSOR_KEYS,
} from "../utils/pressure";

const AppContext = createContext(null);

const defaultWs = import.meta.env.PROD
  ? "wss://smart-contour.onrender.com"
  : `ws://${window.location.hostname}:5000`;
const WS_URL = import.meta.env.VITE_WS_URL || defaultWs;

function demoTick(prev = {}) {
  const wander = (v, baseVal) => {
    const cur = v ?? baseVal;
    return Math.max(50, Math.min(960, Math.round(cur * 0.8 + (baseVal + (Math.random() - 0.45) * 120) * 0.2)));
  };
  return {
    fsr1: wander(prev.fsr1, 780), // Anterior patellar bar elevated
    fsr2: wander(prev.fsr2, 310), // Posterior fossa medium
    fsr3: wander(prev.fsr3, 190), // Lateral low
    fsr4: wander(prev.fsr4, 140), // Distal apex low
  };
}

export function AppProvider({ children }) {
  const [mode, setMode] = useState("live");
  const [backendOk, setBackendOk] = useState(true);
  const [wsOk, setWsOk] = useState(false);
  const [health, setHealth] = useState(null);
  const [device, setDevice] = useState(null);
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
  const [reading, setReading] = useState(null);
  const [history, setHistory] = useState([]);
  const [patients, setPatients] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(() => {
    return typeof window !== "undefined" ? localStorage.getItem("smartcontour_patient_id") || null : null;
  });
  const [selectedSessionId, setSelectedSessionId] = useState(() => {
    return typeof window !== "undefined" ? localStorage.getItem("smartcontour_session_id") || null : null;
  });
  const [recommendations, setRecommendations] = useState([]);
  const [error, setError] = useState("");
  const demoRef = useRef(emptySensors());

  // Derive active selected patient & session
  const selectedPatient = useMemo(() => {
    if (!selectedPatientId) return null;
    return patients.find((p) => p.id === selectedPatientId) || null;
  }, [patients, selectedPatientId]);

  const selectedSession = useMemo(() => {
    if (!selectedSessionId) return null;
    return sessions.find((s) => s.id === selectedSessionId) || null;
  }, [sessions, selectedSessionId]);

  // Compute live analysis from current reading
  const analysis = useMemo(() => {
    return analysisFromSensors(reading?.sensors || emptySensors(), thresholds);
  }, [reading, thresholds]);

  function selectPatient(patientId) {
    setSelectedPatientId(patientId);
    if (typeof window !== "undefined") {
      localStorage.setItem("smartcontour_patient_id", patientId);
    }
    // Find sessions for this patient and auto-select active or latest session
    const patientSessions = sessions.filter((s) => s.patientId === patientId);
    if (patientSessions.length) {
      const active = patientSessions.find((s) => s.status === "active") || patientSessions[0];
      setSelectedSessionId(active.id);
      if (typeof window !== "undefined") {
        localStorage.setItem("smartcontour_session_id", active.id);
      }
    }
  }

  function selectSession(sessionId) {
    setSelectedSessionId(sessionId);
    if (typeof window !== "undefined") {
      localStorage.setItem("smartcontour_session_id", sessionId);
    }
    const found = sessions.find((s) => s.id === sessionId);
    if (found?.patientId && found.patientId !== selectedPatientId) {
      setSelectedPatientId(found.patientId);
      if (typeof window !== "undefined") {
        localStorage.setItem("smartcontour_patient_id", found.patientId);
      }
    }
  }

  // Fetch initial state & polling isolated to selected patient & session
  async function refreshAll() {
    try {
      const [hRes, setRes, latRes, recRes, sesRes, patRes, histRes] = await Promise.all([
        api.health().catch(() => null),
        api.settings().catch(() => null),
        api.latest(selectedSessionId ? { sessionId: selectedSessionId, patientId: selectedPatientId } : undefined)
          .then((res) => {
            if (res?.reading) return res;
            if (selectedSessionId) return api.latest().catch(() => null);
            return res;
          })
          .catch(() => null),
        selectedSessionId
          ? api.recommendations({ sessionId: selectedSessionId, patientId: selectedPatientId }).catch(() => ({ recommendations: [] }))
          : Promise.resolve({ recommendations: [] }),
        selectedPatientId
          ? api.sessions({ patientId: selectedPatientId }).catch(() => ({ sessions: [] }))
          : api.sessions().catch(() => ({ sessions: [] })),
        api.patients().catch(() => ({ patients: [] })),
        selectedSessionId
          ? api.history({ sessionId: selectedSessionId, patientId: selectedPatientId, limit: 120 }).catch(() => ({ readings: [] }))
          : Promise.resolve({ readings: [] }),
      ]);

      if (hRes) {
        setHealth(hRes);
        setBackendOk(true);
      }
      if (setRes?.settings?.thresholds) {
        setThresholds(setRes.settings.thresholds);
      }
      if (setRes?.status?.primaryDevice) {
        setDevice(setRes.status.primaryDevice);
      }
      if (patRes?.patients) {
        setPatients(patRes.patients);
      }
      if (sesRes?.sessions) {
        setSessions(sesRes.sessions);
      }
      if (recRes?.recommendations) {
        setRecommendations(recRes.recommendations);
      }
      if (histRes?.readings) {
        setHistory(histRes.readings);
      }
      if (mode === "live" && latRes?.reading) {
        setReading(latRes.reading);
      }
      setError("");
    } catch (err) {
      setBackendOk(false);
      setError("Cannot reach backend server. Make sure the SmartContour backend is running.");
    }
  }

  useEffect(() => {
    refreshAll();
    const timer = setInterval(refreshAll, 6000);
    return () => clearInterval(timer);
  }, [mode, selectedPatientId, selectedSessionId]);

  // Live WebSocket stream
  useEffect(() => {
    if (mode !== "live") return undefined;

    let ws = null;
    let reconnectTimeout = null;

    function connectWs() {
      try {
        ws = new WebSocket(`${WS_URL}/ws`);
        ws.onopen = () => setWsOk(true);
        ws.onclose = () => {
          setWsOk(false);
          reconnectTimeout = setTimeout(connectWs, 3000);
        };
        ws.onerror = () => {
          setWsOk(false);
          ws?.close();
        };
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "sensor" && data.reading) {
              // Match session isolation: if a specific session is selected, only process matching readings or general live feed
              const r = data.reading;
              if (!selectedSessionId || !r.sessionId || r.sessionId === selectedSessionId) {
                setReading(r);
                setHistory((h) => [...h.slice(-240), r]);
                if (data.recommendations?.length) {
                  setRecommendations((prev) => [...data.recommendations, ...prev].slice(0, 50));
                }
              }
            }
          } catch {}
        };
      } catch {
        setWsOk(false);
      }
    }

    connectWs();

    return () => {
      clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, [mode, selectedSessionId]);

  // Demo mode generator
  useEffect(() => {
    if (mode !== "demo") {
      // Clear demo simulation data when in live mode unless hardware reading arrives
      setReading(null);
      setHistory([]);
      return undefined;
    }

    const timer = setInterval(() => {
      demoRef.current = demoTick(demoRef.current);
      const fakeReading = {
        id: "demo-" + Date.now(),
        deviceId: "DEMO-SIM",
        sessionId: selectedSessionId,
        patientId: selectedPatientId,
        timestamp: Date.now(),
        serverTimestamp: new Date().toISOString(),
        sensors: { ...demoRef.current },
        source: "demo",
      };
      setReading(fakeReading);
      setHistory((h) => [...h.slice(-240), fakeReading]);
    }, 400);

    return () => clearInterval(timer);
  }, [mode, selectedSessionId, selectedPatientId]);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      backendOk,
      wsOk,
      live: mode === "live" && (wsOk || Boolean(reading)),
      health,
      device,
      thresholds,
      setThresholds,
      reading,
      history,
      analysis,
      recommendations,
      patients,
      sessions,
      selectedPatient,
      selectedSession,
      selectedPatientId,
      selectedSessionId,
      activeSession: selectedSession,
      selectPatient,
      selectSession,
      setActiveSession: (session) => {
        if (session?.id) selectSession(session.id);
      },
      error,
      refreshPatients: async () => {
        const p = await api.patients().catch(() => ({ patients: [] }));
        setPatients(p.patients || []);
      },
      refreshSessions: async () => {
        const s = await api.sessions({ patientId: selectedPatientId }).catch(() => ({ sessions: [] }));
        setSessions(s.sessions || []);
      },
      refreshMeta: refreshAll,
    }),
    [
      mode,
      backendOk,
      wsOk,
      health,
      device,
      thresholds,
      reading,
      history,
      analysis,
      recommendations,
      patients,
      sessions,
      selectedPatient,
      selectedSession,
      selectedPatientId,
      selectedSessionId,
      error,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
