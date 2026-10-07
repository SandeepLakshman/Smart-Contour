import { useState } from "react";
import { api } from "../services/api";
import { useApp } from "../context/AppContext";
import EmptyState from "../components/EmptyState";

export default function Patients() {
  const { patients, refreshPatients, error, backendOk } = useApp();
  const [form, setForm] = useState({ name: "", age: "", notes: "" });
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setLocalError("");
    try {
      await api.createPatient(form);
      setForm({ name: "", age: "", notes: "" });
      await refreshPatients();
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!selected) return;
    setBusy(true);
    try {
      await api.updatePatient(selected.id, selected);
      await refreshPatients();
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-7 space-y-4">
        <h1 className="font-display text-4xl">Patients</h1>
        <p className="text-sm text-brown/70">Only fitting identifiers. No extra medical records.</p>
        {!backendOk && <EmptyState title="Backend connection error" body={error} />}
        {!patients.length ? (
          <EmptyState title="No patients yet" body="Add a patient to start a fitting session." />
        ) : (
          patients.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(p)}
              className="glass w-full rounded-3xl p-5 text-left"
            >
              <div className="font-display text-2xl">{p.name}</div>
              <div className="mt-1 text-sm text-brown/60">
                {p.id} · Age {p.age ?? "—"} · {new Date(p.createdAt).toLocaleString()}
              </div>
              {p.notes && <p className="mt-2 text-sm">{p.notes}</p>}
            </button>
          ))
        )}
      </div>
      <div className="col-span-5 space-y-4">
        <form onSubmit={create} className="glass rounded-[2rem] p-6 space-y-3">
          <h2 className="font-display text-2xl">Add patient</h2>
          <Field label="Patient name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="Age" value={form.age} onChange={(v) => setForm({ ...form, age: v })} />
          <Field label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
          {localError && <p className="text-sm text-terracotta">{localError}</p>}
          <button disabled={busy} className="rounded-full bg-deep px-5 py-2 text-sm text-ivory">
            {busy ? "Saving…" : "Add patient"}
          </button>
        </form>
        {selected && (
          <div className="glass rounded-[2rem] p-6 space-y-3">
            <h2 className="font-display text-2xl">Edit patient</h2>
            <div className="text-xs uppercase tracking-widest text-brown/50">{selected.id}</div>
            <Field label="Patient name" value={selected.name} onChange={(v) => setSelected({ ...selected, name: v })} />
            <Field label="Age" value={selected.age ?? ""} onChange={(v) => setSelected({ ...selected, age: v })} />
            <Field label="Notes" value={selected.notes} onChange={(v) => setSelected({ ...selected, notes: v })} />
            <button type="button" onClick={save} className="rounded-full bg-terracotta px-5 py-2 text-sm text-ivory">
              Save changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <label className="block text-sm">
      <span className="text-brown/60">{label}</span>
      <input
        className="mt-1 w-full rounded-2xl border border-brown/10 bg-white/70 px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
