import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Lock, Mail, User, X, CheckCircle, Shield } from "lucide-react";

export default function AuthModal({ isOpen, onClose }) {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (isRegister) {
        await register(email, password, displayName);
      } else {
        await login(email, password);
      }
      onClose();
    } catch (err) {
      setError(err?.message || "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  function handleDemoLogin() {
    setEmail("priya.sharma@smartcontour.demo");
    setPassword("SmartContour2026!");
    setIsRegister(false);
    setError("");
    setBusy(true);
    login("priya.sharma@smartcontour.demo", "SmartContour2026!")
      .then(() => onClose())
      .catch((err) => setError(err.message))
      .finally(() => setBusy(false));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass relative w-full max-w-md rounded-[2rem] p-8 shadow-2xl border border-white/60 bg-[#F7F1E8]/95">
        <button
          onClick={onClose}
          type="button"
          className="absolute right-5 top-5 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 transition"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 rounded-xl bg-terracotta/10 text-terracotta">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold text-deep">
              {isRegister ? "Clinician Registration" : "Clinician Sign In"}
            </h2>
            <p className="text-xs text-stone-600">
              {isRegister
                ? "Register a verified fitting clinician account"
                : "Sign in to access patient fitting records & sessions"}
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
            {error}
          </div>
        )}

        {/* Demo Fast Login Banner (Development / Staging Only) */}
        {(!import.meta.env.PROD || import.meta.env.VITE_ALLOW_DEMO === "true") && (
          <div className="mt-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-900 flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-amber-700" />
                Demo Clinician Account (Development)
              </span>
              <span className="text-[10px] uppercase font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                Quick Access
              </span>
            </div>
            <p className="text-[11px] text-amber-950/80 leading-relaxed">
              Instant 1-click access as <strong>Dr. Priya Sharma · Demo Clinician</strong>.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={handleDemoLogin}
              className="w-full py-2 px-3 rounded-xl bg-amber-800 hover:bg-amber-900 text-ivory font-semibold text-xs transition shadow-sm"
            >
              Sign in as Dr. Priya Sharma
            </button>
          </div>
        )}

        <div className="relative my-5 text-center text-xs text-stone-400">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-stone-300/60" />
          </div>
          <span className="relative px-3 bg-[#F7F1E8] uppercase tracking-wider font-bold text-[10px]">
            Or use email credentials
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {isRegister && (
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 h-4 w-4 text-stone-400" />
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Dr. Alex Morgan"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-brown/15 bg-white text-sm text-deep focus:outline-none focus:ring-2 focus:ring-terracotta"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              Clinician Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 h-4 w-4 text-stone-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="clinician@hospital.org"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-brown/15 bg-white text-sm text-deep focus:outline-none focus:ring-2 focus:ring-terracotta"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 h-4 w-4 text-stone-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-brown/15 bg-white text-sm text-deep focus:outline-none focus:ring-2 focus:ring-terracotta"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-deep hover:bg-[#241914] text-ivory font-bold text-sm tracking-wide transition shadow-md disabled:opacity-60"
          >
            {busy ? "Processing..." : isRegister ? "Create Clinician Account" : "Sign In to Workspace"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
            }}
            className="text-xs text-terracotta hover:underline font-semibold"
          >
            {isRegister
              ? "Already have an account? Sign in"
              : "Need a new account? Register clinician profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
