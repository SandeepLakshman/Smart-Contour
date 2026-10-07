import { v4 as uuid } from "uuid";
import { addPatient, getPatient, listPatients, updatePatient } from "../services/store.js";

export async function createPatient(req, res) {
  const { name, age, notes } = req.body || {};
  if (!name || String(name).trim() === "") {
    return res.status(400).json({ success: false, error: "Patient name is required" });
  }
  const patient = {
    id: uuid(),
    name: String(name).trim(),
    age: age === undefined || age === "" ? null : Number(age),
    notes: notes ? String(notes).slice(0, 500) : "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await addPatient(patient);
  return res.status(201).json({ success: true, patient });
}

export async function getPatients(_req, res) {
  const patients = await listPatients();
  return res.json({ success: true, patients });
}

export async function getPatientById(req, res) {
  const patient = await getPatient(req.params.id);
  if (!patient) return res.status(404).json({ success: false, error: "Patient not found" });
  return res.json({ success: true, patient });
}

export async function patchPatient(req, res) {
  const allowed = {};
  if (req.body.name !== undefined) allowed.name = String(req.body.name).trim();
  if (req.body.age !== undefined) allowed.age = req.body.age === "" ? null : Number(req.body.age);
  if (req.body.notes !== undefined) allowed.notes = String(req.body.notes).slice(0, 500);
  const patient = await updatePatient(req.params.id, allowed);
  if (!patient) return res.status(404).json({ success: false, error: "Patient not found" });
  return res.json({ success: true, patient });
}
