import { useState } from "react";
import { api } from "../services/api";
import { useApp } from "../context/AppContext";
import EmptyState from "../components/EmptyState";

export default function Patients() {
  const { patients, refreshPatients, selectedPatientId, selectPatient, error, backendOk } = useApp();
  const [form, setForm] = useState({ name: "", age: "", notes: "" });
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  function validate(data) {
    if (!data.name || typeof data.name !== "string" || data.name.trim().length < 2) {
      return "Patient name must be at least 2 characters.";
    }
    if (data.age !== "" && data.age !== undefined && data.age !== null) {
      const parsedAge = Number(data.age);
      if (!Number.isInteger(parsedAge) || parsedAge < 0 || parsedAge > 125) {
        return "Age must be an integer between 0 and 125.";
      }
    }
    return null;
  }

  async function create(e, forceDuplicate = false) {
    if (e && e.preventDefault) e.preventDefault();
    setLocalError("");
    const validationError = validate(form);
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        age: form.age === "" ? null : Number(form.age),
        notes: form.notes,
        confirmDuplicate: forceDuplicate,
      };
      await api.createPatient(payload);
      setForm({ name: "", age: "", notes: "" });
      setDuplicateWarning(null);
      await refreshPatients();
    } catch (err) {
      if (err.data?.isDuplicateWarning) {
        setDuplicateWarning(err.data.error || "A patient with this name already exists.");
      } else {
        setLocalError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!selected) return;
    setLocalError("");
    const validationError = validate(selected);
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    setBusy(true);
    try {
      await api.updatePatient(selected.id, {
        name: selected.name.trim(),
        age: selected.age === "" || selected.age === null ? null : Number(selected.age),
        notes: selected.notes,
      });
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
          patients.map((p) => {
            const isSelected = selectedPatientId === p.id;
            return (
              <div
                key={p.id}
                className={`glass w-full rounded-3xl p-5 text-left transition border ${
                  isSelected ? "border-terracotta bg-white/90 shadow-md ring-1 ring-terracotta" : "border-brown/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-display text-2xl">{p.name}</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => selectPatient(p.id)}
                      className={`text-xs font-semibold px-3 py-1 rounded-full transition ${
                        isSelected
                          ? "bg-terracotta text-white"
                          : "bg-stone-100 hover:bg-stone-200 text-stone-700"
                      }`}
                    >
                      {isSelected ? "Active Patient" : "Select Patient"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelected(p)}
                      className="text-xs text-stone-500 hover:text-stone-800 underline px-1"
                    >
                      Edit
                    </button>
                  </div>
                </div>
                <div className="mt-1 text-sm text-brown/60">
                  {p.id} · Age {p.age ?? "—"} · {new Date(p.createdAt).toLocaleString()}
                </div>
                {p.notes && <p className="mt-2 text-sm">{p.notes}</p>}
              </div>
            );
          })
        )}
      </div>
      <div className="col-span-5 space-y-4">
        <form onSubmit={create} className="glass rounded-[2rem] p-6 space-y-3">
          <h2 className="font-display text-2xl">Add patient</h2>
          <Field label="Patient name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="Age" value={form.age} onChange={(v) => setForm({ ...form, age: v })} />
          <Field label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
          {duplicateWarning && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 space-y-2">
              <p className="font-semibold">{duplicateWarning}</p>
              <p>Are you sure you want to register another patient with the same name?</p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={(e) => create(e, true)}
                  className="rounded-full bg-amber-700 hover:bg-amber-800 text-white px-3 py-1 text-xs font-semibold"
                >
                  Yes, register patient
                </button>
                <button
                  type="button"
                  onClick={() => setDuplicateWarning(null)}
                  className="rounded-full bg-stone-200 hover:bg-stone-300 text-stone-800 px-3 py-1 text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
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
