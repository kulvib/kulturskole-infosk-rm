import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Paper,
  IconButton,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Switch,
  Select,
  MenuItem,
  Snackbar,
  Alert,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { getClients } from "../api";
import { useAuth } from "../auth/authcontext";

// Måneds- og ugedagsnavne
const monthNames = [
  "August", "September", "Oktober", "November", "December",
  "Januar", "Februar", "Marts", "April", "Maj", "Juni", "Juli"
];
const weekdayNames = ["Ma", "Ti", "On", "To", "Fr", "Lø", "Sø"];

// Hjælpefunktioner til sæson og skoleår
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
function formatDate(year, month, day) {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

// MonthCalendar: Kalender med klikbare dage
function MonthCalendar({
  name,
  month,
  year,
  clientIds,
  markedDays,
  markMode,
  onDayClick,
}) {
  const daysInMonth = getDaysInMonth(month, year);
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = søndag
  const offset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

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
          {cells.map((day, idx) => {
            if (!day) return <Box key={idx + "-empty"} />;
            const dateString = formatDate(year, month, day);

            // Hvis mindst én klient har markeret dag, brug farve
            let color = "default";
            clientIds.forEach(cid => {
              if (markedDays?.[cid]?.[dateString] === "on") color = "on";
              if (markedDays?.[cid]?.[dateString] === "off") color = "off";
            });
            let bg = "#fff";
            if (color === "on") bg = "#b4eeb4";
            if (color === "off") bg = "#ffb7b7";

            return (
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
                    background: bg,
                    border: "1px solid #eee",
                    color: "#0a275c",
                    fontWeight: 500,
                    fontSize: "0.95rem",
                    textAlign: "center",
                    lineHeight: "23px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                    cursor: clientIds.length > 0 ? "pointer" : "default",
                    transition: "background 0.2s",
                    opacity: clientIds.length > 0 ? 1 : 0.55,
                  }}
                  title={
                    color === "on"
                      ? "Tændt"
                      : color === "off"
                      ? "Slukket"
                      : ""
                  }
                  onClick={() => {
                    if (clientIds.length > 0) {
                      onDayClick(clientIds, dateString, markMode, markedDays);
                    }
                  }}
                >
                  {day}
                </Box>
              </Box>
            );
          })}
        </Box>
      </CardContent>
    </Card>
  );
}

// Hovedkomponent
export default function CalendarView() {
  const { token } = useAuth();
  const [selectedSeason, setSelectedSeason] = useState(2025);
  const [clients, setClients] = useState([]);
  const [selectedClients, setSelectedClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });

  // Mode: hvad betyder næste klik? ("on" = tændt, "off" = slukket)
  const [markMode, setMarkMode] = useState("on");

  // Markeringer: { [clientId]: { [dateString]: "on"|"off" } }
  const [markedDays, setMarkedDays] = useState({});

  const seasons = getSeasons(2025, 2040);

  // --- POLLING LOGIK ---
  useEffect(() => {
    let poller;
    const pollClients = async () => {
      setLoadingClients(true);
      try {
        const data = await getClients(token);
        const approvedClients = (data?.filter((c) => c.status === "approved") || []).slice();
        setClients(approvedClients);
      } catch {
        setClients([]);
      }
      setLoadingClients(false);
    };
    pollClients();
    poller = setInterval(pollClients, 30000); // Poll hvert 30. sekund
    return () => clearInterval(poller);
  }, [token]);

  const schoolYearMonths = getSchoolYearMonths(selectedSeason);
  const clientIds = clients.map(c => c.id);

  // Vælg/fjern individuel klient
  const handleClientChange = (id) => {
    setSelectedClients(selected =>
      selected.includes(id)
        ? selected.filter(x => x !== id)
        : [...selected, id]
    );
  };

  // Vælg/Fjern alle
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedClients(clientIds);
    } else {
      setSelectedClients([]);
    }
  };

  // Når en dag klikkes:
  // Hvis ikke markeret, marker med mode ("on"/"off")
  // Hvis allerede markeret, fjern markering
  const handleDayClick = (clientIds, dateString, mode, markedDays) => {
    setMarkedDays(prev => {
      const updated = { ...prev };
      clientIds.forEach(cid => {
        const current = updated?.[cid]?.[dateString];
        if (current === mode) {
          // Fjern markering
          delete updated[cid][dateString];
          if (Object.keys(updated[cid]).length === 0) {
            delete updated[cid];
          }
        } else {
          // Sæt markering
          updated[cid] = { ...(updated[cid] || {}), [dateString]: mode };
        }
      });
      return updated;
    });
  };

  // Gem funktion
  const handleSave = async () => {
    if (selectedClients.length === 0) {
      setSnackbar({ open: true, message: "Ingen klienter valgt", severity: "warning" });
      return;
    }
    try {
      const res = await fetch("/api/push-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clients: selectedClients,
          markedDays,
        }),
      });
      if (res.ok) {
        setSnackbar({ open: true, message: "Gemt!", severity: "success" });
      } else {
        setSnackbar({ open: true, message: "Kunne ikke gemme!", severity: "error" });
      }
    } catch (e) {
      setSnackbar({ open: true, message: "Netværksfejl!", severity: "error" });
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", mt: 4, fontFamily: "inherit" }}>
      {/* Mere kompakt sæsonvælger */}
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: "#0a275c" }}>
            Vælg Sæson:
          </Typography>
          <Select
            size="small"
            value={selectedSeason}
            onChange={e => setSelectedSeason(e.target.value)}
            sx={{ minWidth: 120, fontWeight: 700, background: "#fff" }}
          >
            {seasons.map(season => (
              <MenuItem key={season.value} value={season.value}>
                {season.label}
              </MenuItem>
            ))}
          </Select>
        </Box>
      </Paper>
      {/* Godkendte klienter med polling */}
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: "#0a275c", flexGrow: 1 }}>
            Godkendte klienter
          </Typography>
          <Box sx={{ position: "relative" }}>
            <IconButton
              aria-label="Opdater klienter"
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
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={selectedClients.length === clientIds.length && clientIds.length > 0}
                  indeterminate={selectedClients.length > 0 && selectedClients.length < clientIds.length}
                  onChange={handleSelectAll}
                />
              }
              label="Vælg alle"
            />
            {clients.map(client => (
              <FormControlLabel
                key={client.id}
                control={
                  <Checkbox
                    checked={selectedClients.includes(client.id)}
                    onChange={() => handleClientChange(client.id)}
                  />
                }
                label={client.locality || "Ingen lokalitet"}
              />
            ))}
          </FormGroup>
        )}
      </Paper>
      {/* Switch/kontakt for markering og GEM-knap på samme række */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 2, gap: 2 }}>
        <Typography sx={{ mr: 1 }}>
          Markering betyder:
        </Typography>
        <Switch
          checked={markMode === "on"}
          onChange={() => setMarkMode(markMode === "on" ? "off" : "on")}
          color="primary"
        />
        <Typography sx={{
          fontWeight: 700,
          color: markMode === "on" ? "#1976d2" : "#ea394f"
        }}>
          {markMode === "on" ? "TÆNDT (grøn)" : "SLUKKET (rød)"}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
        >
          Gem kalender for valgte klienter
        </Button>
      </Box>
      {/* Kalender */}
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
            clientIds={selectedClients}
            markedDays={markedDays}
            markMode={markMode}
            onDayClick={handleDayClick}
          />
        ))}
      </Box>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
