import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../services/api";
import { analysisFromSensors, DEFAULT_THRESHOLDS, emptySensors } from "../utils/pressure";

const defaultWs = import.meta.env.PROD
  ? "wss://smart-contour.onrender.com"
  : `ws://${window.location.hostname}:5000`;
const WS_URL = import.meta.env.VITE_WS_URL || defaultWs;

function demoTick(prev) {
  const wander = (v, bias) => {
    const base = v ?? 180 + bias;
    return Math.max(40, Math.min(980, Math.round(base + (Math.random() - 0.42) * 70)));
  };
  return {
    fsr1: wander(prev.fsr1, 520),
    fsr2: wander(prev.fsr2, 80),
    fsr3: wander(prev.fsr3, 40),
    fsr4: wander(prev.fsr4, 30),
  };
}

export function useLivePressure() {
  const [mode, setMode] = useState("live");
  const [backendOk, setBackendOk] = useState(true);
  const [wsOk, setWsOk] = useState(false);
  const [device, setDevice] = useState(null);
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
  const [reading, setReading] = useState(null);
  const [analysis, setAnalysis] = useState(analysisFromSensors(emptySensors(), DEFAULT_THRESHOLDS));
  const [recommendations, setRecommendations] = useState([]);
  const [history, setHistory] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [patients, setPatients] = useState([]);
  const [error, setError] = useState("");
  const demoRef = useRef(emptySensors());

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const [settings, latest, recs, sess, pats] = await Promise.all([
          api.settings(),
          api.latest(),
          api.recommendations(),
          api.sessions(),
          api.patients(),
        ]);
        if (cancelled) return;
        setBackendOk(true);
        setThresholds(settings.settings.thresholds || DEFAULT_THRESHOLDS);
        setDevice(settings.status.primaryDevice);
        setSessions(sess.sessions || []);
        setPatients(pats.patients || []);
        setRecommendations(recs.recommendations || []);
        if (latest.reading && mode === "live") {
          setReading(latest.reading);
          setAnalysis(analysisFromSensors(latest.reading.sensors, settings.settings.thresholds));
          setHistory((h) => [...h.slice(-180), latest.reading]);
        }
        setError("");
      } catch {
        if (!cancelled) {
          setBackendOk(false);
          setError("Backend connection error");
        }
      }
    }
    boot();
    const t = setInterval(boot, 8000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== "live") return undefined;
    const socket = new WebSocket(`${WS_URL}/ws`);
    socket.onopen = () => setWsOk(true);
    socket.onclose = () => setWsOk(false);
    socket.onerror = () => setWsOk(false);
    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type !== "sensor") return;
      setReading(msg.reading);
      setAnalysis({
        analysis: msg.analysis,
        highestPressureZone: msg.highestPressureZone,
        hotspots: msg.hotspots,
      });
      if (msg.recommendations?.length) {
        setRecommendations((prev) => [...msg.recommendations, ...prev].slice(0, 80));
      }
      setHistory((h) => [...h.slice(-240), msg.reading]);
    };
    return () => socket.close();
  }, [mode]);

  useEffect(() => {
    if (mode !== "demo") return undefined;
    const id = setInterval(() => {
      demoRef.current = demoTick(demoRef.current);
      const sensors = demoRef.current;
      const next = analysisFromSensors(sensors, thresholds);
      const fake = {
        id: `demo-${Date.now()}`,
        deviceId: "SMARTCONTOUR-001",
        timestamp: Date.now(),
        serverTimestamp: new Date().toISOString(),
        sensors,
        source: "demo",
      };
      setReading(fake);
      setAnalysis(next);
      setHistory((h) => [...h.slice(-240), fake]);
      if (next.hotspots.length) {
        setRecommendations([
          {
            id: `demo-rec-${Date.now()}`,
            zone: next.highestPressureZone.zone,
            current: next.highestPressureZone.value,
            peak: next.highestPressureZone.value,
            average: next.highestPressureZone.value,
            message:
              "Consider additional soft cushioning in the corresponding socket region and reassess pressure after fitting.",
            disclaimer: "Demo Mode — not stored in Firestore.",
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    }, 900);
    return () => clearInterval(id);
  }, [mode, thresholds]);

  const live = mode === "live" && Boolean(reading) && reading.source !== "demo";

  const activeSession = useMemo(
    () => sessions.find((s) => s.status === "active") || sessions[0] || null,
    [sessions]
  );

  return {
    mode,
    setMode,
    backendOk,
    wsOk,
    device,
    thresholds,
    reading,
    analysis,
    recommendations,
    history,
    sessions,
    patients,
    activeSession,
    error,
    live,
    refreshSessions: async () => {
      const sess = await api.sessions();
      setSessions(sess.sessions || []);
    },
    refreshPatients: async () => {
      const pats = await api.patients();
      setPatients(pats.patients || []);
    },
  };
}
