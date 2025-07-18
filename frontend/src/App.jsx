import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Clients from "./pages/Clients.jsx";
import ClientInfo from "./pages/ClientInfo.jsx";
import { AuthProvider, useAuth } from "./auth/AuthContext.jsx";

function RequireAuth({ children }) {
  const { token } = useAuth();
  const location = useLocation();
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Clients />
            </RequireAuth>
          }
        />
        <Route
          path="/client/:clientId"
          element={
            <RequireAuth>
              <ClientInfo />
            </RequireAuth>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
