import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import ClientInfoPage from "./components/ClientInfoPage";
import HolidaysPage from "./components/HolidaysPage";
import ClientDetailsPageWrapper from "./components/ClientDetailsPageWrapper";
import LoginPage from "./components/LoginPage";
import HomePage from "./components/HomePage";
import NotFound from "./components/NotFound";
import ProtectedRoute from "./auth/ProtectedRoute";
import { AuthProvider, useAuth } from "./auth/authcontext";
import CalendarView from "./components/CalendarView";
import {
  getClients,
  getHolidays,
  addHoliday,
  deleteHoliday,
  approveClient,
  removeClient,
} from "./api";
import { useClientLiveWebSocket } from "./hooks/useClientWebSocket";

function AppContent() {
  const { token } = useAuth();
  const [clients, setClients] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayDesc, setHolidayDesc] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Alle API-kald bruger token fra context
  const fetchClients = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getClients(token);
      setClients(data);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const fetchHolidays = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getHolidays(token);
      setHolidays(data);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleAddHoliday = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await addHoliday(holidayDate, holidayDesc, token);
      setHolidayDate("");
      setHolidayDesc("");
      fetchHolidays();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleDeleteHoliday = async (id) => {
    setLoading(true);
    setError("");
    try {
      await deleteHoliday(id, token);
      fetchHolidays();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleApproveClient = async (id) => {
    setLoading(true);
    setError("");
    try {
      await approveClient(id, token);
      fetchClients();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleRemoveClient = async (id) => {
    setLoading(true);
    setError("");
    try {
      await removeClient(id, token);
      fetchClients();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  useClientLiveWebSocket({
    url: "wss://kulturskole-infosk-rm.onrender.com/ws/clients",
    onUpdate: fetchClients,
  });

  useEffect(() => {
    if (token) {
      fetchClients();
      fetchHolidays();
    }
  }, [token]);

  return (
    <>
      {error && (
        <div style={{ color: "red", padding: 10, fontWeight: 600 }}>
          {error}
        </div>
      )}
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
          <Route
            path="clients"
            element={
              <ClientInfoPage
                clients={clients}
                setClients={setClients}
                loading={loading}
                onApproveClient={handleApproveClient}
                onRemoveClient={handleRemoveClient}
                fetchClients={fetchClients}
              />
            }
          />
          <Route
            path="clients/:clientId"
            element={
              <ClientDetailsPageWrapper
                clients={clients}
                fetchClient={fetchClients}
              />
            }
          />
          <Route
            path="holidays"
            element={
              <HolidaysPage
                holidays={holidays}
                holidayDate={holidayDate}
                setHolidayDate={setHolidayDate}
                holidayDesc={holidayDesc}
                setHolidayDesc={setHolidayDesc}
                setHolidays={setHolidays}
                loading={loading}
                handleAddHoliday={handleAddHoliday}
                handleDeleteHoliday={handleDeleteHoliday}
              />
            }
          />
          <Route
            path="calendar"
            element={<CalendarView />}
          />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}
