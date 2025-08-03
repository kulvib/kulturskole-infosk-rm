import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./authcontext";

/**
 * ProtectedRoute beskytter routes, så kun brugere med token får adgang.
 */
export default function ProtectedRoute() {
  const { token } = useAuth();

  // Hvis ikke logget ind, redirect til login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Ellers vis child routes
  return <Outlet />;
}
