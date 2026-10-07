import { Router } from "express";
import { downloadReport, generateReport, getReports, previewReport } from "../controllers/reportController.js";

const router = Router();
router.get("/", getReports);
router.post("/", generateReport);
router.get("/:id", previewReport);
router.get("/:id/pdf", downloadReport);
export default router;
