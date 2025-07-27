import React, { createContext, useContext, useState, useEffect } from "react";
import { setAuthToken } from "../api/api";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // Ved mount: Hent token fra localStorage og sæt axios-header
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setAuthToken(token);
      setUser({ token });
    }
  }, []);

  // Login: Gem token og sæt header
  const login = (token) => {
    localStorage.setItem("token", token);
    setAuthToken(token);
    setUser({ token });
  };

  // Logout: Slet token og header
  const logout = () => {
    localStorage.removeItem("token");
    setAuthToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
