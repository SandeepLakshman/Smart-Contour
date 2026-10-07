import { listRecommendations } from "../services/store.js";

export async function getRecommendations(req, res) {
  const recommendations = await listRecommendations({ sessionId: req.query.sessionId });
  return res.json({ success: true, recommendations });
}
