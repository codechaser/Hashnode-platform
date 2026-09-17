import { createContext, useContext, useEffect, useState } from "react";
import api from "../services/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const clearSession = () => {
      api.setToken(null);
      if (active) {
        setUser(null);
      }
    };

    api.setUnauthorizedHandler(clearSession);

    async function restoreSession() {
      if (!api.getToken()) {
        if (active) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const response = await api.get("/api/auth/me");
        if (active) {
          const authUser = response?.data?.user || null;
          const profileResponse = await api.get("/api/users/me");
          setUser({ ...authUser, ...profileResponse?.data?.user });
        }
      } catch {
        clearSession();
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      active = false;
      api.setUnauthorizedHandler(null);
    };
  }, []);

  async function login(token, nextUser) {
    api.setToken(token);

    try {
      const profileResponse = await api.get("/api/users/me");
      setUser({ ...nextUser, ...profileResponse?.data?.user });
    } catch {
      setUser(nextUser || null);
    }
  }

  function logout() {
    api.setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}