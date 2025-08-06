import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Box, Card, CardContent, Typography, Button, CircularProgress, Paper, IconButton,
  Snackbar, Alert, Checkbox, TextField
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { getClients, saveMarkedDays, getMarkedDays } from "../api";
import { useAuth } from "../auth/authcontext";
import DateTimeEditDialog from "./DateTimeEditDialog";

// ---------- Hjælpefunktioner ----------
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
    return { onTime: "08:00", offTime: "18:00" };
  } else {
    return { onTime: "09:00", offTime: "22:30" };
  }
}

function stripTimeFromDateKey(key) {
  return key.split("T")[0];
}

// ---------- ClientSelector ----------
function ClientSelectorInline({ clients, selected, onChange }) {
  const [search, setSearch] = useState("");
  const sortedClients = [...clients].sort((a, b) => {
    const aName = (a.locality || a.name || "").toLowerCase();
    const bName = (b.locality || b.name || "").toLowerCase();
    return aName.localeCompare(bName);
  });
  const filteredClients = sortedClients.filter(c =>
    (c.locality || c.name || "").toLowerCase().includes(search.toLowerCase())
  );
  const handleToggle = (id) => {
    if (selected.includes(id)) {
      onChange(selected.filter(sid => sid !== id));
    } else {
      onChange([...selected, id]);
    }
  };
  return (
    <Box>
      <TextField
        label="Søg klient"
        variant="outlined"
        size="small"
        value={search}
        onChange={e => setSearch(e.target.value)}
        sx={{ mb: 2 }}
      />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
          gap: 1,
        }}
      >
        {filteredClients.map(client => (
          <Box
            key={client.id}
            sx={{
              display: "flex",
              alignItems: "center",
              px: 1,
              py: 0.5,
              background: selected.includes(client.id) ? "#f0f4ff" : "transparent",
              borderRadius: 1,
              cursor: "pointer",
              ":hover": { background: "#f3f6fa" }
            }}
            onClick={() => handleToggle(client.id)}
          >
            <Checkbox
              edge="start"
              checked={selected.includes(client.id)}
              tabIndex={-1}
              disableRipple
              sx={{ p: 0, pr: 1 }}
              inputProps={{ "aria-label": client.locality || client.name || "Ingen lokalitet" }}
            />
            <Typography variant="body2" noWrap>
              {client.locality || client.name || "Ingen lokalitet"}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ---------- MonthCalendar ----------
function MonthCalendar({
  name,
  month,
  year,
  clientId,
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

  const handleMouseDown = (dateString) => {
    setIsDragging(true);
    draggedDates.current = new Set([dateString]);
    if (clientId) {
      onDayClick([clientId], dateString, markMode, markedDays);
    }
  };

  const handleMouseEnter = (dateString) => {
    if (isDragging && clientId && !draggedDates.current.has(dateString)) {
      draggedDates.current.add(dateString);
      onDayClick([clientId], dateString, markMode, markedDays);
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
            const cellStatus = markedDays?.[clientId]?.[dateString]?.status || "off";
            let bg = "#fff";
            if (cellStatus === "on") bg = "#b4eeb4";
            if (cellStatus === "off") bg = "#ffb7b7";
            return (
              <Box key={idx}
                sx={{ display: "flex", justifyContent: "center", alignItems: "center", p: 0.2, position: "relative" }}>
                <Box
                  sx={{
                    width: 23, height: 23, borderRadius: "50%", background: bg,
                    border: "1px solid #eee", color: "#0a275c", fontWeight: 500,
                    fontSize: "0.95rem", textAlign: "center", lineHeight: "23px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                    cursor: clientId ? "pointer" : "default",
                    transition: "background 0.2s", opacity: clientId ? 1 : 0.55,
                    ":hover": { boxShadow: "0 0 0 2px #1976d2" }
                  }}
                  title={
                    cellStatus === "on"
                      ? "Tændt (dobbeltklik for tid)"
                      : cellStatus === "off"
                        ? "Slukket"
                        : ""
                  }
                  onMouseDown={() => handleMouseDown(dateString)}
                  onMouseEnter={() => handleMouseEnter(dateString)}
                  onDoubleClick={() => {
                    // Åben dialog KUN hvis status er "on"
                    if (clientId && markedDays?.[clientId]?.[dateString]?.status === "on") {
                      onDateDoubleClick(clientId, dateString);
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

// ---------- CalendarPage ----------
export default function CalendarPage() {
  const { token } = useAuth();
  const [selectedSeason, setSelectedSeason] = useState(2025);
  const [clients, setClients] = useState([]);
  const [selectedClients, setSelectedClients] = useState([]);
  const [activeClient, setActiveClient] = useState(null);
  const [loadingClients, setLoadingClients] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });
  const [markMode, setMarkMode] = useState("on");
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

  // Hent markeringer for KUN activeClient og selectedSeason
  useEffect(() => {
    if (!activeClient) return;
    setMarkedDays(prev => ({ ...prev, [activeClient]: undefined })); // Nulstil mens vi loader
    let isCurrent = true;
    getMarkedDays(selectedSeason, activeClient)
      .then(data => {
        if (isCurrent) {
          const rawDays = data.markedDays || {};
          const mapped = {};
          Object.keys(rawDays).forEach(key => {
            mapped[stripTimeFromDateKey(key)] = rawDays[key];
          });
          setMarkedDays(prev => ({
            ...prev,
            [activeClient]: mapped
          }));
        }
      })
      .catch(() => {
        if (isCurrent) {
          setMarkedDays(prev => ({
            ...prev,
            [activeClient]: {}
          }));
        }
      });
    return () => { isCurrent = false; };
  }, [selectedSeason, activeClient, token]);

  // ClientSelector integration
  const handleClientSelectorChange = (newSelected) => {
    setSelectedClients(newSelected);
    // Sæt aktiv klient til den senest valgte, hvis den forrige ikke længere er valgt
    if (!newSelected.includes(activeClient)) {
      setActiveClient(newSelected.length > 0 ? newSelected[newSelected.length - 1] : null);
    }
  };

  // Drag-to-select markering for kun activeClient
  const handleDayClick = (clientIds, dateString, mode, markedDays) => {
    setMarkedDays(prev => {
      const updated = { ...prev };
      clientIds.forEach(cid => {
        const current = updated?.[cid]?.[dateString]?.status;
        if (current === mode) {
          delete updated[cid][dateString];
          if (Object.keys(updated[cid]).length === 0) {
            delete updated[cid];
          }
        } else {
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

  // Når tid gemmes i dialogen: hent ALTID nyeste markedDays fra backend for klienten
  const handleSaveDateTime = async ({ date, clientId }) => {
    try {
      const data = await getMarkedDays(selectedSeason, clientId);
      const rawDays = data.markedDays || {};
      const mapped = {};
      Object.keys(rawDays).forEach(key => {
        mapped[stripTimeFromDateKey(key)] = rawDays[key];
      });
      setMarkedDays(prev => ({
        ...prev,
        [clientId]: mapped
      }));
      setSnackbar({ open: true, message: "Tid opdateret", severity: "success" });
    } catch {
      setSnackbar({ open: true, message: "Kunne ikke hente nyeste tider", severity: "error" });
    }
  };

  // GEM: Gem den viste kalender (activeClient) på ALLE markerede klienter
  const schoolYearMonths = getSchoolYearMonths(selectedSeason);

  const handleSave = async () => {
    if (selectedClients.length === 0) {
      setSnackbar({ open: true, message: "Ingen klienter valgt", severity: "warning" });
      return;
    }
    if (!activeClient) {
      setSnackbar({ open: true, message: "Ingen aktiv klient valgt", severity: "warning" });
      return;
    }

    const allDates = [];
    schoolYearMonths.forEach(({ month, year }) => {
      const daysInMonth = getDaysInMonth(month, year);
      for (let d = 1; d <= daysInMonth; d++) {
        allDates.push(formatDate(year, month, d));
      }
    });

    const baseMarked = markedDays[activeClient] || {};

    const payloadMarkedDays = {};
    selectedClients.forEach(cid => {
      payloadMarkedDays[cid] = {};
      allDates.forEach(dateStr => {
        if (baseMarked[dateStr]) {
          const md = baseMarked[dateStr];
          if (md.status === "on") {
            // Bruges altid den aktuelle tid fra state, som er opdateret fra backend efter evt. dialog-redigering
            const onTime = md.onTime || getDefaultTimes(dateStr).onTime;
            const offTime = md.offTime || getDefaultTimes(dateStr).offTime;
            payloadMarkedDays[cid][dateStr] = { status: "on", onTime, offTime };
          } else {
            payloadMarkedDays[cid][dateStr] = { status: "off" };
          }
        } else {
          payloadMarkedDays[cid][dateStr] = { status: "off" };
        }
      });
    });

    const payload = {
      clients: selectedClients,
      markedDays: payloadMarkedDays,
      season: selectedSeason
    };

    try {
      await saveMarkedDays(payload);
      setSnackbar({ open: true, message: "Gemt!", severity: "success" });
      if (activeClient) {
        try {
          const data = await getMarkedDays(selectedSeason, activeClient);
          const rawDays = data.markedDays || {};
          const mapped = {};
          Object.keys(rawDays).forEach(key => {
            mapped[stripTimeFromDateKey(key)] = rawDays[key];
          });
          setMarkedDays(prev => ({
            ...prev,
            [activeClient]: mapped
          }));
        } catch (e) {
          setMarkedDays(prev => ({
            ...prev,
            [activeClient]: {}
          }));
        }
      }
    } catch (e) {
      setSnackbar({ open: true, message: e.message || "Kunne ikke gemme!", severity: "error" });
    }
  };

  const clientMarkedDays = markedDays[activeClient];
  const loadingMarkedDays = activeClient && clientMarkedDays === undefined;

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", mt: 4, fontFamily: "inherit" }}>
      {/* Sæsonvælger */}
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: "#0a275c" }}>
            Vælg Sæson:
          </Typography>
          <select
            value={selectedSeason}
            onChange={e => setSelectedSeason(Number(e.target.value))}
            style={{ minWidth: 120, fontWeight: 700, background: "#fff", fontSize: "1rem", padding: "2px 8px" }}
          >
            {seasons.map(season => (
              <option key={season.value} value={season.value}>
                {season.label}
              </option>
            ))}
          </select>
        </Box>
      </Paper>

      {/* Klientvælger inline med Refresh-knap i hjørnet */}
      <Paper elevation={2} sx={{ p: 2, mb: 3, position: "relative" }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: "#0a275c", mb: 1 }}>
          Godkendte klienter
        </Typography>
        {/* Refresh-knap oppe i højre hjørne */}
        <IconButton
          aria-label="Opdater klienter"
          onClick={fetchClients}
          disabled={loadingClients}
          sx={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 2,
            background: "#fff",
            border: "1px solid #dbeafe",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)"
          }}
        >
          <RefreshIcon />
          {loadingClients && (
            <CircularProgress
              size={32}
              sx={{ color: "#1976d2", position: "absolute", left: 4, top: 4, zIndex: 1 }}
            />
          )}
        </IconButton>
        <ClientSelectorInline
          clients={clients}
          selected={selectedClients}
          onChange={handleClientSelectorChange}
        />
        <Typography variant="body2" sx={{ mt: 2 }}>
          Viser kalender for: <b>{clients.find(c => c.id === activeClient)?.locality || clients.find(c => c.id === activeClient)?.name || "Ingen valgt"}</b>
        </Typography>
      </Paper>

      {/* Switch/kontakt for markering og GEM-knap */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 2, gap: 2 }}>
        <Typography sx={{ mr: 1 }}>
          Markering betyder:
        </Typography>
        <Button
          variant={markMode === "on" ? "contained" : "outlined"}
          color="success"
          onClick={() => setMarkMode("on")}
          sx={{ fontWeight: markMode === "on" ? 700 : 400 }}
        >
          TÆNDT
        </Button>
        <Button
          variant={markMode === "off" ? "contained" : "outlined"}
          color="error"
          onClick={() => setMarkMode("off")}
          sx={{ fontWeight: markMode === "off" ? 700 : 400 }}
        >
          SLUKKET
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
        >
          Gem kalender for valgte klienter
        </Button>
      </Box>

      {/* Kalender for én (sidst markeret) klient */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "2fr 2fr", md: "repeat(4, 1fr)" },
          gap: 3,
        }}
      >
        {!activeClient && (
          <Typography sx={{ mt: 4, textAlign: "center", gridColumn: "1/-1" }}>
            Vælg en klient for at se kalenderen.
          </Typography>
        )}
        {activeClient && loadingMarkedDays && (
          <Box sx={{ textAlign: "center", mt: 6, gridColumn: "1/-1" }}>
            <CircularProgress />
            <Typography variant="body2" sx={{ mt: 2 }}>Henter kalender...</Typography>
          </Box>
        )}
        {activeClient && !loadingMarkedDays &&
          getSchoolYearMonths(selectedSeason).map(({ name, month, year }) => (
            <MonthCalendar
              key={name + year}
              name={name}
              month={month}
              year={year}
              clientId={activeClient}
              markedDays={markedDays}
              markMode={markMode}
              onDayClick={handleDayClick}
              onDateDoubleClick={handleDateDoubleClick}
            />
          ))
        }
      </Box>

      {/* Dialog til redigering af tid */}
      <DateTimeEditDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        date={editDialogDate}
        clientId={editDialogClient}
        onSaved={handleSaveDateTime}
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
