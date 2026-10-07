import http from "http";
import express from "express";
import cors from "cors";
import { config, credentialStatus } from "./config.js";
import { initFirebase } from "./firebase/admin.js";
import { initRealtime } from "./services/realtime.js";
import { loadKnowledgeIndex } from "./rag/retrieval/retrieve.js";
import healthRouter from "./routes/health.js";
import sensorRouter from "./routes/sensorData.js";
import patientsRouter from "./routes/patients.js";
import sessionsRouter from "./routes/sessions.js";
import recommendationsRouter from "./routes/recommendations.js";
import aiRouter from "./routes/ai.js";
import reportsRouter from "./routes/reports.js";
import settingsRouter from "./routes/settings.js";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "5mb" }));

app.use("/api/health", healthRouter);
app.use("/api/sensor-data", sensorRouter);
app.use("/api/patients", patientsRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/recommendations", recommendationsRouter);
app.use("/api/ai", aiRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/settings", settingsRouter);

app.use((req, res) => {
  res.status(404).json({ success: false, error: `Unknown route ${req.method} ${req.path}` });
});

const server = http.createServer(app);
initRealtime(server);

const firebase = initFirebase();
const creds = credentialStatus();

loadKnowledgeIndex()
  .then((info) => {
    console.log(`SmartContour knowledge index: ${info.documents} documents, ${info.chunks} chunks`);
  })
  .catch((err) => {
    console.log("SmartContour knowledge index warning:", err?.message);
  });

server.listen(config.port, "0.0.0.0", () => {
  console.log(`SmartContour API listening on 0.0.0.0:${config.port} (LAN accessible for ESP32)`);
  console.log(`Firebase: ${firebase.available ? "connected" : "not configured"}`);
  console.log(`Gemini: ${creds.gemini ? "configured" : "not configured"}`);
});
