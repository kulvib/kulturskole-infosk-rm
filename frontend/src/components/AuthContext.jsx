import React, { createContext, useContext, useState } from "react";

const AuthContext = createContext();

// Custom hook for nem adgang
export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem("access_token") || "");

  // Login og logud helpers
  const login = (newToken) => {
    setToken(newToken);
    localStorage.setItem("access_token", newToken);
  };
  const logout = () => {
    setToken("");
    localStorage.removeItem("access_token");
  };

  return (
    <AuthContext.Provider value={{ token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
