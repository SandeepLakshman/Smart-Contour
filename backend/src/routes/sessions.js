import { Router } from "express";
import { createSession, endSession, getSessionById, getSessions } from "../controllers/sessionController.js";
import { getSessionReadings } from "../controllers/sensorController.js";

const router = Router();
router.get("/", getSessions);
router.post("/", createSession);
router.get("/:id", getSessionById);
router.post("/:id/end", endSession);
router.get("/:sessionId/readings", getSessionReadings);
export default router;
