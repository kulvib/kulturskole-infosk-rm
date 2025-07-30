import { createContext, useContext, useState } from "react";

// Midlertidigt hardcoded token til integration uden login
const FAKE_TOKEN = "PASTE_YOUR_JWT_TOKEN_HERE";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token] = useState(FAKE_TOKEN); // Brug evt. hardcoded token indtil login genindføres
  return (
    <AuthContext.Provider value={{ token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
