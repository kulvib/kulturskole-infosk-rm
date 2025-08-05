import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Box, Card, CardContent, Typography, Button, CircularProgress, Paper, IconButton,
  Checkbox, FormControlLabel, FormGroup, Switch, Select, MenuItem, Snackbar, Alert
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { getClients } from "../api";
import { useAuth } from "../auth/authcontext";
import DateTimeEditDialog from "./DateTimeEditDialog";

// Helper functions
const monthNames = [
  "August", "September", "Oktober", "November", "December",
  "Januar", "Februar", "Marts", "April", "Maj", "Juni", "Juli"
];
const weekdayNames = ["Ma", "Ti", "On", "To", "Fr", "Lø", "Sø"];

function getSeasons(start = 2025, end = 2040) {
  const seasons = [];
  for (let y = start; y <= end; y++) {
    seasons.push({ label: `${y}/${(y + 1).toString().slice(-2)}`, value: y });
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
function getDefaultTimes(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay(); // 0=søndag, 6=lørdag
  if (day === 0 || day === 6) {
    // Weekend
    return { onTime: "08:00", offTime: "18:00" };
  } else {
    // Hverdag
    return { onTime: "09:00", offTime: "22:30" };
  }
}

// --- INTEGRERET MonthCalendar ---
function MonthCalendar({
  name,
  month,
  year,
  clientIds,
  markedDays,
  markMode,
  onDayClick,
  onDateDoubleClick
}) {
  const [isDragging, setIsDragging] = useState(false);
  const draggedDates = useRef(new Set());

  const daysInMonth = getDaysInMonth(month, year);
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const offset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  // Mouse event handlers
  const handleMouseDown = (dateString) => {
    setIsDragging(true);
    draggedDates.current = new Set([dateString]);
    if (clientIds.length > 0) {
      onDayClick(clientIds, dateString, markMode, markedDays);
    }
  };

  const handleMouseEnter = (dateString) => {
    if (isDragging && clientIds.length > 0 && !draggedDates.current.has(dateString)) {
      draggedDates.current.add(dateString);
      onDayClick(clientIds, dateString, markMode, markedDays);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    draggedDates.current = new Set();
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleUp = () => handleMouseUp();
    window.addEventListener("mouseup", handleUp);
    return () => window.removeEventListener("mouseup", handleUp);
  }, [isDragging]);

  return (
    <Card sx={{ borderRadius: "14px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", minWidth: 0, background: "#f9fafc" }}>
      <CardContent>
        <Typography variant="h6" sx={{ color: "#0a275c", fontWeight: 700, textAlign: "center", fontSize: "1.08rem", mb: 1 }}>
          {name} {year}
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.2, mb: 0.5 }}>
          {weekdayNames.map(wd => (
            <Typography key={wd} variant="caption" sx={{ fontWeight: 700, color: "#555", textAlign: "center", fontSize: "0.90rem", letterSpacing: "0.03em" }}>
              {wd}
            </Typography>
          ))}
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.2 }}>
          {cells.map((day, idx) => {
            if (!day) return <Box key={idx + "-empty"} />;
            const dateString = formatDate(year, month, day);

            // Find markering for alle valgte klienter
            let color = "default";
            clientIds.forEach(cid => {
              if (markedDays?.[cid]?.[dateString]?.status === "on") color = "on";
              if (markedDays?.[cid]?.[dateString]?.status === "off") color = "off";
            });
            let bg = "#fff";
            if (color === "on") bg = "#b4eeb4";
            if (color === "off") bg = "#ffb7b7";

            return (
              <Box key={idx}
                sx={{ display: "flex", justifyContent: "center", alignItems: "center", p: 0.2, position: "relative" }}>
                <Box
                  sx={{
                    width: 23, height: 23, borderRadius: "50%", background: bg,
                    border: "1px solid #eee", color: "#0a275c", fontWeight: 500,
                    fontSize: "0.95rem", textAlign: "center", lineHeight: "23px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                    cursor: clientIds.length > 0 ? "pointer" : "default",
                    transition: "background 0.2s", opacity: clientIds.length > 0 ? 1 : 0.55,
                    ":hover": { boxShadow: "0 0 0 2px #1976d2" }
                  }}
                  title={
                    color === "on"
                      ? "Tændt (dobbeltklik for tid)"
                      : color === "off"
                        ? "Slukket"
                        : ""
                  }
                  onMouseDown={() => handleMouseDown(dateString)}
                  onMouseEnter={() => handleMouseEnter(dateString)}
                  onDoubleClick={() => {
                    if (clientIds.length === 1 && markedDays?.[clientIds[0]]?.[dateString]?.status === "on") {
                      onDateDoubleClick(clientIds[0], dateString);
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
// --- SLUT INTEGRERET MonthCalendar ---

export default function CalendarPage() {
  const { token } = useAuth();
  const [selectedSeason, setSelectedSeason] = useState(2025);
  const [clients, setClients] = useState([]);
  const [selectedClients, setSelectedClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });
  const [markMode, setMarkMode] = useState("on");
  // { [clientId]: { [dateString]: {status: "on"|"off", onTime?: "HH:mm", offTime?: "HH:mm"} } }
  const [markedDays, setMarkedDays] = useState({});

  // Dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDialogDate, setEditDialogDate] = useState(null);
  const [editDialogClient, setEditDialogClient] = useState(null);

  const seasons = getSeasons(2025, 2040);

  // Hent klienter
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

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

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

  // Drag-to-select markering
  const handleDayClick = (clientIds, dateString, mode, markedDays) => {
    setMarkedDays(prev => {
      const updated = { ...prev };
      clientIds.forEach(cid => {
        const current = updated?.[cid]?.[dateString]?.status;
        if (current === mode) {
          // Fjern markering
          delete updated[cid][dateString];
          if (Object.keys(updated[cid]).length === 0) {
            delete updated[cid];
          }
        } else {
          // Sæt markering
          updated[cid] = { ...(updated[cid] || {}), [dateString]: { status: mode } };
        }
      });
      return updated;
    });
  };

  // Dobbeltklik på dato: åbn dialog for custom tid
  const handleDateDoubleClick = (clientId, date) => {
    setEditDialogClient(clientId);
    setEditDialogDate(date);
    setEditDialogOpen(true);
  };

  // Gem custom tid for en specifik dato/klient
  const handleSaveDateTime = ({ clientId, date, onTime, offTime }) => {
    setMarkedDays(prev => {
      const updated = { ...prev };
      if (!updated[clientId]) updated[clientId] = {};
      updated[clientId][date] = {
        ...(updated[clientId][date] || { status: "on" }),
        onTime,
        offTime
      };
      return updated;
    });
    setSnackbar({ open: true, message: "Tider opdateret!", severity: "success" });
  };

  // GEM sender ALLE datoer for valgte klienter, med status og tid
  const handleSave = async () => {
    if (selectedClients.length === 0) {
      setSnackbar({ open: true, message: "Ingen klienter valgt", severity: "warning" });
      return;
    }

    // Saml ALLE datoer i skoleåret
    const allDates = [];
    schoolYearMonths.forEach(({ month, year }) => {
      const daysInMonth = getDaysInMonth(month, year);
      for (let d = 1; d <= daysInMonth; d++) {
        allDates.push(formatDate(year, month, d));
      }
    });

    // Byg markedDays for hver klient: hvis dato er markeret, brug dens status/tid, ellers standard "on" med default tid
    const payloadMarkedDays = {};
    selectedClients.forEach(cid => {
      payloadMarkedDays[cid] = {};
      allDates.forEach(dateStr => {
        if (markedDays[cid] && markedDays[cid][dateStr]) {
          const md = markedDays[cid][dateStr];
          if (md.status === "on") {
            // custom tid eller default tid
            const onTime = md.onTime || getDefaultTimes(dateStr).onTime;
            const offTime = md.offTime || getDefaultTimes(dateStr).offTime;
            payloadMarkedDays[cid][dateStr] = { status: "on", onTime, offTime };
          } else {
            // Slukket
            payloadMarkedDays[cid][dateStr] = { status: "off" };
          }
        } else {
          // Ikke markeret = tændt med default tid
          const { onTime, offTime } = getDefaultTimes(dateStr);
          payloadMarkedDays[cid][dateStr] = { status: "on", onTime, offTime };
        }
      });
    });

    const payload = {
      clients: selectedClients,
      markedDays: payloadMarkedDays,
    };

    try {
      const res = await fetch("/api/push-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      {/* Sæsonvælger */}
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
      {/* Klienter med refresh-knap */}
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
      {/* Switch/kontakt for markering og GEM-knap */}
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
          color: markMode === "on" ? "#43a047" : "#ea394f" // grøn når tændt, rød når slukket
        }}>
          {markMode === "on" ? "TÆNDT" : "SLUKKET"}
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
            onDateDoubleClick={handleDateDoubleClick}
          />
        ))}
      </Box>
      {/* Dialog til redigering af tid */}
      <DateTimeEditDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        date={editDialogDate}
        clientId={editDialogClient}
        customTime={
          editDialogClient && editDialogDate && markedDays[editDialogClient]?.[editDialogDate]
            ? markedDays[editDialogClient][editDialogDate]
            : null
        }
        defaultTimes={
          editDialogDate 
            ? getDefaultTimes(editDialogDate)
            : { onTime: "09:00", offTime: "22:30" }
        }
        onSave={handleSaveDateTime}
      />
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
