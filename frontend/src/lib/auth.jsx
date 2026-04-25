import { createContext, useContext, useEffect, useState } from "react";
import { api, formatApiError } from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true); 

  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem("access_token");
        if (token) {
          const { data } = await api.get("/auth/me");
          setUser(data);
        } else {
          setUser(false);
        }
      } catch {
        setUser(false);
      } finally {
        setLoading(false); 
      }
    };
    initAuth();
  }, []);

  const login = async (email, password) => {
    setError("");
    try {
      const { data } = await api.post("/auth/login", { email, password }); 
      if (data.access_token) localStorage.setItem("access_token", data.access_token);
      setUser(data);
      return true;
    } catch (e) {
      setError(formatApiError(e.response?.data?.detail) || e.message);
      return false;
    } // Set error message if login fails
  };

  const register = async (name, email, password) => {
    setError("");
    try {
      const { data } = await api.post("/auth/register", { name, email, password }); // Send registration request
      if (data.access_token) localStorage.setItem("access_token", data.access_token);
      setUser(data);
      return true;
    } catch (e) {
      setError(formatApiError(e.response?.data?.detail) || e.message);
      return false;
    } // Set error message if registration fails
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {} // Attempt to log out on the backend
    localStorage.removeItem("access_token"); // Remove token from local storage
    setUser(false);
  };
  // Refreshes user data from the backend after an update
  const refreshUser = async () => {
    const { data } = await api.get("/auth/me");
    setUser(data);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, setUser, login, register, logout, error, refreshUser }}>
      {!loading && children} 
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);