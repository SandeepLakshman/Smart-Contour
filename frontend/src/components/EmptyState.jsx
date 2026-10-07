export default function EmptyState({ title, body }) {
  return (
    <div className="glass rounded-3xl p-10 text-center">
      <h3 className="font-display text-2xl text-deep">{title}</h3>
      <p className="mt-2 text-sm text-brown/70">{body}</p>
    </div>
  );
}
