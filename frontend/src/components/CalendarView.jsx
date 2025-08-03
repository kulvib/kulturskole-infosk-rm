import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Card, CardContent, Typography, Button, Select, MenuItem,
  CircularProgress, Paper, IconButton
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
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
  // Juster til dansk uge (mandag=0)
  const offset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  // Opbyg array af alle celler (tomme før/efter)
  const cells = [];
  // Tomme celler før 1.
  for (let i = 0; i < offset; i++) cells.push(null);
  // Dato-celler
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Tomme celler efter sidste dag, så grid bliver 5 eller 6 rækker
  while (cells.length % 7 !== 0) cells.push(null);

  // Split til uger
  const weeks = [];
  for (let w = 0; w < cells.length / 7; w++) {
    weeks.push(cells.slice(w * 7, w * 7 + 7));
  }

  // Funktion til at tjekke om dag er helligdag
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
        {/* Ugedagsrække fast */}
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
        {/* Datoer i grid */}
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
  const [loadingClients, setLoadingClients] = useState(false);
  const [holidays, setHolidays] = useState([]);
  const seasons = getSeasons();

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

  // Hent helligdage (samme som før)
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
