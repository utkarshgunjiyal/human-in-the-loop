import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = unauth
  const [bootstrapping, setBootstrapping] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch (_) {
      setUser(null);
    } finally {
      setBootstrapping(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post("/login", { email, password });
    if (data?.access_token) localStorage.setItem("invoice_ai_token", data.access_token);
    setUser(data.user);
    return data.user;
  }, []);

  const signup = useCallback(async (payload) => {
    const { data } = await api.post("/signup", payload);
    if (data?.access_token) localStorage.setItem("invoice_ai_token", data.access_token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post("/logout"); } catch (_) {}
    localStorage.removeItem("invoice_ai_token");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, bootstrapping, login, signup, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
