const API =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? "https://smart-contour.onrender.com"
    : "http://localhost:5000");

async function request(path, options = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("smartcontour_token") : null;
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...authHeader, ...(options.headers || {}) },
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
  // Authentication
  login: (credentials) => request("/api/auth/login", { method: "POST", body: JSON.stringify(credentials) }),
  register: (data) => request("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),
  me: () => request("/api/auth/me"),
  logout: () => request("/api/auth/logout", { method: "POST" }),

  // System
  health: () => request("/api/health"),
  settings: () => request("/api/settings"),
  updateSettings: (body) => request("/api/settings", { method: "PATCH", body: JSON.stringify(body) }),
  updateThresholds: (body) => request("/api/settings", { method: "PATCH", body: JSON.stringify({ thresholds: body }) }),

  // Telemetry (Patient & Session Aware)
  latest: (params) => {
    const q = new URLSearchParams();
    if (typeof params === "string") q.set("sessionId", params);
    else if (params && typeof params === "object") {
      if (params.sessionId) q.set("sessionId", params.sessionId);
      if (params.patientId) q.set("patientId", params.patientId);
    }
    const qs = q.toString();
    return request(`/api/sensor-data/latest${qs ? `?${qs}` : ""}`);
  },
  history: (params = 100) => {
    const q = new URLSearchParams();
    if (typeof params === "number") q.set("limit", params);
    else if (params && typeof params === "object") {
      if (params.limit) q.set("limit", params.limit);
      if (params.sessionId) q.set("sessionId", params.sessionId);
      if (params.patientId) q.set("patientId", params.patientId);
    }
    const qs = q.toString();
    return request(`/api/sensor-data/history${qs ? `?${qs}` : ""}`);
  },

  // Patients
  patients: () => request("/api/patients"),
  createPatient: (body) => request("/api/patients", { method: "POST", body: JSON.stringify(body) }),
  patient: (id) => request(`/api/patients/${id}`),
  updatePatient: (id, body) => request(`/api/patients/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  // Sessions
  sessions: (params) => {
    const q = new URLSearchParams();
    if (typeof params === "string") q.set("patientId", params);
    else if (params?.patientId) q.set("patientId", params.patientId);
    const qs = q.toString();
    return request(`/api/sessions${qs ? `?${qs}` : ""}`);
  },
  createSession: (body) => request("/api/sessions", { method: "POST", body: JSON.stringify(body) }),
  session: (id) => request(`/api/sessions/${id}`),
  activateSession: (id) => request(`/api/sessions/${id}/activate`, { method: "POST" }),
  endSession: (id) => request(`/api/sessions/${id}/end`, { method: "POST" }),
  sessionReadings: (id) => request(`/api/sessions/${id}/readings`),

  // Recommendations (Isolated)
  recommendations: (params) => {
    const q = new URLSearchParams();
    if (typeof params === "string") q.set("sessionId", params);
    else if (params && typeof params === "object") {
      if (params.sessionId) q.set("sessionId", params.sessionId);
      if (params.patientId) q.set("patientId", params.patientId);
    }
    const qs = q.toString();
    return request(`/api/recommendations${qs ? `?${qs}` : ""}`);
  },

  // RAG AI Assistant
  chat: (body) => request("/api/ai/chat", { method: "POST", body: JSON.stringify(body) }),

  // Reports
  reports: (params) => {
    const q = new URLSearchParams();
    if (params && typeof params === "object") {
      if (params.sessionId) q.set("sessionId", params.sessionId);
      if (params.patientId) q.set("patientId", params.patientId);
    }
    const qs = q.toString();
    return request(`/api/reports${qs ? `?${qs}` : ""}`);
  },
  generateReport: (body) =>
    request("/api/reports", {
      method: "POST",
      body: JSON.stringify(typeof body === "string" ? { sessionId: body } : body),
    }),
  previewReport: (id) => request(`/api/reports/${id}`),
  report: (id) => request(`/api/reports/${id}`),
  reportPdfUrl: (id) => `${API}/api/reports/${id}/pdf`,
  downloadUrl: (idOrFilename) => `${API}/api/reports/${idOrFilename}/pdf`,
};
