import { Router } from "express";
import { createPatient, getPatientById, getPatients, patchPatient } from "../controllers/patientController.js";

const router = Router();
router.get("/", getPatients);
router.post("/", createPatient);
router.get("/:id", getPatientById);
router.patch("/:id", patchPatient);
export default router;
