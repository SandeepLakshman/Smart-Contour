import { useAuth } from "../context/AuthContext";
import { Lock, ShieldAlert } from "lucide-react";

export default function ProtectedRoute({ children, title = "Clinical Fitting Records Protected" }) {
  const { isAuthenticated, loading, setShowAuthModal } = useAuth();

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm font-medium text-stone-500 animate-pulse">
          Verifying clinician authorization...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="glass rounded-[2rem] p-12 text-center max-w-xl mx-auto my-12 border border-white/60 space-y-4">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h2 className="font-display text-2xl font-bold text-deep">{title}</h2>
        <p className="text-sm text-stone-600 leading-relaxed">
          Access to individual patient biometric fitting history and session records requires authenticated clinician credentials.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowAuthModal(true)}
            className="inline-flex items-center gap-2 py-3 px-6 rounded-2xl bg-deep hover:bg-[#241914] text-ivory font-bold text-sm transition shadow-md"
          >
            <Lock className="h-4 w-4 text-terracotta" />
            Sign In with Clinician Account
          </button>
        </div>
      </div>
    );
  }

  return children;
}
