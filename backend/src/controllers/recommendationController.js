import { listRecommendations } from "../services/store.js";

export async function getRecommendations(req, res) {
  const recommendations = await listRecommendations({
    sessionId: req.query.sessionId,
    patientId: req.query.patientId,
  });
  return res.json({ success: true, recommendations });
}
