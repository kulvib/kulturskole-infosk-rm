import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Box, Card, CardContent, Typography, Button, CircularProgress, Paper, IconButton,
  Checkbox, TextField, Snackbar, Alert as MuiAlert
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { getClients, saveMarkedDays, getMarkedDays } from "../api";
import { useAuth } from "../auth/authcontext";
import DateTimeEditDialog from "./DateTimeEditDialog";
import ClientCalendarDialog from "./ClientCalendarDialog"; // <-- Husk denne import!

const monthNames = [
  "August", "September", "Oktober", "November", "December",
  "Januar", "Februar", "Marts", "April", "Maj", "Juni", "Juli"
];
const weekdayNames = ["Ma", "Ti", "On", "To", "Fr", "Lø", "Sø"];

function getSeasons() {
  const now = new Date();
  let seasonStartYear;
  if (now.getMonth() > 7 || (now.getMonth() === 7 && now.getDate() >= 1)) {
    seasonStartYear = now.getFullYear();
  } else {
    seasonStartYear = now.getFullYear() - 1;
  }
  const seasons = [];
  for (let i = 0; i < 3; i++) {
    const start = seasonStartYear + i;
    const end = (start + 1).toString().slice(-2);
    seasons.push({ label: `${start}/${end}`, value: start });
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
  const day = date.getDay();
  if (day === 0 || day === 6) {
    return { onTime: "08:00", offTime: "18:00" };
  } else {
    return { onTime: "09:00", offTime: "22:30" };
  }
}

function stripTimeFromDateKey(key) {
  return key.split("T")[0];
}

function deepEqual(obj1, obj2) {
  return JSON.stringify(obj1) === JSON.stringify(obj2);
}

function ClientSelectorInline({ clients, selected, onChange }) {
  const [search, setSearch] = useState("");
  const sortedClients = useMemo(() => [...clients].sort((a, b) => {
    const aName = (a.locality || a.name || "").toLowerCase();
    const bName = (b.locality || b.name || "").toLowerCase();
    return aName.localeCompare(bName);
  }), [clients]);

  const filteredClients = useMemo(() => sortedClients.filter(c =>
    (c.locality || c.name || "").toLowerCase().includes(search.toLowerCase())
  ), [sortedClients, search]);

  const allVisibleIds = filteredClients.map(c => c.id);
  const allMarked = allVisibleIds.length > 0 && allVisibleIds.every(id => selected.includes(id));

  const handleToggleAll = () => {
    if (allMarked) {
      onChange(selected.filter(id => !allVisibleIds.includes(id)));
    } else {
      const newSelected = Array.from(new Set([...selected, ...allVisibleIds]));
      onChange(newSelected);
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        <TextField
          label="Søg klient"
          variant="outlined"
          size="small"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Button
          sx={{ ml: 2, minWidth: 0, px: 2 }}
          variant={allMarked ? "contained" : "outlined"}
          color={allMarked ? "success" : "primary"}
          onClick={handleToggleAll}
        >
          {allMarked ? "Fjern alle" : "Markér alle"}
        </Button>
      </Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr 1fr", sm: "1fr 1fr 1fr", md: "repeat(5, 1fr)" },
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
            onClick={() => {
              if (selected.includes(client.id)) {
                onChange(selected.filter(sid => sid !== client.id));
              } else {
                onChange([...selected, client.id]);
              }
            }}
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

function MonthCalendar({
  name,
  month,
  year,
  clientId,
  markedDays,
  markMode,
  onDayClick,
  onDateShiftLeftClick,
  loadingDialogDate,
  loadingDialogClient
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

  const handleMouseDown = (e, dateString) => {
    if (e.shiftKey && e.button === 0) {
      e.preventDefault();
      if (
        clientId &&
        markedDays?.[clientId]?.[dateString]?.status === "on" &&
        !loadingDialogDate
      ) {
        onDateShiftLeftClick(clientId, dateString);
        return;
      }
    }
    setIsDragging(true);
    draggedDates.current = new Set([dateString]);
    if (clientId) {
      onDayClick([clientId], dateString, markMode, markedDays);
    }
  };

  const handleMouseEnter = (e, dateString) => {
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
            const isLoading =
              loadingDialogDate === dateString && loadingDialogClient === clientId;

            return (
              <Box key={idx}
                sx={{
                  display: "flex", justifyContent: "center", alignItems: "center", p: 0.2, position: "relative"
                }}>
                <Box
                  sx={{
                    width: 23, height: 23, borderRadius: "50%", background: bg,
                    border: "1px solid #eee", color: "#0a275c", fontWeight: 500,
                    fontSize: "0.95rem", textAlign: "center", lineHeight: "23px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                    cursor: clientId ? "pointer" : "default",
                    transition: "background 0.2s", opacity: clientId ? 1 : 0.55,
                    position: "relative"
                  }}
                  title={
                    cellStatus === "on"
                      ? "Tændt (shift+klik for tid)"
                      : cellStatus === "off"
                        ? "Slukket"
                        : ""
                  }
                  onMouseDown={e => handleMouseDown(e, dateString)}
                  onMouseEnter={e => handleMouseEnter(e, dateString)}
                >
                  {isLoading ? (
                    <CircularProgress size={18} sx={{ position: "absolute", top: 2, left: 2, zIndex: 1201 }} />
                  ) : (
                    day
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      </CardContent>
    </Card>
  );
}

export default function CalendarPage() {
  const { token } = useAuth();
  const [selectedSeason, setSelectedSeason] = useState(getSeasons()[0].value);
  const [clients, setClients] = useState([]);
  const [selectedClients, setSelectedClients] = useState([]);
  const [activeClient, setActiveClient] = useState(null);
  const [loadingClients, setLoadingClients] = useState(false);
  const [markMode, setMarkMode] = useState("on");
  const [markedDays, setMarkedDays] = useState({});
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDialogDate, setEditDialogDate] = useState(null);
  const [editDialogClient, setEditDialogClient] = useState(null);
  const [loadingDialogDate, setLoadingDialogDate] = useState(null);
  const [loadingDialogClient, setLoadingDialogClient] = useState(null);
  const [savingCalendar, setSavingCalendar] = useState(false);
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false); // <-- NY STATE

  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const snackbarTimer = useRef(null);

  const autoSaveTimer = useRef(null);

  const lastDialogSavedMarkedDays = useRef({});
  const lastDialogSavedTimestamp = useRef(0);

  const seasons = getSeasons();

  const fetchClients = useCallback(async () => {
    setLoadingClients(true);
    try {
      const data = await getClients(token);
      const approvedClients = (data?.filter((c) => c.status === "approved") || []).slice();
      setClients(approvedClients);
    } catch {
      setClients([]);
      setSnackbar({ open: true, message: "Kunne ikke hente klienter.", severity: "error" });
    }
    setLoadingClients(false);
  }, [token]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    if (!activeClient) return;
    setMarkedDays(prev => ({ ...prev, [activeClient]: undefined }));
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
          setSnackbar({ open: true, message: "Kunne ikke hente kalender.", severity: "error" });
        }
      });
    return () => { isCurrent = false; };
  }, [selectedSeason, activeClient, token]);

  useEffect(() => {
    if (editDialogOpen) return;
    if (!activeClient) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    const changedSinceDialog =
      !deepEqual(
        markedDays[activeClient],
        lastDialogSavedMarkedDays.current[activeClient]
      );
    if (!changedSinceDialog) return;

    autoSaveTimer.current = setTimeout(() => {
      handleSaveSingleClient(activeClient);
    }, 1000);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [markedDays[activeClient], activeClient, editDialogOpen]);

  const handleSaveSingleClient = async (clientId) => {
    if (!clientId) return;
    const allDates = [];
    getSchoolYearMonths(selectedSeason).forEach(({ month, year }) => {
      const daysInMonth = getDaysInMonth(month, year);
      for (let d = 1; d <= daysInMonth; d++) {
        allDates.push(formatDate(year, month, d));
      }
    });

    const payloadMarkedDays = {};
    payloadMarkedDays[String(clientId)] = {};
    allDates.forEach(dateStr => {
      const md = markedDays[clientId]?.[dateStr];
      if (md && md.status === "on") {
        const onTime = md.onTime || getDefaultTimes(dateStr).onTime;
        const offTime = md.offTime || getDefaultTimes(dateStr).offTime;
        payloadMarkedDays[String(clientId)][dateStr] = {
          status: "on",
          onTime,
          offTime
        };
      } else {
        payloadMarkedDays[String(clientId)][dateStr] = {
          status: "off"
        };
      }
    });

    const payload = {
      clients: [clientId],
      markedDays: payloadMarkedDays,
      season: selectedSeason
    };

    try {
      await saveMarkedDays(payload);
      lastDialogSavedMarkedDays.current = {
        ...lastDialogSavedMarkedDays.current,
        [clientId]: markedDays[clientId]
      };
      lastDialogSavedTimestamp.current = Date.now();
    } catch (e) {
      setSnackbar({ open: true, message: e.message || "Kunne ikke autosave!", severity: "error" });
    }
  };

  const handleClientSelectorChange = (newSelected) => {
    setSelectedClients(newSelected);
    if (!newSelected.includes(activeClient)) {
      setActiveClient(newSelected.length > 0 ? newSelected[newSelected.length - 1] : null);
    }
  };

  const handleDayClick = (clientIds, dateString, mode, markedDays) => {
    setMarkedDays(prev => {
      const updated = { ...prev };
      selectedClients.forEach(cid => {
        updated[cid] = { ...(updated[cid] || {}), [dateString]: { status: mode } };
      });
      return updated;
    });
  };

  const handleDateShiftLeftClick = (clientId, date) => {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
    setLoadingDialogDate(date);
    setLoadingDialogClient(clientId);

    setTimeout(() => {
      setEditDialogClient(clientId);
      setEditDialogDate(date);
      setEditDialogOpen(true);
      setLoadingDialogDate(null);
      setLoadingDialogClient(null);
    }, 1100);
  };

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

      lastDialogSavedMarkedDays.current = {
        ...lastDialogSavedMarkedDays.current,
        [clientId]: mapped
      };
      lastDialogSavedTimestamp.current = Date.now();

      setSnackbar({ open: true, message: "Gemt!", severity: "success" });
    } catch {
      setSnackbar({ open: true, message: "Kunne ikke hente nyeste tider", severity: "error" });
    }
  };

  const schoolYearMonths = useMemo(() => getSchoolYearMonths(selectedSeason), [selectedSeason]);

  const handleSave = useCallback(
    async (showSuccessFeedback = false) => {
      if (selectedClients.length < 2) {
        setSnackbar({ open: true, message: "Vælg mindst to klienter", severity: "error" });
        return;
      }
      if (!activeClient) {
        setSnackbar({ open: true, message: "Ingen aktiv klient valgt", severity: "error" });
        return;
      }
      setSavingCalendar(true);

      const allDates = [];
      schoolYearMonths.forEach(({ month, year }) => {
        const daysInMonth = getDaysInMonth(month, year);
        for (let d = 1; d <= daysInMonth; d++) {
          allDates.push(formatDate(year, month, d));
        }
      });

      const payloadMarkedDays = {};
      selectedClients.forEach(cid => {
        const clientKey = String(cid);
        const sourceMarkedDays = markedDays[activeClient] || {};
        payloadMarkedDays[clientKey] = {};
        allDates.forEach(dateStr => {
          const md = sourceMarkedDays[dateStr];
          if (md && md.status === "on") {
            const onTime = md.onTime || getDefaultTimes(dateStr).onTime;
            const offTime = md.offTime || getDefaultTimes(dateStr).offTime;
            payloadMarkedDays[clientKey][dateStr] = {
              status: "on",
              onTime,
              offTime
            };
          } else {
            payloadMarkedDays[clientKey][dateStr] = {
              status: "off"
            };
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
        if (showSuccessFeedback) {
          setSnackbar({ open: true, message: "Gemt!", severity: "success" });
        }
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
      } finally {
        setSavingCalendar(false);
      }
    }, [selectedClients, activeClient, markedDays, schoolYearMonths, selectedSeason]
  );

  useEffect(() => {
    return () => {
      if (snackbarTimer.current) clearTimeout(snackbarTimer.current);
    };
  }, []);

  const clientMarkedDays = markedDays[activeClient];
  const loadingMarkedDays = activeClient && clientMarkedDays === undefined;

  const activeClientName = activeClient
    ? clients.find(c => c.id === activeClient)?.locality || clients.find(c => c.id === activeClient)?.name || "Automatisk"
    : "Automatisk";
  const otherClientNames = selectedClients.length > 1
    ? clients
        .filter(c => selectedClients.includes(c.id) && c.id !== activeClient)
        .map(c => c.locality || c.name)
        .filter(Boolean)
        .join(", ")
    : "";

  const handleCloseSnackbar = () => {
    setSnackbar({ open: false, message: "", severity: "success" });
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", mt: 4, fontFamily: "inherit" }}>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={2000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <MuiAlert elevation={6} variant="filled" onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </MuiAlert>
      </Snackbar>
      {/* Godkendte klienter øverst */}
      <Typography variant="h6" sx={{ fontWeight: 700, color: "#0a275c", mb: 1 }}>
        Godkendte klienter
      </Typography>
      <Paper elevation={2} sx={{ p: 2, mb: 3, position: "relative", display: "flex", flexDirection: "column" }}>
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
        {selectedClients.length > 1 && (
          <Box sx={{
            mt: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <Box>
              <Typography variant="body2" sx={{ fontSize: "1rem", fontWeight: 700 }}>
                Viser kalender for: {activeClientName} -
              </Typography>
              <Typography variant="body2" sx={{ fontSize: "0.8rem", color: "#555", fontWeight: 400 }}>
                ændringerne slår også igennem på klienterne: {otherClientNames}
              </Typography>
            </Box>
            <Button
              variant="contained"
              color="primary"
              onClick={() => handleSave(true)}
              disabled={savingCalendar || selectedClients.length < 2}
              startIcon={savingCalendar ? <CircularProgress color="inherit" size={20} /> : null}
              sx={{
                boxShadow: selectedClients.length < 2 ? "none" : undefined,
                bgcolor: selectedClients.length < 2 ? "#eee" : undefined,
                color: selectedClients.length < 2 ? "#888" : undefined,
                pointerEvents: selectedClients.length < 2 ? "none" : undefined,
                minWidth: 220,
                ml: 3
              }}
            >
              {savingCalendar ? "Gemmer..." : "Gem kalender for valgte klienter"}
            </Button>
          </Box>
        )}
      </Paper>

      {/* --- NY KNAPLINJE: Vælg sæson | Markering | Vis liste --- */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 2,
          gap: 2,
          flexWrap: "wrap"
        }}
      >
        {/* Venstre: Sæsonvælger */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: "#0a275c", mr: 2 }}>
            Vælg sæson:
          </Typography>
          <select
            value={selectedSeason}
            onChange={e => setSelectedSeason(Number(e.target.value))}
            style={{
              minWidth: 120,
              fontWeight: 700,
              background: "#fff",
              fontSize: "1rem",
              padding: "6px 14px",
              borderRadius: "7px",
              border: "1px solid #dbeafe"
            }}
          >
            {seasons.map(season => (
              <option key={season.value} value={season.value}>
                {season.label}
              </option>
            ))}
          </select>
        </Box>

        {/* Midten: Markering-knapper */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="h6" sx={{ mr: 1, fontWeight: 700 }}>
            Markering
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
        </Box>

        {/* Højre: Vis liste-knap */}
        <Box>
          <Button
            variant="outlined"
            color="primary"
            size="large"
            sx={{ minWidth: 120, fontWeight: 700 }}
            onClick={() => setCalendarDialogOpen(true)}
            disabled={!activeClient}
          >
            Vis liste
          </Button>
        </Box>
      </Box>
      {/* --- SLUT NY KNAPLINJE --- */}

      {/* Kalender */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "2fr 2fr", md
