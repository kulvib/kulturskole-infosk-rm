import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./authcontext";

/**
 * AdminRoute beskytter routes mod ikke-admin brugere.
 * Bemærk: Backend beskytter de rigtige API-endpoints.
 * Dette er kun en UX-beskyttelse i frontend.
 */
export default function AdminRoute({ children }) {
  const { token, user } = useAuth();

  // Ikke logget ind
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  // Logget ind men ikke admin
  if (user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}
