import { Router } from "express";
import { createPatient, getPatientById, getPatients, patchPatient } from "../controllers/patientController.js";
import { requireAuth } from "../controllers/authController.js";

const router = Router();
router.use(requireAuth);
router.get("/", getPatients);
router.post("/", createPatient);
router.get("/:id", getPatientById);
router.patch("/:id", patchPatient);
export default router;
