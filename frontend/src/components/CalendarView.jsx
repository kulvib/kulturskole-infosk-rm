import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box, Card, CardContent, Typography, Button, Select, MenuItem,
  CircularProgress, Paper, IconButton
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

const API_BASE_URL = "https://kulturskole-infosk-rm.onrender.com";

// -- Helper: Month names --
const monthNames = [
  "August", "September", "Oktober", "November", "December",
  "Januar", "Februar", "Marts", "April", "Maj", "Juni", "Juli"
];

// -- Helper: Weekday names --
const weekdayNames = ["Ma", "Ti", "On", "To", "Fr", "Lø", "Sø"];

// -- Helper: Generate seasons --
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

// -- Helper: Generate school year months array --
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

// -- Helper: Days in month --
function getDaysInMonth(month, year) {
  return new Date(year, month + 1, 0).getDate();
}

export default function CalendarView() {
  const [selectedSeason, setSelectedSeason] = useState(2025);
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [holidays, setHolidays] = useState([]);
  const seasons = getSeasons();

  // --- Godkendte klienter: Model som i ClientInfoPage.js ---
  const fetchClients = useCallback(() => {
    setLoadingClients(true);
    fetch(`${API_BASE_URL}/api/clients/approved/`)
      .then(res => res.json())
      .then(data => setClients(Array.isArray(data) ? data : []))
      .finally(() => setLoadingClients(false));
  }, []);

  // --- Hent helligdage ---
  const fetchHolidays = useCallback(() => {
    fetch(`${API_BASE_URL}/api/holidays/`)
      .then(res => res.json())
      .then(data => setHolidays(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    fetchClients();
    fetchHolidays();
  }, [fetchClients, fetchHolidays]);

  const schoolYearMonths = getSchoolYearMonths(selectedSeason);

  const isHoliday = (day, month, year) => {
    return holidays.some(
      h => {
        if (!h.date) return false;
        const d = new Date(h.date);
        return (
          d.getDate() === day &&
          d.getMonth() === month &&
          d.getFullYear() === year
        );
      }
    );
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
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {clients.length === 0 && !loadingClients && (
              <Typography variant="body2">Ingen godkendte klienter fundet</Typography>
            )}
            {clients.map(client => (
              <Button
                key={client.unique_id || client.id}
                variant="outlined"
                sx={{ borderRadius: 3, minWidth: 120, fontWeight: 700 }}
              >
                {client.name}
              </Button>
            ))}
          </Box>
        )}
      </Paper>
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
              <Box sx={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 0.2
              }}>
                {(() => {
                  const firstDay = new Date(year, month, 1).getDay();
                  const offset = firstDay === 0 ? 6 : firstDay - 1;
                  return Array(offset).fill(null).map((_, i) => (
                    <Box key={`empty-${i}`} />
                  ));
                })()}
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
