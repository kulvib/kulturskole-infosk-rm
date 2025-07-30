import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import ClientInfoPage from "./components/ClientInfoPage";
import HolidaysPage from "./components/HolidaysPage";

const API_URL = "https://kulturskole-infosk-rm.onrender.com";
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6MTk5OTk5OTk5OX0.Fu6qHK7byNQ_GcanaXyvyma_d4fq_hq-wJPFuWXhyks"; // Husk at erstatte med din rigtige token

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

  // Hent helligdage
  const fetchHolidays = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/holidays/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setHolidays(await res.json());
      else setError("Kunne ikke hente helligdage");
    } catch {
      setError("Kunne ikke hente helligdage");
    }
    setLoading(false);
  };

  // Tilføj helligdag
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
      } else setError("Kunne ikke tilføje helligdag");
    } catch {
      setError("Kunne ikke tilføje helligdag");
    }
    setLoading(false);
  };

  // Slet helligdag
  const handleDeleteHoliday = async (id) => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/holidays/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) fetchHolidays();
      else setError("Kunne ikke slette helligdag");
    } catch {
      setError("Kunne ikke slette helligdag");
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
          path="/"
          element={<Dashboard />}
        >
          <Route
            index
            element={
              <div style={{ marginTop: 40, textAlign: "center" }}>
                <h2>Velkommen!</h2>
                <p>Vælg en funktion i menuen til venstre.</p>
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
