import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import ClientInfoPage from "./components/ClientInfoPage";
import HolidaysPage from "./components/HolidaysPage";
import ClientDetailsPageWrapper from "./components/ClientDetailsPageWrapper"; // <-- brug wrapperen!
import LoginPage from "./components/LoginPage";
import HomePage from "./components/HomePage";
import ProtectedRoute from "./auth/ProtectedRoute";
import { AuthProvider } from "./auth/authcontext";
import {
  getClients,
  getHolidays,
  addHoliday,
  deleteHoliday,
  approveClient,
  removeClient,
} from "./api";

export default function App() {
  const [clients, setClients] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayDesc, setHolidayDesc] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch clients from API
  const fetchClients = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getClients();
      setClients(data);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  // Fetch holidays from API
  const fetchHolidays = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getHolidays();
      setHolidays(data);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  // Add a new holiday
  const handleAddHoliday = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await addHoliday(holidayDate, holidayDesc);
      setHolidayDate("");
      setHolidayDesc("");
      fetchHolidays();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  // Delete a holiday
  const handleDeleteHoliday = async (id) => {
    setLoading(true);
    setError("");
    try {
      await deleteHoliday(id);
      fetchHolidays();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  // Approve a client
  const handleApproveClient = async (id) => {
    setLoading(true);
    setError("");
    try {
      await approveClient(id);
      fetchClients();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  // Remove a client
  const handleRemoveClient = async (id) => {
    setLoading(true);
    setError("");
    try {
      await removeClient(id);
      fetchClients();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (localStorage.getItem("token")) {
      fetchClients();
      fetchHolidays();
    }
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        {/* Vis fejl hvis der er */}
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
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
