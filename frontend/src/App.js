import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import ClientInfoPage from "./components/ClientInfoPage";
import ClientDetailsPageWrapper from "./components/ClientDetailsPageWrapper";
import LoginPage from "./components/LoginPage";
import HomePage from "./components/HomePage";
import NotFound from "./components/NotFound";
import ProtectedRoute from "./auth/ProtectedRoute";
import CalendarPage from "./components/CalendarPage";
import AdminPage from "./components/AdminPage";
import RemoteDesktop from "./components/RemoteDesktop";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="clients" element={<ClientInfoPage />} />
          <Route path="clients/:clientId" element={<ClientDetailsPageWrapper />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="administration" element={<AdminPage />} />
          {/* Nu aktiv: generisk klientdetaljer-side */}
          <Route path="client-details" element={<ClientDetailsPageWrapper />} />
        </Route>
        <Route path="/remote-desktop/:clientId" element={<RemoteDesktop />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
