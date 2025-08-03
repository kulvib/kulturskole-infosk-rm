import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Card, CardContent, Typography,
  CircularProgress, Paper, IconButton
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { getClients } from "../api";
import { useAuth } from "../auth/authcontext";

const monthNames = [
  "August", "September", "Oktober", "November", "December",
  "Januar", "Februar", "Marts", "April", "Maj", "Juni", "Juli"
];
const weekdayNames = ["Ma", "Ti", "On", "To", "Fr", "Lø", "Sø"];

function getSeasons(start = 2025, end = 2040) {
  const seasons = [];
  for (let y = start; y <= end; y++) {
    seasons.push({
      label: `${y}/${(y + 1).toString().slice(-2)}`,
      value: y
    });
  }
  return seasons;
}
function getSchoolYearMonths(seasonStart) {
  const months = [];
  for (let i = 0; i < 5; i++) {
    months.push({ name: monthNames[i], month: i + 7, year: seasonStart });
  }
  for (let i = 5; i < 12; i++) {
    months.push({ name: monthNames[i], month: i - 5, year: seasonStart + 1 });
  }
  return months;
}
function getDaysInMonth(month, year) {
  return new Date(year, month + 1, 0).getDate();
}

function MonthCalendar({ name, month, year, holidays }) {
  const daysInMonth = getDaysInMonth(month, year);
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = søndag
  const offset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const isHoliday = (day) => {
    return holidays.some(h => {
      if (!h.date) return false;
      const d = new Date(h.date);
      return (
        d.getDate() === day &&
        d.getMonth() === month &&
        d.getFullYear() === year
      );
    });
  };

  return (
    <Card sx={{
      borderRadius: "14px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      minWidth: 0,
      background: "#f9fafc"
    }}>
      <CardContent>
        <Typography variant="h6" sx={{
          color: "#0a275c",
          fontWeight: 700,
          textAlign: "center",
          fontSize: "1.08rem",
          mb: 1
        }}>
          {name} {year}
        </Typography>
        <Box sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 0.2,
          mb: 0.5
        }}>
          {weekdayNames.map(wd => (
            <Typography
              key={wd}
              variant="caption"
              sx={{
                fontWeight: 700,
                color: "#555",
                textAlign: "center",
                fontSize: "0.90rem",
                letterSpacing: "0.03em"
              }}
            >
              {wd}
            </Typography>
          ))}
        </Box>
        <Box sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 0.2
        }}>
          {cells.map((day, idx) => (
            day ? (
              <Box
                key={idx}
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  p: 0.2
                }}
              >
                <Box
                  sx={{
                    width: 23,
                    height: 23,
                    borderRadius: "50%",
                    background: isHoliday(day) ? "#ffeaea" : "#fff",
                    border: isHoliday(day) ? "2px solid #ea394f" : "1px solid #eee",
                    color: isHoliday(day) ? "#ea394f" : "#0a275c",
                    fontWeight: 500,
                    fontSize: "0.95rem",
                    textAlign: "center",
                    lineHeight: "23px",
                    boxShadow: isHoliday(day) ? "0 1px 8px rgba(234,57,79,0.08)" : "0 1px 2px rgba(0,0,0,0.06)"
                  }}
                  title={isHoliday(day) ? "Ferie/helligdag" : ""}
                >
                  {day}
                </Box>
              </Box>
            ) : (
              <Box key={idx + "-empty"} />
            )
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}

