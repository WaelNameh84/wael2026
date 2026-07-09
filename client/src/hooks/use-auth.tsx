import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { setAuthTokenGetter, setOnUnauthorized } from "@/lib/api-client/index";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "") ?? "";

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("auth_token"));
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const logout = (silent = false) => {
    const stored = localStorage.getItem("auth_token");
    localStorage.removeItem("auth_token");
    setToken(null);
    setAuthTokenGetter(() => null);
    queryClient.clear();
    if (!silent && stored) {
      fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${stored}` },
      }).catch(() => {});
    }
    setLocation("/login");
  };

  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem("auth_token"));
    setOnUnauthorized(() => {
      logout(true);
    });
    return () => {
      setOnUnauthorized(null);
    };
  }, []);

  const login = (newToken: string) => {
    localStorage.setItem("auth_token", newToken);
    setToken(newToken);
    setAuthTokenGetter(() => newToken);
  };

  return { token, login, logout: () => logout(false), isAuthenticated: !!token };
}
