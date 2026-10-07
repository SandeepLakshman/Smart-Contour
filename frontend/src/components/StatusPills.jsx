export function ConnectionPill({ ok, label, detail }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`h-2.5 w-2.5 rounded-full ${ok ? "bg-[#3F7A45] pulse-live" : "bg-[#A65D45]"}`} />
      <div>
        <p className="leading-tight">{label}</p>
        {detail && <p className="text-[11px] text-muted leading-tight">{detail}</p>}
      </div>
    </div>
  );
}

export function EmptyState({ title, body }) {
  return (
    <div className="glass rounded-3xl p-10 text-center">
      <p className="font-display text-2xl text-deep">{title}</p>
      <p className="text-muted mt-2 max-w-md mx-auto">{body}</p>
    </div>
  );
}

export function ErrorState({ title, body }) {
  return (
    <div className="rounded-3xl border border-[#A65D45]/30 bg-[#F8E8E0] p-6">
      <p className="font-semibold text-terra">{title}</p>
      <p className="text-sm text-muted mt-1">{body}</p>
    </div>
  );
}

export function LoadingState({ label = "Loading" }) {
  return (
    <div className="glass rounded-3xl p-10 text-center text-muted animate-pulse">{label}…</div>
  );
}
