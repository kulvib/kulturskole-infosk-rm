// src/auth/AdminRoute.jsx
// Beskytter routes mod ikke-administratorer.
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./authcontext";

export default function AdminRoute({ children, requireSuperadmin = false }) {
  const { user, isAdmin, isSuperadmin } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  if (requireSuperadmin && !isSuperadmin) return <Navigate to="/" replace />;

  return children;
}
