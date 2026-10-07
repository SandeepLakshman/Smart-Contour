import { useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { api } from "../services/api.js";
import { SENSOR_META, classify, severityTone } from "../utils/pressure.js";
import {
  BookOpen,
  CheckCircle,
  FileText,
  HelpCircle,
  Send,
  Sparkles,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";

const SUGGESTIONS = [
  "Why is Zone 1 displaying high pressure?",
  "What soft insert cushioning is recommended for the popliteal fossa?",
  "Explain the residual-limb socket pressure guidelines for distal apex contact.",
  "What are the prototype thresholds and why are they not clinical limits?",
  "What material should be used for prosthetic socket relief pads?",
];

export default function Assistant() {
  const { reading, activeSession, thresholds, mode } = useApp();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);

  async function send(q) {
    const text = (q || question).trim();
    if (!text) return;
    setQuestion("");
    setMessages((m) => [...m, { role: "user", text }]);
    setBusy(true);

    try {
      const res = await api.chat({
        sessionId: activeSession?.sessionId || activeSession?.id,
        question: text,
      });
      setMessages((m) => [...m, { role: "assistant", ...res }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          answer: err?.message || "Failed to reach AI assistant service.",
          error: true,
          sources: [],
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-[1.5fr_0.9fr] gap-6 min-h-[76vh]">
      {/* Main RAG Chat Interface */}
      <div className="glass rounded-[2rem] p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-[#3A2921]/10">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-terracotta" />
                <h1 className="font-display text-3xl font-bold text-deep">SmartContour True RAG Assistant</h1>
              </div>
              <p className="text-xs text-stone-600 mt-0.5">
                Grounded document retrieval architecture · Powered by Gemini 3.8 + Local Prosthetic Knowledge Index
              </p>
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
              Zero-Hallucination Mode
            </span>
          </div>

          {/* RAG Pipeline Status Banner */}
          <div className="mt-3 flex items-center justify-between px-3 py-1.5 rounded-xl bg-ivory/80 border border-[#3A2921]/10 text-xs text-[#3A2921]">
            <span className="flex items-center gap-1.5 font-medium">
              <BookOpen className="h-3.5 w-3.5 text-copper" />
              RAG Pipeline: User Question → Dense Semantic Search → Retrieved Context Chunks → Grounded Gemini Answer
            </span>
          </div>

          {/* Conversation Stream */}
          <div className="mt-4 max-h-[50vh] overflow-y-auto space-y-4 pr-1 scrollbar-thin">
            {messages.length === 0 && (
              <div className="py-6 space-y-3">
                <p className="text-xs uppercase font-bold tracking-widest text-[#3A2921]/60">
                  Select a clinical engineering prompt or type below:
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="text-xs rounded-2xl border border-[#3A2921]/15 px-3 py-2 bg-white/70 hover:bg-white hover:border-terracotta text-left text-deep transition shadow-sm"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl bg-[#3A2921] text-[#F7F1E8] px-4 py-3 shadow-md text-sm">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={i} className="rounded-2xl bg-white/90 border border-[#3A2921]/15 p-4 shadow-sm space-y-3">
                  {/* Grounded Answer */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-terracotta">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Grounded Answer</span>
                    </div>
                    <p className="text-sm leading-relaxed text-[#241914] font-medium">{m.answer}</p>
                  </div>

                  {/* Clinical Rationale */}
                  {m.reasoning && (
                    <div className="rounded-xl bg-[#FAF6F0] p-3 text-xs space-y-1 border border-[#3A2921]/10">
                      <p className="font-bold text-[#3A2921] uppercase tracking-wider text-[10px]">
                        Engineering Reasoning
                      </p>
                      <p className="text-[#3A2921]/80 leading-relaxed">{m.reasoning}</p>
                    </div>
                  )}

                  {/* Soft Insert Contouring Recommendation */}
                  {m.recommendation && (
                    <div className="rounded-xl bg-amber-50/90 border border-amber-200 p-3 text-xs space-y-1">
                      <p className="font-bold text-amber-900 uppercase tracking-wider text-[10px]">
                        Soft Insert Guidance
                      </p>
                      <p className="text-amber-950 leading-relaxed">{m.recommendation}</p>
                    </div>
                  )}

                  {/* Retrieved Evidence Sources */}
                  {m.sources && m.sources.length > 0 ? (
                    <div className="pt-2 border-t border-stone-200">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1.5 flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        Retrieved Knowledge Sources ({m.sources.length})
                      </p>
                      <div className="space-y-1.5">
                        {m.sources.map((src, idx) => (
                          <div
                            key={idx}
                            className="rounded-lg bg-stone-50 border border-stone-200 p-2 text-xs flex items-start justify-between gap-2"
                          >
                            <div>
                              <span className="font-semibold text-deep block">{src.source}</span>
                              {src.snippet && <span className="text-[11px] text-stone-600 italic block mt-0.5">{src.snippet}</span>}
                            </div>
                            <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded shrink-0">
                              {Math.round(src.score * 100)}% match
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : m.evidenceFound === false ? (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-900 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                      <span>No matching documents met the retrieval threshold in the local knowledge base.</span>
                    </div>
                  ) : null}
                </div>
              )
            )}

            {busy && (
              <div className="flex items-center gap-2 text-xs text-terracotta font-medium animate-pulse py-2">
                <Sparkles className="h-4 w-4 animate-spin" />
                <span>Searching vector embeddings and generating grounded response…</span>
              </div>
            )}
          </div>
        </div>

        {/* Question Input Box */}
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={busy}
            placeholder="Ask about socket hotspots, pressure mapping, or soft-insert contouring…"
            className="flex-1 rounded-2xl bg-white border border-[#3A2921]/15 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta"
          />
          <button
            type="submit"
            disabled={busy || !question.trim()}
            className="rounded-2xl bg-[#3A2921] hover:bg-[#241914] text-[#F7F1E8] px-5 py-3 font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <span>Ask RAG</span>
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>

      {/* Live Context & Sensor Telemetry Sidebar */}
      <aside className="glass rounded-[2rem] p-6 space-y-5">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Live Context Feed</span>
          <h2 className="font-display text-2xl font-bold text-deep mt-0.5">Sensor Telemetry</h2>
          <p className="text-xs text-stone-600">Real-time values streamed into the RAG context</p>
        </div>

        {/* Current Active Session */}
        <div className="rounded-2xl bg-white/80 p-3.5 border border-[#3A2921]/10 space-y-1">
          <span className="text-[10px] uppercase font-bold text-stone-400">Active Session</span>
          <p className="font-mono text-xs font-semibold text-deep truncate">
            {activeSession?.patientName ? `${activeSession.patientName} (${activeSession.id?.slice(0, 8)})` : "Live Unsaved Buffer"}
          </p>
          <span className="text-[10px] text-stone-500">
            {mode === "demo" ? "DEMO MODE (Simulated)" : "ESP32 HARDWARE STREAM"}
          </span>
        </div>

        {/* Live Zones Grid */}
        <div className="space-y-2">
          {SENSOR_META.map((meta) => {
            const v = reading?.sensors?.[meta.key];
            const sev = classify(v, thresholds);
            const tone = severityTone(sev);
            return (
              <div
                key={meta.key}
                style={{ backgroundColor: tone.bg, borderColor: tone.border }}
                className="flex items-center justify-between rounded-2xl p-3 border"
              >
                <div>
                  <p className="text-xs font-bold text-deep">{meta.name}</p>
                  <p className="text-[10px] text-stone-500">{meta.gpio} · {meta.region}</p>
                </div>
                <div className="text-right">
                  <span className="text-base font-bold font-mono text-deep">{v ?? "—"}</span>
                  <span
                    className="block text-[10px] font-bold uppercase px-1.5 py-0.2 rounded"
                    style={{ color: tone.text }}
                  >
                    {sev}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Knowledge Base Info */}
        <div className="rounded-2xl bg-[#3A2921] text-[#F7F1E8] p-4 space-y-2 shadow-md">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-copper">
            <BookOpen className="h-4 w-4" />
            <span>Ingested Clinical Papers</span>
          </div>
          <ul className="text-[11px] text-[#F7F1E8]/80 space-y-1 list-disc pl-4">
            <li>prosthetic-socket-pressure-overview.md</li>
            <li>socket-pressure-mapping.md</li>
            <li>soft-insert-contouring.md</li>
            <li>cushioning-and-refit.md</li>
            <li>fsr-hardware-and-session-quality.md</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