export default function CalendarView() {
  const { token } = useAuth();
  const [selectedSeason, setSelectedSeason] = useState(2025);
  const [clients, setClients] = useState([]);
  const [selectedClients, setSelectedClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [holidays, setHolidays] = useState([]);
  const seasons = getSeasons(2025, 2040);

  // Hent ALLE klienter og filtrér på "approved"
  const fetchClients = useCallback(async () => {
    setLoadingClients(true);
    try {
      const data = await getClients(token);
      const approvedClients = (data?.filter((c) => c.status === "approved") || []).slice();
      setClients(approvedClients);
    } catch {
      setClients([]);
    }
    setLoadingClients(false);
  }, [token]);

  // Hent helligdage
  const fetchHolidays = useCallback(() => {
    fetch("/api/holidays/")
      .then(res => res.json())
      .then(data => setHolidays(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    fetchClients();
    fetchHolidays();
  }, [fetchClients, fetchHolidays]);

  const schoolYearMonths = getSchoolYearMonths(selectedSeason);

  // Klientvalg funktioner
  const clientIds = clients.map(c => c.id);

  // Vælg/fjern individuel klient
  const handleClientChange = (_, newSelected) => {
    setSelectedClients(newSelected);
  };

  // Vælg alle/ingen klienter
  const toggleAllClients = () => {
    if (selectedClients.length === clientIds.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(clientIds);
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", mt: 4, fontFamily: "inherit" }}>
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: "#0a275c", flexGrow: 1 }}>
            Godkendte klienter
          </Typography>
          <Box sx={{ position: "relative" }}>
            <IconButton
              aria-label="Opdater klienter"
              onClick={fetchClients}
              disabled={loadingClients}
            >
              <RefreshIcon />
              {loadingClients && (
                <CircularProgress
                  size={32}
                  sx={{ color: "#1976d2", position: "absolute", left: 4, top: 4, zIndex: 1 }}
                />
              )}
            </IconButton>
          </Box>
        </Box>
        {loadingClients && clients.length === 0 ? (
          <CircularProgress size={22} />
        ) : (
          <Box>
            <ToggleButton
              value="all"
              selected={selectedClients.length === clientIds.length && clientIds.length > 0}
              onClick={toggleAllClients}
              sx={{
                fontWeight: 700,
                borderRadius: 3,
                minWidth: 90,
                color: selectedClients.length === clientIds.length ? "#fff" : "#1976d2",
                bgcolor: selectedClients.length === clientIds.length ? "#1976d2" : "#fff",
                border: selectedClients.length === clientIds.length ? "1.5px solid #1976d2" : "1.5px solid #bbb",
                mr: 1,
                mb: 1
              }}
            >
              Vælg alle
            </ToggleButton>
            <ToggleButtonGroup
              value={selectedClients}
              onChange={handleClientChange}
              aria-label="klientvalg"
              multiple
              sx={{ flexWrap: "wrap", gap: 1 }}
            >
              {clients.map(client => (
                <ToggleButton
                  key={client.id}
                  value={client.id}
                  sx={{
                    fontWeight: 700,
                    borderRadius: 3,
                    minWidth: 90,
                    color: selectedClients.includes(client.id) ? "#fff" : "#1976d2",
                    bgcolor: selectedClients.includes(client.id) ? "#1976d2" : "#fff",
                    border: selectedClients.includes(client.id) ? "1.5px solid #1976d2" : "1.5px solid #bbb"
                  }}
                >
                  {client.locality || "Ingen lokalitet"}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        )}
      </Paper>
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Typography sx={{ fontWeight: 600, color: "#0a275c", mb: 1 }}>
          Vælg sæson:
        </Typography>
        <ToggleButtonGroup
          value={selectedSeason}
          exclusive
          onChange={(_, value) => value && setSelectedSeason(value)}
          sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}
        >
          {seasons.map(season => (
            <ToggleButton
              key={season.value}
              value={season.value}
              sx={{
                fontWeight: 700,
                borderRadius: 3,
                minWidth: 80,
                bgcolor: selectedSeason === season.value ? "#1976d2" : "#fff",
                color: selectedSeason === season.value ? "#fff" : "#1976d2",
                border: selectedSeason === season.value ? "1.5px solid #1976d2" : "1.5px solid #bbb",
                '&:hover': {
                  bgcolor: selectedSeason === season.value ? "#1565c0" : "#e3eafc"
                }
              }}
            >
              {season.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Paper>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "2fr 2fr", md: "repeat(4, 1fr)" },
          gap: 3,
        }}
      >
        {schoolYearMonths.map(({ name, month, year }, idx) => (
          <MonthCalendar
            key={name + year}
            name={name}
            month={month}
            year={year}
            holidays={holidays}
          />
        ))}
      </Box>
    </Box>
  );
}
