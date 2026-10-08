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
  const [activeSession, setActiveSession] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [error, setError] = useState("");
  const demoRef = useRef(emptySensors());

  // Compute live analysis from current reading
  const analysis = useMemo(() => {
    return analysisFromSensors(reading?.sensors || emptySensors(), thresholds);
  }, [reading, thresholds]);

  // Fetch initial state & polling
  async function refreshAll() {
    try {
      const [hRes, setRes, latRes, recRes, sesRes, patRes] = await Promise.all([
        api.health().catch(() => null),
        api.settings().catch(() => null),
        api.latest().catch(() => null),
        api.recommendations().catch(() => ({ recommendations: [] })),
        api.sessions().catch(() => ({ sessions: [] })),
        api.patients().catch(() => ({ patients: [] })),
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
        const currentActive = sesRes.sessions.find((s) => s.status === "active");
        setActiveSession(currentActive || null);
      }
      if (recRes?.recommendations) {
        setRecommendations(recRes.recommendations);
      }
      if (latRes?.reading && mode === "live" && !reading) {
        setReading(latRes.reading);
        setHistory((h) => [...h.slice(-180), latRes.reading]);
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
  }, [mode]);

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
              setReading(data.reading);
              setHistory((h) => [...h.slice(-240), data.reading]);
              if (data.recommendations?.length) {
                setRecommendations((prev) => [...data.recommendations, ...prev].slice(0, 50));
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
  }, [mode]);

  // Demo mode generator
  useEffect(() => {
    if (mode !== "demo") return undefined;

    const timer = setInterval(() => {
      demoRef.current = demoTick(demoRef.current);
      const fakeReading = {
        id: "demo-" + Date.now(),
        deviceId: "DEMO-SIM",
        timestamp: Date.now(),
        serverTimestamp: new Date().toISOString(),
        sensors: { ...demoRef.current },
        source: "demo",
      };
      setReading(fakeReading);
      setHistory((h) => [...h.slice(-240), fakeReading]);
    }, 400);

    return () => clearInterval(timer);
  }, [mode]);

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
      activeSession,
      setActiveSession,
      error,
      refreshPatients: async () => {
        const p = await api.patients().catch(() => ({ patients: [] }));
        setPatients(p.patients || []);
      },
      refreshSessions: async () => {
        const s = await api.sessions().catch(() => ({ sessions: [] }));
        setSessions(s.sessions || []);
        setActiveSession(s.sessions?.find((x) => x.status === "active") || null);
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
      activeSession,
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
