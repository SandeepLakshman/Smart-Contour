import { Router } from "express";
import { readSettings, updateSettings } from "../controllers/settingsController.js";

const router = Router();
router.get("/", readSettings);
router.patch("/", updateSettings);
export default router;
