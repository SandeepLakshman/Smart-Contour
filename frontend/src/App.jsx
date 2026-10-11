import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Patients from "./pages/Patients.jsx";
import Sessions from "./pages/Sessions.jsx";
import PressureAnalysis from "./pages/PressureAnalysis.jsx";
import Recommendations from "./pages/Recommendations.jsx";
import Assistant from "./pages/Assistant.jsx";
import Reports from "./pages/Reports.jsx";
import Settings from "./pages/Settings.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route
          path="/patients"
          element={
            <ProtectedRoute title="Patient Fitting Records Protected">
              <Patients />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sessions"
          element={
            <ProtectedRoute title="Fitting Sessions Protected">
              <Sessions />
            </ProtectedRoute>
          }
        />
        <Route path="/analysis" element={<PressureAnalysis />} />
        <Route path="/recommendations" element={<Recommendations />} />
        <Route path="/ai" element={<Assistant />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route
          path="/reports"
          element={
            <ProtectedRoute title="Clinical Fitting Reports Protected">
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
