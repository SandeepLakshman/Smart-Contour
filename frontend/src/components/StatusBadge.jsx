export default function StatusBadge({ ok, label, sub }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-700 pulse-dot" : "bg-stone-400"}`} />
      <div>
        <div className="font-medium text-deep">{label}</div>
        {sub && <div className="text-[11px] uppercase tracking-widest text-brown/60">{sub}</div>}
      </div>
    </div>
  );
}
