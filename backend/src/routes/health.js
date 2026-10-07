import { Router } from "express";
import { credentialStatus } from "../config.js";
import { firebaseStatus, pingFirestore } from "../firebase/admin.js";
import { geminiStatus } from "../ai/gemini.js";
import { knowledgeStatus } from "../rag/retrieval/retrieve.js";
import { getDeviceStatus } from "../services/deviceStatus.js";
import { config } from "../config.js";

const router = Router();

router.get("/", async (_req, res) => {
  const creds = credentialStatus();
  const db = firebaseStatus();
  const ping = await pingFirestore();
  res.json({
    success: true,
    service: "SmartContour API",
    firebase: {
      configured: creds.firebase,
      available: db.available && ping.ok,
    },
    gemini: geminiStatus(),
    knowledge: knowledgeStatus(),
    device: getDeviceStatus(config.defaultDeviceId),
  });
});

export default router;
