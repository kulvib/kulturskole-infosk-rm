import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

// Wrapper for routes der kræver login
export default function PrivateRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" />;
}
