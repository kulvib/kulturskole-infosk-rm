import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import ClientInfoPage from "./components/ClientInfoPage";
import HolidaysPage from "./components/HolidaysPage";
import ClientDetailsPage from "./components/ClientDetailsPage";
import LoginPage from "./components/LoginPage";
import ProtectedRoute from "./auth/ProtectedRoute";

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

  // Hent klienter fra backend
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

  // Hent helligdage fra backend
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

  // Tilføj helligdag
  const handleAddHoliday = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
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

  // Slet helligdag
  const handleDeleteHoliday = async (id) => {
    setError("");
    setLoading(true);
    try {
      await deleteHoliday(id);
      fetchHolidays();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  // Godkend klient
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

  // Fjern klient
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
    fetchClients();
    fetchHolidays();
    // eslint-disable-next-line
  }, []);

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
          <Route
            index
            element={
              <div style={{ marginTop: 40, textAlign: "center" }}>
                <h2>Velkommen!</h2>
                <p>Vælg en funktion i menuen til venstre.</p>
                {error && <p style={{ color: "red" }}>{error}</p>}
              </div>
            }
          />
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
              <ClientDetailsPage
                clients={clients}
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
      </Routes>
    </BrowserRouter>
  );
}
