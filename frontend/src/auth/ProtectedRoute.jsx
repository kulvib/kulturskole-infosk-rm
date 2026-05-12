// src/auth/ProtectedRoute.jsx
// Beskytter routes mod ikke-indloggede brugere.
// Validerer sessionen ved at kalde GET /auth/me med Bearer token (Safari-fix).
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./authcontext";
import { apiUrl } from "../api";

export default function ProtectedRoute({ children }) {
  const { user, logoutUser } = useAuth();
  const [valid, setValid] = useState(null); // null = tjekker stadig

  useEffect(() => {
    if (!user) {
      setValid(false);
      return;
    }

    // Byg headers med Bearer token hvis tilgængeligt (Safari-fix)
    const token = localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    fetch(`${apiUrl}/auth/me`, {
      headers,
      credentials: "include",
    })
      .then(res => {
        if (res.status === 401 || res.status === 403) {
          logoutUser();
          setValid(false);
        } else {
          setValid(true);
        }
      })
      .catch(() => {
        // Netværksfejl — lad brugeren fortsætte, backend afviser ugyldige tokens
        setValid(true);
      });
  }, [user, logoutUser]);

  if (!user) return <Navigate to="/login" replace />;
  if (valid === null) return null;
  if (!valid) return <Navigate to="/login" replace />;

  return children;
}
