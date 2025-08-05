import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import ClientInfoPage from "./components/ClientInfoPage";
import ClientDetailsPageWrapper from "./components/ClientDetailsPageWrapper";
import LoginPage from "./components/LoginPage";
import HomePage from "./components/HomePage";
import NotFound from "./components/NotFound";
import ProtectedRoute from "./auth/ProtectedRoute";
import CalendarPage from "./components/CalendarPage"; // <-- Ændret her
import { AuthProvider } from "./auth/authcontext";
import AdminPage from "./components/AdminPage"; // NYT!

export default function App() {
  return (
    <AuthProvider>
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
            {/* <Route path="holidays" element={<HolidaysPage />} />  <-- SLET DENNE LINJE */}
            <Route path="calendar" element={<CalendarPage />} /> {/* <-- Ændret her */}
            <Route path="administration" element={<AdminPage />} /> {/* NYT! */}
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
