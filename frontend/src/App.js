import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import ClientInfoPage from "./components/ClientInfoPage";
import HolidaysPage from "./components/HolidaysPage";
import ClientDetailsPage from "./components/ClientDetailsPage";
import LoginPage from "./components/LoginPage";
import HomePage from "./components/HomePage"; // <-- NY
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

  // ... alle dine fetch/add/remove-metoder (samme som før)

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
          {/* Forside: HomePage */}
          <Route
            index
            element={<HomePage />} // <-- NY forside!
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
