const API =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? "https://smart-contour.onrender.com"
    : "http://localhost:5000");

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || "Request failed");
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const api = {
  health: () => request("/api/health"),
  settings: () => request("/api/settings"),
  updateSettings: (body) => request("/api/settings", { method: "PATCH", body: JSON.stringify(body) }),
  updateThresholds: (body) => request("/api/settings", { method: "PATCH", body: JSON.stringify({ thresholds: body }) }),
  latest: (sessionId) => request(`/api/sensor-data/latest${sessionId ? `?sessionId=${sessionId}` : ""}`),
  history: (limit = 100) => request(`/api/sensor-data/history?limit=${limit}`),
  patients: () => request("/api/patients"),
  createPatient: (body) => request("/api/patients", { method: "POST", body: JSON.stringify(body) }),
  patient: (id) => request(`/api/patients/${id}`),
  updatePatient: (id, body) => request(`/api/patients/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  sessions: () => request("/api/sessions"),
  createSession: (body) => request("/api/sessions", { method: "POST", body: JSON.stringify(body) }),
  session: (id) => request(`/api/sessions/${id}`),
  endSession: (id) => request(`/api/sessions/${id}/end`, { method: "POST" }),
  sessionReadings: (id) => request(`/api/sessions/${id}/readings`),
  recommendations: (sessionId) =>
    request(`/api/recommendations${sessionId ? `?sessionId=${sessionId}` : ""}`),
  chat: (body) => request("/api/ai/chat", { method: "POST", body: JSON.stringify(body) }),
  reports: () => request("/api/reports"),
  generateReport: (body) => request("/api/reports", { method: "POST", body: JSON.stringify(typeof body === "string" ? { sessionId: body } : body) }),
  previewReport: (id) => request(`/api/reports/${id}`),
  report: (id) => request(`/api/reports/${id}`),
  reportPdfUrl: (id) => `${API}/api/reports/${id}/pdf`,
  downloadUrl: (idOrFilename) => `${API}/api/reports/${idOrFilename}/pdf`,
};
