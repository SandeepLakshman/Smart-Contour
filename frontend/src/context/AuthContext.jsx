import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("smartcontour_token") : null));
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    async function initUser() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.me();
        if (res?.user) {
          setUser(res.user);
        } else {
          logout();
        }
      } catch {
        // Fall back to cached user or prompt login
        logout();
      } finally {
        setLoading(false);
      }
    }
    initUser();
  }, [token]);

  async function login(email, password) {
    const res = await api.login({ email, password });
    if (res?.token && res?.user) {
      localStorage.setItem("smartcontour_token", res.token);
      setToken(res.token);
      setUser(res.user);
      setShowAuthModal(false);
      return res.user;
    }
    throw new Error(res?.error || "Login failed");
  }

  async function register(email, password, displayName, role) {
    const res = await api.register({ email, password, displayName, role });
    if (res?.token && res?.user) {
      localStorage.setItem("smartcontour_token", res.token);
      setToken(res.token);
      setUser(res.user);
      setShowAuthModal(false);
      return res.user;
    }
    throw new Error(res?.error || "Registration failed");
  }

  function logout() {
    localStorage.removeItem("smartcontour_token");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: Boolean(user),
        login,
        register,
        logout,
        showAuthModal,
        setShowAuthModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
