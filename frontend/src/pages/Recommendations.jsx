import { useApp } from "../context/AppContext";
import EmptyState from "../components/EmptyState";

export default function Recommendations() {
  const { recommendations, analysis } = useApp();
  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl">Soft insert recommendations</h1>
      <p className="max-w-2xl text-sm text-brown/70">
        Generated when a zone crosses the prototype HIGH threshold. Guidance is for fitting support, not diagnosis.
      </p>
      {!recommendations.length && (
        <EmptyState
          title="No cushioning alerts"
          body={
            analysis.hotspots?.length
              ? "A hotspot is visible, but no stored recommendation yet."
              : "High-pressure zones will appear here when they occur."
          }
        />
      )}
      {recommendations.map((r) => (
        <article key={r.id} className="glass rounded-[2rem] p-6">
          <div className="text-[11px] uppercase tracking-widest text-terracotta">{r.zone}</div>
          <h2 className="mt-1 font-display text-2xl">{r.title || "Soft insert contouring"}</h2>
          <p className="mt-3 text-deep">{r.message}</p>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div>Current {r.current}</div>
            <div>Peak {r.peak}</div>
            <div>Average {r.average}</div>
          </div>
          <p className="mt-3 text-xs text-brown/60">{r.disclaimer}</p>
        </article>
      ))}
    </div>
  );
}
