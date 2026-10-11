import { v4 as uuid } from "uuid";
import { addPatient, getPatient, listPatients, updatePatient } from "../services/store.js";

export async function createPatient(req, res) {
  const { name, age, notes, confirmDuplicate } = req.body || {};
  const trimmedName = String(name || "").trim();
  if (!trimmedName || trimmedName.length < 2) {
    return res.status(400).json({ success: false, error: "Patient name must be at least 2 characters" });
  }

  let parsedAge = null;
  if (age !== undefined && age !== null && age !== "") {
    parsedAge = Number(age);
    if (!Number.isInteger(parsedAge) || parsedAge < 0 || parsedAge > 125) {
      return res.status(400).json({ success: false, error: "Age must be an integer between 0 and 125" });
    }
  }

  const clinicianId = req.user?.uid || "unassigned";

  // Check for duplicate patient name under the same clinician (case-normalized)
  const existingPatients = await listPatients({ clinicianId });
  const normalizedNewName = trimmedName.toLowerCase().replace(/\s+/g, " ");
  const duplicate = existingPatients.find(
    (p) => String(p.name || "").trim().toLowerCase().replace(/\s+/g, " ") === normalizedNewName
  );

  if (duplicate && !confirmDuplicate) {
    return res.status(409).json({
      success: false,
      isDuplicateWarning: true,
      error: `A patient named "${duplicate.name}" (ID: ${duplicate.id.slice(0, 8)}) is already registered in your clinic records.`,
      duplicatePatientId: duplicate.id,
    });
  }

  const patient = {
    id: uuid(),
    name: trimmedName,
    age: parsedAge,
    notes: notes ? String(notes).slice(0, 500) : "",
    clinicianId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await addPatient(patient);
  return res.status(201).json({ success: true, patient });
}

export async function getPatients(req, res) {
  const clinicianId = req.user?.uid;
  const patients = await listPatients({ clinicianId });
  return res.json({ success: true, patients });
}

export async function getPatientById(req, res) {
  const patient = await getPatient(req.params.id);
  if (!patient) return res.status(404).json({ success: false, error: "Patient not found" });
  if (patient.clinicianId && req.user?.uid && patient.clinicianId !== req.user.uid) {
    return res.status(403).json({ success: false, error: "Access denied to patient record" });
  }
  return res.json({ success: true, patient });
}

export async function patchPatient(req, res) {
  const existing = await getPatient(req.params.id);
  if (!existing) return res.status(404).json({ success: false, error: "Patient not found" });
  if (existing.clinicianId && req.user?.uid && existing.clinicianId !== req.user.uid) {
    return res.status(403).json({ success: false, error: "Access denied to patient record" });
  }

  const allowed = {};
  if (req.body.name !== undefined) allowed.name = String(req.body.name).trim();
  if (req.body.age !== undefined) allowed.age = req.body.age === "" ? null : Number(req.body.age);
  if (req.body.notes !== undefined) allowed.notes = String(req.body.notes).slice(0, 500);
  const patient = await updatePatient(req.params.id, allowed);
  return res.json({ success: true, patient });
}
