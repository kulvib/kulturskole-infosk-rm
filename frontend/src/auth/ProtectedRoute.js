import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./authcontext";

/**
 * ProtectedRoute beskytter routes, så kun brugere med token får adgang.
 * Den viser children, hvis man er logget ind.
 */
export default function ProtectedRoute({ children }) {
  const { token } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
