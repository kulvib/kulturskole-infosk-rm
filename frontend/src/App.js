import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Tabs,
  Tab,
  Paper,
  Stack,
  CircularProgress,
  Snackbar,
  Alert,
} from "@mui/material";
import ClientInfoPage from "./components/ClientInfoPage";
import HolidaysPage from "./components/HolidaysPage";
import ClientDetailsPageWrapper from "./components/ClientDetailsPageWrapper";

const API_URL = "https://kulturskole-infosk-rm.onrender.com";
const token = "PASTE_YOUR_JWT_TOKEN_HERE"; // Sæt din gyldige admin JWT-token her

function DashboardView({
  clients,
  setClients,
  holidays,
  setHolidays,
  holidayDate,
  setHolidayDate,
  holidayDesc,
  setHolidayDesc,
  error,
  setError,
  loading,
  setLoading,
  fetchClients,
  fetchHolidays,
  handleAddHoliday,
  handleDeleteHoliday,
  approveClient,
  removeClient,
}) {
  const [tab, setTab] = useState(0);
  const navigate = useNavigate();

  return (
    <Box sx={{ bgcolor: "#f5f7fa", minHeight: "100vh" }}>
      <AppBar position="static" sx={{ bgcolor: "#1976d2" }}>
        <Toolbar>
          <Typography variant="h5" sx={{ flexGrow: 1 }}>
            Kulturskolen Viborg – Infoskærm Admin
          </Typography>
          <Button
            color="inherit"
            variant="outlined"
            sx={{ ml: 2, bgcolor: "#fff", color: "#1976d2", borderRadius: 2 }}
            onClick={() => window.location.reload()}
          >
            Log ud
          </Button>
        </Toolbar>
      </AppBar>
      <Box sx={{ maxWidth: 1100, mx: "auto", mt: 5, bgcolor: "#fff", p: 3, borderRadius: 3, boxShadow: 2 }}>
        {error && (
          <Snackbar open autoHideDuration={4000} onClose={() => setError("")}>
            <Alert severity="error" sx={{ width: "100%" }}>
              {error}
            </Alert>
          </Snackbar>
        )}
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          textColor="primary"
          indicatorColor="primary"
          sx={{ mb: 3 }}
        >
          <Tab label="Klienter" sx={{ fontWeight: "bold", fontSize: 18 }} />
          <Tab label="Helligdage" sx={{ fontWeight: "bold", fontSize: 18 }} />
        </Tabs>
        {tab === 0 && (
          <ClientInfoPage
            clients={clients}
            setClients={setClients}
            loading={loading}
            approveClient={approveClient}
            removeClient={removeClient}
            fetchClients={fetchClients}
            navigate={navigate}
          />
        )}
        {tab === 1 && (
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
            fetchHolidays={fetchHolidays}
          />
        )}
      </Box>
    </Box>
  );
}

function App() {
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
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      } else {
        setError("Kunne ikke hente klienter");
      }
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
      if (res.ok) {
        const data = await res.json();
        setHolidays(data);
      } else {
        setError("Kunne ikke hente fridage");
      }
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
        body: JSON.stringify({
          date: holidayDate,
          description: holidayDesc,
        }),
      });
      if (res.ok) {
        setHolidayDate("");
        setHolidayDesc("");
        fetchHolidays();
      } else {
        setError("Kunne ikke tilføje fridag");
      }
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
      if (res.ok) {
        fetchHolidays();
      } else {
        setError("Kunne ikke slette fridag");
      }
    } catch {
      setError("Kunne ikke slette fridag");
    }
    setLoading(false);
  };

  // Godkend klient
  const approveClient = async (id) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/clients/${id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchClients();
      } else {
        setError("Kunne ikke godkende klient");
      }
    } catch {
      setError("Kunne ikke godkende klient");
    }
    setLoading(false);
  };

  // Fjern klient
  const removeClient = async (id) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/clients/${id}/remove`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchClients();
      } else {
        setError("Kunne ikke fjerne klient");
      }
    } catch {
      setError("Kunne ikke fjerne klient");
    }
    setLoading(false);
  };

  // Hent data ved mount
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
          element={
            <DashboardView
              clients={clients}
              setClients={setClients}
              holidays={holidays}
              setHolidays={setHolidays}
              holidayDate={holidayDate}
              setHolidayDate={setHolidayDate}
              holidayDesc={holidayDesc}
              setHolidayDesc={setHolidayDesc}
              error={error}
              setError={setError}
              loading={loading}
              setLoading={setLoading}
              fetchClients={fetchClients}
              fetchHolidays={fetchHolidays}
              handleAddHoliday={handleAddHoliday}
              handleDeleteHoliday={handleDeleteHoliday}
              approveClient={approveClient}
              removeClient={removeClient}
            />
          }
        />
        <Route path="/clients/:clientId" element={<ClientDetailsPageWrapper clients={clients} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
