import React, { useState, useEffect } from "react";
import {
  Box, Card, CardContent, Typography, Button, Select, MenuItem, CircularProgress, Paper
} from "@mui/material";

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
  const seasons = getSeasons();

  // --- Fetch approved clients ---
  useEffect(() => {
    async function fetchClients() {
      setLoadingClients(true);
      try {
        const res = await fetch("/api/clients/"); // Justér evt. stien
        const data = await res.json();
        // Filter kun dem med status "approved"
        const approved = Array.isArray(data) ? data.filter(c => c.status === "approved") : [];
        setClients(approved);
      } catch (e) {
        setClients([]);
      }
      setLoadingClients(false);
    }
    fetchClients();
  }, []);

  // --- School year months ---
  const schoolYearMonths = getSchoolYearMonths(selectedSeason);

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", mt: 4, fontFamily: "inherit" }}>
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
              <Typography variant="body2">Ingen godkendte klienter</Typography>
            )}
            {clients.map(client => (
              <Button
                key={client.id}
                variant="outlined"
                sx={{ borderRadius: 3, minWidth: 120, fontWeight: 700 }}
              >
                {client.name}
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
                {Array(getDaysInMonth(month, year)).fill(null).map((_, dayIdx) => (
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
                        background: "#fff",
                        border: "2px solid #ea394f",
                        color: "#ea394f",
                        fontWeight: 700,
                        fontSize: "1rem",
                        textAlign: "center",
                        lineHeight: "32px",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.07)"
                      }}
                    >
                      {dayIdx + 1}
                    </Box>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
      {/* Reference billede */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="caption" sx={{ color: "#888", mb: 1 }}>
          Kalender layout reference:
        </Typography>
        <img src="![image1](image1)" alt="Kalender layout" style={{ width: "100%", maxWidth: 900, borderRadius: 12, boxShadow: "0 1px 6px rgba(0,0,0,0.08)" }} />
      </Box>
    </Box>
  );
}
