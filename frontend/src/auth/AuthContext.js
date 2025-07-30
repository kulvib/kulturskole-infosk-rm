import { createContext, useContext, useState } from "react";

// Midlertidigt hardcoded token til integration uden login
const FAKE_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6MTk5OTk5OTk5OX0.Fu6qHK7byNQ_GcanaXyvyma_d4fq_hq-wJPFuWXhyks";

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
