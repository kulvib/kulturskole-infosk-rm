import React from "react";
import { Routes, Route } from "react-router-dom";
import Dashboard from "./Dashboard";
import ClientInfoPage from "./pages/ClientInfoPage";
import ClientDetailsPageWrapper from "./pages/clientdetailspage/ClientDetailsPageWrapper";
import LoginPage from "./LoginPage";
import HomePage from "./HomePage";
import NotFound from "./NotFound";
import ProtectedRoute from "./auth/ProtectedRoute";
import AdminRoute from "./auth/AdminRoute";
import CalendarPage from "./pages/calendarpage/CalendarPage";
import AdminPage from "./pages/adminpages/AdminPage";
import RemoteDesktop from "./pages/clientdetailspage/remotedesktop/RemoteDesktop";
import ChangePassword from "./pages/ChangePassword";

/*
  App.jsx

  FIX (kritisk): Route param hed ":clientId" men ClientDetailsPageWrapper
    destructurerer useParams() som { id } — det betød at id altid var
    undefined og getClient(undefined) blev kaldt.
    Rettet til ":id" så det matcher useParams() i wrapperen.
*/

export default function App() {
  return (
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

        {/* FIX: ":clientId" → ":id" så useParams() i ClientDetailsPageWrapper matcher */}
        <Route path="clients/:id" element={<ClientDetailsPageWrapper />} />

        <Route path="calendar" element={<CalendarPage />} />
        <Route path="skift-adgangskode" element={<ChangePassword />} />
        <Route
          path="administration"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
      </Route>
      <Route
        path="/remote-desktop/:clientId"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <RemoteDesktop />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
