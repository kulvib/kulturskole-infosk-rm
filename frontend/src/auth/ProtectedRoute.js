import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./authcontext";

/**
 * ProtectedRoute beskytter routes mod ikke-indloggede brugere.
 * Validerer token mod backend ved første indlæsning.
 */
export default function ProtectedRoute({ children }) {
  const { token, logoutUser } = useAuth();
  const [valid, setValid] = useState(null); // null = tjekker stadig

  useEffect(() => {
    if (!token) {
      setValid(false);
      return;
    }

    // Valider token mod backend
    fetch("/api/clients/me", {
      headers: { Authorization: `Bearer ${token}` }
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
        // Netværksfejl — lad brugeren forsøge, backend vil afvise hvis token er ugyldigt
        setValid(true);
      });
  }, [token, logoutUser]);

  // Ikke logget ind
  if (!token) return <Navigate to="/login" replace />;

  // Venter på svar fra backend
  if (valid === null) return null;

  // Token ugyldigt
  if (!valid) return <Navigate to="/login" replace />;

  return children;
}
