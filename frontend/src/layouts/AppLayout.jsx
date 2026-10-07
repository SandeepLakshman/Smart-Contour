import { NavLink, Outlet } from "react-router-dom";
import {
  Activity,
  Bell,
  ClipboardList,
  Cpu,
  LayoutDashboard,
  Settings,
  Sparkles,
  Users,
  FileText,
  Waves,
  UserCheck,
} from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import { useApp } from "../context/AppContext";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/patients", label: "Patients", icon: Users },
  { to: "/sessions", label: "Sessions", icon: ClipboardList },
  { to: "/analysis", label: "Pressure Analysis", icon: Waves },
  { to: "/recommendations", label: "Recommendations", icon: Activity },
  { to: "/ai", label: "AI Assistant", icon: Sparkles },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function AppLayout() {
  const { mode, setMode, device, backendOk, live, activeSession, error } = useApp();
  const connected = device?.connected && backendOk;

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-[272px] flex-col border-r border-brown/10 bg-[#efe4d3]/70 px-5 py-6 backdrop-blur-xl">
        <div className="px-2">
          <div className="font-display text-3xl font-bold tracking-tight text-deep">SmartContour</div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.22em] text-terracotta font-semibold">
            Pressure · Contour · Fit
          </div>
          <span className="inline-block mt-2 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
            Prototype Research System
          </span>
        </div>

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition ${
                  isActive ? "bg-white/80 text-deep shadow-sm" : "text-brown/75 hover:bg-white/40"
                }`
              }
            >
              <link.icon size={18} />
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="glass rounded-2xl p-4 space-y-2">
          <StatusBadge
            ok={connected}
            label={connected ? "ESP32 Connected" : "ESP32 Offline"}
            sub={device?.deviceId || "SMARTCONTOUR-001"}
          />
          <div className="text-[10px] text-stone-500 font-medium">
            FSR1 (GPIO 34) · FSR2 (GPIO 35)
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-brown/10 px-8 py-4 bg-[#F7F1E8]/60 backdrop-blur-md">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-terracotta font-bold">
              Clinical Fitting Workspace
            </div>
            <div className="font-display text-2xl font-bold text-deep mt-0.5">
              {activeSession ? activeSession.patientName : "Sandeep Lakshman (Demo Patient)"}
            </div>
            <div className="text-[11px] text-stone-500 italic">
              Prototype Engineering Demonstration · Not an Official Medical Record
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMode(mode === "demo" ? "live" : "demo")}
              className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                mode === "demo" ? "bg-terracotta text-ivory shadow-sm" : "bg-white/80 text-brown border border-[#3A2921]/15"
              }`}
            >
              {mode === "demo" ? "Demo Mode" : "Live Mode"}
            </button>

            <StatusBadge
              ok={backendOk && (live || mode === "demo")}
              label={backendOk ? (live ? "Live Stream" : "Waiting Stream") : "Backend Offline"}
            />

            {/* Clinician Identity - Dr. Priya Sharma · Demo Clinician */}
            <div className="flex items-center gap-2 rounded-full bg-white/80 border border-[#3A2921]/15 px-3.5 py-1.5 shadow-sm">
              <UserCheck size={16} className="text-terracotta" />
              <div>
                <span className="text-xs font-bold text-deep block leading-tight">Dr. Priya Sharma</span>
                <span className="text-[9px] uppercase tracking-wider text-amber-800 font-bold block">Demo Clinician</span>
              </div>
            </div>
          </div>
        </header>

        {error && mode === "live" && (
          <div className="mx-8 mt-4 rounded-2xl border border-terracotta/30 bg-terracotta/10 px-4 py-2 text-sm text-terracotta font-medium">
            {error}
          </div>
        )}

        <main className="flex-1 px-8 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
