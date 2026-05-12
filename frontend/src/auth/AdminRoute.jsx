// src/auth/AdminRoute.jsx
// Beskytter routes mod ikke-administratorer.
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./authcontext";

export default function AdminRoute({ children }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/" replace />;

  return children;
}
