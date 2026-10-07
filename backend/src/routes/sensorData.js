import { Router } from "express";
import {
  getLatestSensorData,
  getSensorHistory,
  getSessionReadings,
  ingestSensorData,
} from "../controllers/sensorController.js";

const router = Router();
router.post("/", ingestSensorData);
router.get("/latest", getLatestSensorData);
router.get("/history", getSensorHistory);
export default router;

export const sessionReadingsRouter = Router();
sessionReadingsRouter.get("/:sessionId/readings", getSessionReadings);
