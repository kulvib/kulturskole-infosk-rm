import React, { useState, useEffect } from "react";
import {
  Box, Card, CardContent, Typography, Button, Select, MenuItem, CircularProgress, Paper
} from "@mui/material";
import { useClientWebSocket } from "../hooks/useClientWebSocket";

// -- Helper: Month names --
const monthNames = [
  "August", "September", "Oktober", "November", "December",
  "Januar", "Februar", "Marts", "April", "Maj", "Juni", "Juli"
];

// -- Helper: Weekday names --
const weekdayNames = ["Ma", "Ti", "On", "To", "Fr", "Lø", "Sø"];

// -- Helper: Generate seasons --
function getSeasons(start = 2025, end = 2050) {
  const seasons = [];
  for (let y = start; y <= end; y++) {
    seasons.push({
      label: `${y}/${(y + 1).toString().slice(-2)}`,
      value: y
    });
  }
  return seasons;
}

// -- Helper: Generate school year months array --
function getSchoolYearMonths(seasonStart) {
  // August-Dec: seasonStart, Jan-Jul: seasonStart+1
  const months = [];
  for (let i = 0; i < 5; i++) {
    months.push({ name: monthNames[i], month: i + 7, year: seasonStart });
  }
  for (let i = 5; i < 12; i++) {
    months.push({ name: monthNames[i], month: i - 5, year: seasonStart + 1 });
  }
  return months;
}

// -- Helper: Days in month --
function getDaysInMonth(month, year) {
  return new Date(year, month + 1, 0).getDate();
}

export default function CalendarView() {
  // --- State ---
  const [selectedSeason, setSelectedSeason] = useState(2025);
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [holidays, setHolidays] = useState([]);
  const seasons = getSeasons();

  // --- Fetch only approved clients from API ---
  const fetchClients = async () => {
    setLoadingClients(true);
    try {
      const res = await fetch("/api/clients/");
      const data = await res.json();
      // Filtrer kun godkendte klienter
      const approvedClients = Array.isArray(data)
        ? data.filter(client => client.approved === true)
        : [];
      setClients(approvedClients);
    } catch (e) {
      setClients([]);
    }
    setLoadingClients(false);
  };

  // --- Fetch holidays from API ---
  const fetchHolidays = async () => {
    try {
      const res = await fetch("/api/holidays/");
      const data = await res.json();
      setHolidays(Array.isArray(data) ? data : []);
    } catch (e) {
      setHolidays([]);
    }
  };

  useEffect(() => {
    fetchClients();
    fetchHolidays();
    // eslint-disable-next-line
  }, []);

  // WebSocket: lyt efter klient- og ferie-ændringer fra backend
  const wsStatus = useClientWebSocket({
    onClientsChanged: fetchClients,
    onHolidaysChanged: fetchHolidays
  });

  // --- School year months ---
  const schoolYearMonths = getSchoolYearMonths(selectedSeason);

  // Hjælper til at vise om en dag er en holiday
  const isHoliday = (day, month, year) => {
    return holidays.some(
      h =>
        // Antager holiday har {date: "YYYY-MM-DD"}
        (() => {
          if (!h.date) return false;
          const d = new Date(h.date);
          return (
            d.getDate() === day &&
            d.getMonth() === month &&
            d.getFullYear() === year
          );
        })()
    );
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", mt: 4, fontFamily: "inherit" }}>
      {/* WebSocket-status */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ color: "#555" }}>
          WebSocket status: <b>{wsStatus}</b>
        </Typography>
      </Box>
      {/* Klientliste */}
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 1, fontWeight: 700, color: "#0a275c" }}>
          Godkendte klienter
        </Typography>
        {loadingClients ? (
          <CircularProgress size={22} />
        ) : (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {clients.length === 0 && (
              <Typography variant="body2">Ingen godkendte klienter fundet</Typography>
            )}
            {clients.map(client => (
              <Button
                key={client.id || client._id}
                variant="outlined"
                sx={{ borderRadius: 3, minWidth: 120, fontWeight: 700 }}
              >
                {client.name || (client.firstName + " " + client.lastName)}
              </Button>
            ))}
          </Box>
        )}
      </Paper>
      {/* Sæsonvælger */}
      <Paper elevation={2} sx={{ p: 2, mb: 3, display: "flex", alignItems: "center", gap: 2 }}>
        <Typography component="label" htmlFor="seasonSelect" sx={{ fontWeight: 600, color: "#0a275c" }}>
          Vælg skoleår:
        </Typography>
        <Select
          id="seasonSelect"
          value={selectedSeason}
          onChange={e => setSelectedSeason(Number(e.target.value))}
          sx={{ fontWeight: 700, minWidth: 110, bgcolor: "#f9fafc", borderRadius: 2 }}
        >
          {seasons.map(season => (
            <MenuItem key={season.value} value={season.value}>
              {season.label}
            </MenuItem>
          ))}
        </Select>
      </Paper>
      {/* Kalender-grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "2fr 2fr", md: "repeat(4, 1fr)" },
          gap: 3,
        }}
      >
        {schoolYearMonths.map(({ name, month, year }, idx) => (
          <Card key={name + year} sx={{
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
              {/* Ugedage */}
              <Box sx={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 0.2,
                mb: 0.5
              }}>
                {weekdayNames.map(wd => (
                  <Typography key={wd}
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      color: "#888",
                      textAlign: "center",
                      fontSize: "0.92rem"
                    }}
                  >
                    {wd}
                  </Typography>
                ))}
              </Box>
              {/* Tomme felter før første dag */}
              <Box sx={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 0.2
              }}>
                {(() => {
                  const firstDay = new Date(year, month, 1).getDay();
                  // JS: 0 = søndag, vi vil have mandag først
                  const offset = firstDay === 0 ? 6 : firstDay - 1;
                  return Array(offset).fill(null).map((_, i) => (
                    <Box key={`empty-${i}`} />
                  ));
                })()}
                {/* Dage */}
                {Array(getDaysInMonth(month, year)).fill(null).map((_, dayIdx) => {
                  const day = dayIdx + 1;
                  const holiday = isHoliday(day, month, year);
                  return (
                    <Box
                      key={dayIdx}
                      sx={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        m: "1px"
                      }}
                    >
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background: holiday ? "#ffeaea" : "#fff",
                          border: holiday ? "2px solid #ea394f" : "2px solid #eee",
                          color: holiday ? "#ea394f" : "#0a275c",
                          fontWeight: 700,
                          fontSize: "1rem",
                          textAlign: "center",
                          lineHeight: "32px",
                          boxShadow: holiday ? "0 1px 8px rgba(234,57,79,0.10)" : "0 1px 3px rgba(0,0,0,0.07)"
                        }}
                        title={holiday ? "Ferie/helligdag" : ""}
                      >
                        {day}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
}
