import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import ClientDetailsPageWrapper from "./components/ClientDetailsPageWrapper";

const API_URL = "https://kulturskole-infosk-rm.onrender.com";
const token = "PASTE_YOUR_JWT_TOKEN_HERE"; // Sæt din gyldige admin JWT-token her

export default function App() {
  const [clients, setClients] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayDesc, setHolidayDesc] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Hent klienter
  const fetchClients = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/clients/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setClients(await res.json());
      else setError("Kunne ikke hente klienter");
    } catch {
      setError("Kunne ikke hente klienter");
    }
    setLoading(false);
  };

  // Hent fridage
  const fetchHolidays = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/holidays/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setHolidays(await res.json());
      else setError("Kunne ikke hente fridage");
    } catch {
      setError("Kunne ikke hente fridage");
    }
    setLoading(false);
  };

  // Tilføj fridag
  const handleAddHoliday = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/holidays/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ date: holidayDate, description: holidayDesc }),
      });
      if (res.ok) {
        setHolidayDate("");
        setHolidayDesc("");
        fetchHolidays();
      } else setError("Kunne ikke tilføje fridag");
    } catch {
      setError("Kunne ikke tilføje fridag");
    }
    setLoading(false);
  };

  // Slet fridag
  const handleDeleteHoliday = async (id) => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/holidays/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) fetchHolidays();
      else setError("Kunne ikke slette fridag");
    } catch {
      setError("Kunne ikke slette fridag");
    }
    setLoading(false);
  };

  // Godkend klient
  const handleApproveClient = async (id) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/clients/${id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) fetchClients();
      else setError("Kunne ikke godkende klient");
    } catch {
      setError("Kunne ikke godkende klient");
    }
    setLoading(false);
  };

  // Fjern klient
  const handleRemoveClient = async (id) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/clients/${id}/remove`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) fetchClients();
      else setError("Kunne ikke fjerne klient");
    } catch {
      setError("Kunne ikke fjerne klient");
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
        <Route
          path="/*"
          element={
            <Dashboard
              clients={clients}
              setClients={setClients}
              loading={loading}
              error={error}
              onApproveClient={handleApproveClient}
              onRemoveClient={handleRemoveClient}
              holidays={holidays}
              holidayDate={holidayDate}
              setHolidayDate={setHolidayDate}
              holidayDesc={holidayDesc}
              setHolidayDesc={setHolidayDesc}
              setHolidays={setHolidays}
              handleAddHoliday={handleAddHoliday}
              handleDeleteHoliday={handleDeleteHoliday}
              fetchClients={fetchClients}
              fetchHolidays={fetchHolidays}
            />
          }
        />
        <Route
          path="/clients/:clientId"
          element={<ClientDetailsPageWrapper clients={clients} />}
        />
      </Routes>
    </BrowserRouter>
  );
}
