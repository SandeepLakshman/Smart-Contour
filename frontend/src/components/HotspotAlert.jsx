export default function HotspotAlert({ hotspots, analysis }) {
  if (!hotspots?.length) return null;
  const h = hotspots[0];
  const a = analysis?.[h.sensor];
  return (
    <div className="rounded-3xl border border-[#A65D45]/35 bg-[#F8E8E0]/90 p-5 shadow-[0_16px_40px_rgba(166,93,69,0.12)]">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-2xl bg-[#A65D45] text-ivory flex items-center justify-center font-bold">
          !
        </div>
        <div className="flex-1">
          <p className="text-xs tracking-[0.2em] uppercase text-terra font-semibold">High-pressure hotspot</p>
          <h3 className="font-display text-2xl text-deep mt-1">
            {h.zone} is currently experiencing elevated pressure.
          </h3>
          <p className="text-sm text-muted mt-1">
            Prototype fitting-support alert — not a medical diagnosis.
          </p>
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="rounded-2xl bg-ivory/80 p-3">
              <p className="text-[11px] text-muted">Current</p>
              <p className="text-2xl font-semibold">{h.value}</p>
            </div>
            <div className="rounded-2xl bg-ivory/80 p-3">
              <p className="text-[11px] text-muted">Peak</p>
              <p className="text-2xl font-semibold">{h.peak ?? a?.peak ?? h.value}</p>
            </div>
            <div className="rounded-2xl bg-ivory/80 p-3">
              <p className="text-[11px] text-muted">Average</p>
              <p className="text-2xl font-semibold">{h.average ?? a?.average ?? "—"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
