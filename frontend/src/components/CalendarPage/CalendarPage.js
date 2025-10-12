import React, {
  useState, useEffect, useMemo, useCallback, useRef, useReducer
} from "react";
import {
  Box, Card, CardContent, Typography, Button, CircularProgress, Paper,
  Checkbox, TextField, Snackbar, Alert as MuiAlert, Tooltip, Select, MenuItem, Stack
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { getClients, saveMarkedDays, getMarkedDays, getSchools, getSchoolTimes } from "../../api";
import DateTimeEditDialog from "./DateTimeEditDialog";
import ClientCalendarDialog from "./ClientCalendarDialog";
import { useAuth } from "../../auth/authcontext";

// --------- Hjælpe-hook: Hent ALLE skoletider for alle skoler ---------
function useAllSchoolTimes(schools) {
  const [schoolTimesMap, setSchoolTimesMap] = useState({});
  useEffect(() => {
    if (!schools || schools.length === 0) return;
    let isCurrent = true;
    Promise.all(
      schools.map(s =>
        getSchoolTimes(s.id)
          .then(times => ({ id: s.id, times }))
          .catch(() => ({ id: s.id, times: null }))
      )
    ).then(results => {
      if (!isCurrent) return;
      const map = {};
      results.forEach(({ id, times }) => {
        map[id] = times;
      });
      setSchoolTimesMap(map);
    });
    return () => { isCurrent = false; };
  }, [schools]);
  return schoolTimesMap;
}

const monthNames = [
  "August", "September", "Oktober", "November", "December",
  "Januar", "Februar", "Marts", "April", "Maj", "Juni", "Juli"
];
const weekdayNames = ["Ma", "Ti", "On", "To", "Fr", "Lø", "Sø"];

// -------- Utility Functions --------
function getSeasons() {
  const now = new Date();
  let seasonStartYear = now.getMonth() > 7 || (now.getMonth() === 7 && now.getDate() >= 1)
    ? now.getFullYear()
    : now.getFullYear() - 1;
  return Array.from({ length: 3 }, (_, i) => {
    const start = seasonStartYear + i;
    const end = (start + 1).toString().slice(-2);
    return { label: `${start}/${end}`, value: start };
  });
}
function getSchoolYearMonths(seasonStart) {
  return [
    ...Array.from({ length: 5 }, (_, i) => ({
      name: monthNames[i],
      month: i + 7,
      year: seasonStart,
    })),
    ...Array.from({ length: 7 }, (_, i) => ({
      name: monthNames[i + 5],
      month: i,
      year: seasonStart + 1,
    })),
  ];
}
const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
const formatDate = (year, month, day) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const stripTimeFromDateKey = key => key.split("T")[0];
const deepEqual = (obj1, obj2) => JSON.stringify(obj1) === JSON.stringify(obj2);

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}

function mapRawDays(rawDays) {
  const mapped = {};
  Object.keys(rawDays).forEach(key => {
    mapped[stripTimeFromDateKey(key)] = rawDays[key];
  });
  return mapped;
}

function getSchoolName(schools, client) {
  const schoolId = client.schoolId || client.school_id;
  return schools.find(s => String(s.id) === String(schoolId))?.name || "Ukendt skole";
}

// -------- Hjælpekomponent: Klientvælger --------
const ClientSelectorInline = React.memo(function ClientSelectorInline({
  clients, selected, onChange, schools, disabled, selectedSchool
}) {
  const [search, setSearch] = useState("");
  const sortedClients = useMemo(() => [...clients].sort((a, b) =>
    ((a.locality || a.name || "").toLowerCase())
      .localeCompare((b.locality || b.name || "").toLowerCase())
  ), [clients]);
  const filteredClients = useMemo(() =>
    sortedClients.filter(c =>
      (c.locality || c.name || "").toLowerCase().includes(search.toLowerCase())
    ), [sortedClients, search]);
  const allVisibleIds = filteredClients.map(c => c.id);
  const allMarked = allVisibleIds.length > 0 && allVisibleIds.every(id => selected.includes(id));
  const handleToggleAll = () => {
    if (disabled) return;
    if (allMarked) {
      onChange(selected.filter(id => !allVisibleIds.includes(id)));
    } else {
      onChange(Array.from(new Set([...selected, ...allVisibleIds])));
    }
  };
  return (
    <Box>
      <Box sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        alignItems: { xs: "stretch", sm: "center" },
        mb: 2,
        gap: { xs: 1, sm: 2 }
      }}>
        <TextField
          label="Søg klient"
          variant="outlined"
          size="small"
          value={search}
          onChange={e => setSearch(e.target.value)}
          disabled={disabled}
          sx={{ width: { xs: "100%", sm: 220 } }}
        />
        <Button
          sx={{
            minWidth: 0, px: 2,
            width: { xs: "100%", sm: "auto" }
          }}
          variant={allMarked ? "contained" : "outlined"}
          color={allMarked ? "success" : "primary"}
          onClick={handleToggleAll}
          disabled={disabled}
        >
          {allMarked ? "Fjern alle" : "Markér alle"}
        </Button>
      </Box>
      <Box sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "1fr 1fr",
          md: "repeat(5, 1fr)"
        },
        gap: { xs: 1, sm: 2, md: 2 },
      }}>
        {filteredClients.map(client => (
          <Box
            key={client.id}
            sx={{
              display: "flex",
              alignItems: "center",
              px: { xs: 0.5, sm: 1 },
              py: { xs: 0.5, sm: 0.5 },
              background: selected.includes(client.id) ? "#f0f4ff" : "transparent",
              borderRadius: 1,
              cursor: disabled ? "not-allowed" : "pointer",
              ":hover": { background: disabled ? "transparent" : "#f3f6fa" },
              fontSize: { xs: "0.96rem", sm: "0.96rem", md: "0.875rem" }
            }}
            onClick={() => {
              if (disabled) return;
              onChange(selected.includes(client.id)
                ? selected.filter(sid => sid !== client.id)
                : [...selected, client.id]);
            }}
          >
            <Checkbox
              edge="start"
              checked={selected.includes(client.id)}
              tabIndex={-1}
              disableRipple
              sx={{
                p: 0, pr: 1,
                minWidth: { xs: 32, sm: 28 }
              }}
              inputProps={{ "aria-label": client.locality || client.name || "Ingen lokalitet" }}
              disabled={disabled}
            />
            {selectedSchool
              ? (
                <Typography variant="body2" sx={{
                  fontWeight: 400,
                  fontSize: { xs: "1.05rem", sm: "0.98rem", md: "0.92rem" },
                  lineHeight: 1.18,
                  wordBreak: "break-word"
                }}>
                  {client.locality || client.name || "Ingen lokalitet"}
                </Typography>
              )
              : (
                <Box sx={{ width: "100%" }}>
                  <Typography variant="body2" sx={{
                    fontWeight: 700,
                    fontSize: { xs: "1.05rem", sm: "0.98rem", md: "0.92rem" },
                    lineHeight: 1.18,
                    wordBreak: "break-word"
                  }}>
                    {getSchoolName(schools, client)}
                  </Typography>
                  <Typography variant="body2" sx={{
                    fontWeight: 400,
                    fontSize: { xs: "0.98rem", sm: "0.94rem", md: "0.88rem" },
                    lineHeight: 1.12,
                    wordBreak: "break-word"
                  }}>
                    {client.locality || client.name || "Ingen lokalitet"}
                  </Typography>
                </Box>
              )
            }
          </Box>
        ))}
      </Box>
    </Box>
  );
});

// ----------- markedDaysReducer --------
function markedDaysReducer(state, action) {
  switch (action.type) {
    case "set":
      return { ...state, [action.clientId]: action.days };
    case "updateDay":
      return {
        ...state,
        [action.clientId]: {
          ...(state[action.clientId] || {}),
          [action.date]: action.dayData,
        }
      };
    case "reset":
      return {};
    default:
      return state;
  }
}

// ----------- MAIN COMPONENT START -----------
export default function CalendarPage() {
  const { user } = useAuth();
  const token = null;
  const [selectedSeason, setSelectedSeason] = useState(getSeasons()[0].value);
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState("");
  const [clients, setClients] = useState([]);
  const [selectedClients, setSelectedClients] = useState([]);
  const [activeClient, setActiveClient] = useState(null);
  const [loadingClients, setLoadingClients] = useState(false);
  const [markMode, setMarkMode] = useState("on");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDialogDate, setEditDialogDate] = useState(null);
  const [editDialogClient, setEditDialogClient] = useState(null);
  const [loadingDialogDate, setLoadingDialogDate] = useState(null);
  const [loadingDialogClient, setLoadingDialogClient] = useState(null);
  const [savingCalendar, setSavingCalendar] = useState(false);
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);

  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const snackbarTimer = useRef(null);
  const autoSaveTimer = useRef(null);
  const lastDialogSavedMarkedDays = useRef({});
  const lastDialogSavedTimestamp = useRef(0);

  const seasons = getSeasons();
  const currentSeasonStartYear = useMemo(() => {
    const now = new Date();
    return (now.getMonth() > 7 || (now.getMonth() === 7 && now.getDate() >= 1))
      ? now.getFullYear()
      : now.getFullYear() - 1;
  }, []);

  // Fade animation for sæson-ikon
  const [fadeIn, setFadeIn] = useState(true);
  useEffect(() => {
    let timer;
    if (selectedSeason !== currentSeasonStartYear) {
      timer = setInterval(() => setFadeIn(f => !f), 1200);
    } else {
      setFadeIn(true);
    }
    return () => timer && clearInterval(timer);
  }, [selectedSeason, currentSeasonStartYear]);

  useEffect(() => {
    getSchools(token).then(setSchools).catch(() => setSchools([]));
  }, [token]);
  const allSchoolTimes = useAllSchoolTimes(schools);

  const fetchClients = useCallback(async (showSuccess = false) => {
    setLoadingClients(true);
    try {
      const data = await getClients(token);
      setClients((data?.filter((c) => c.status === "approved") || []));
      if (showSuccess) setSnackbar({ open: true, message: "Opdateret!", severity: "success" });
    } catch {
      setClients([]);
      setSnackbar({ open: true, message: "Kunne ikke hente klienter.", severity: "error" });
    }
    setLoadingClients(false);
  }, [token]);
  useEffect(() => { fetchClients(); }, [fetchClients]);

  const filteredClients = useMemo(() => {
    if (user?.role === "bruger" && user?.school_id) {
      return clients.filter(c => String(c.schoolId || c.school_id) === String(user.school_id));
    }
    return selectedSchool === ""
      ? clients
      : clients.filter(c => String(c.schoolId || c.school_id) === String(selectedSchool));
  }, [clients, selectedSchool, user]);

  useEffect(() => {
    if (user?.role === "bruger" && user?.client_id) {
      const skoleKlienter = filteredClients.map(c => c.id);
      if (!skoleKlienter.includes(selectedClients[0])) {
        setSelectedClients([user.client_id]);
        setActiveClient(user.client_id);
      }
    }
  }, [user, filteredClients]);

  const [markedDays, dispatchMarkedDays] = useReducer(markedDaysReducer, {});

  useEffect(() => {
    if (!activeClient) return;
    dispatchMarkedDays({ type: "set", clientId: activeClient, days: undefined });
    let isCurrent = true;
    getMarkedDays(selectedSeason, activeClient)
      .then(data => {
        if (isCurrent) {
          dispatchMarkedDays({
            type: "set",
            clientId: activeClient,
            days: mapRawDays(data.markedDays || {})
          });
        }
      })
      .catch(() => {
        if (isCurrent) {
          dispatchMarkedDays({
            type: "set",
            clientId: activeClient,
            days: {}
          });
          setSnackbar({ open: true, message: "Kunne ikke hente kalender.", severity: "error" });
        }
      });
    return () => { isCurrent = false; };
  }, [selectedSeason, activeClient, token]);

  useEffect(() => {
    if (editDialogOpen || !activeClient) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    const changedSinceDialog = !deepEqual(
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

  function getDefaultTimes(dateStr, clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return { onTime: "09:00", offTime: "22:30" };
    const schoolId = client.schoolId || client.school_id;
    const schoolTimes = allSchoolTimes[schoolId];
    const date = new Date(dateStr);
    const day = date.getDay();
    const fallback = {
      weekday: { onTime: "09:00", offTime: "22:30" },
      weekend: { onTime: "08:00", offTime: "18:00" }
    };
    const times = schoolTimes || fallback;
    return (day === 0 || day === 6) ? times?.weekend || fallback.weekend : times?.weekday || fallback.weekday;
  }

  const handleDayClick = useCallback((clientIds, dateString, mode, markedDaysState) => {
    clientIds.forEach(cid => {
      dispatchMarkedDays({
        type: "updateDay",
        clientId: cid,
        date: dateString,
        dayData: { status: mode }
      });
    });
  }, []);

  const handleDateShiftLeftClick = useCallback((clientId, date) => {
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
  }, []);

  const handleSaveSingleClient = async (clientId) => {
    if (!clientId) return;
    const allDates = [];
    getSchoolYearMonths(selectedSeason).forEach(({ month, year }) => {
      for (let d = 1; d <= getDaysInMonth(month, year); d++) {
        allDates.push(formatDate(year, month, d));
      }
    });
    const payloadMarkedDays = { [String(clientId)]: {} };
    allDates.forEach(dateStr => {
      const md = markedDays[clientId]?.[dateStr];
      const defTimes = getDefaultTimes(dateStr, clientId);
      payloadMarkedDays[String(clientId)][dateStr] = md && md.status === "on"
        ? { status: "on", onTime: md.onTime || defTimes.onTime, offTime: md.offTime || defTimes.offTime }
        : { status: "off" };
    });
    const payload = { clients: [clientId], markedDays: payloadMarkedDays, season: selectedSeason };
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
    if (user?.role === "bruger") {
      const skoleKlienter = filteredClients.map(c => c.id);
      const kunEgne = newSelected.filter(id => skoleKlienter.includes(id));
      setSelectedClients(kunEgne);
      if (!kunEgne.includes(activeClient)) {
        setActiveClient(kunEgne.length > 0 ? kunEgne[kunEgne.length - 1] : null);
      }
    } else {
      setSelectedClients(newSelected);
      if (!newSelected.includes(activeClient)) {
        setActiveClient(newSelected.length > 0 ? newSelected[newSelected.length - 1] : null);
      }
    }
  };

  const handleSaveDateTime = async ({ date, clientId }) => {
    try {
      const data = await getMarkedDays(selectedSeason, clientId);
      dispatchMarkedDays({
        type: "set",
        clientId: clientId,
        days: mapRawDays(data.markedDays || {})
      });
      lastDialogSavedMarkedDays.current = {
        ...lastDialogSavedMarkedDays.current,
        [clientId]: mapRawDays(data.markedDays || {})
      };
      lastDialogSavedTimestamp.current = Date.now();
      setSnackbar({ open: true, message: "Gemt!", severity: "success" });
    } catch {
      setSnackbar({ open: true, message: "Kunne ikke hente nyeste tider", severity: "error" });
    }
  };

  const schoolYearMonths = useMemo(() => getSchoolYearMonths(selectedSeason), [selectedSeason]);

  const otherClientNames = useMemo(() => (
    selectedClients.length > 1
      ? filteredClients
          .filter(c => selectedClients.includes(c.id) && c.id !== activeClient)
          .map(c => `${c.locality || c.name} – ${getSchoolName(schools, c)}`)
          .filter(Boolean)
          .join("; ")
      : ""
  ), [selectedClients, filteredClients, activeClient, schools]);
  const activeClientName = useMemo(() => (
    activeClient
      ? (() => {
          const c = filteredClients.find(c => c.id === activeClient);
          const schoolName = getSchoolName(schools, c || {});
          return c ? `${c.locality || c.name}${schoolName ? " – " + schoolName : ""}` : "Automatisk";
        })()
      : "Automatisk"
  ), [activeClient, filteredClients, schools]);

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
        for (let d = 1; d <= getDaysInMonth(month, year); d++) {
          allDates.push(formatDate(year, month, d));
        }
      });

      const payloadMarkedDays = {};
      selectedClients.forEach(cid => {
        const clientKey = String(cid);
        payloadMarkedDays[clientKey] = {};
        allDates.forEach(dateStr => {
          const sourceMd = markedDays[activeClient]?.[dateStr];
          const sourceDefTimes = getDefaultTimes(dateStr, activeClient);
          payloadMarkedDays[clientKey][dateStr] = sourceMd && sourceMd.status === "on"
            ? { status: "on", onTime: sourceMd.onTime || sourceDefTimes.onTime, offTime: sourceMd.offTime || sourceDefTimes.offTime }
            : { status: "off" };
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
            dispatchMarkedDays({
              type: "set",
              clientId: activeClient,
              days: mapRawDays(data.markedDays || {})
            });
          } catch (e) {
            dispatchMarkedDays({
              type: "set",
              clientId: activeClient,
              days: {}
            });
          }
        }
        setSavingCalendar(false);
      } catch (e) {
        setSavingCalendar(false);
      }
    }, [selectedClients, activeClient, markedDays, schoolYearMonths, selectedSeason, filteredClients, allSchoolTimes]
  );

  useEffect(() => {
    return () => {
      if (snackbarTimer.current) clearTimeout(snackbarTimer.current);
    };
  }, []);

  const clientMarkedDays = markedDays[activeClient];
  const loadingMarkedDays = activeClient && clientMarkedDays === undefined;
  const handleCloseSnackbar = () => setSnackbar({ open: false, message: "", severity: "success" });
  const isDisabled = !activeClient;
  const sortedSchools = useMemo(() => [...schools].sort((a, b) => a.name.localeCompare(b.name)), [schools]);

  // ----------- RENDER -----------
  return (
    <Box sx={{
      maxWidth: { xs: "100%", sm: 1000, md: 1500 },
      mx: "auto",
      mt: { xs: 1, sm: 4 },
      fontFamily: "inherit",
      px: { xs: 0.5, sm: 2 }
    }}>
      <Box sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        justifyContent: { xs: "center", sm: "flex-end" },
        mb: 2,
        alignItems: "center"
      }}>
        <Tooltip title="Opdater klienter">
          <span>
            <Button
              startIcon={loadingClients ? <CircularProgress size={20} /> : <RefreshIcon />}
              onClick={() => fetchClients(true)}
              disabled={loadingClients}
              sx={{
                minWidth: 0,
                fontWeight: 500,
                textTransform: "none",
                width: { xs: "100%", sm: "auto" }
              }}
            >
              {loadingClients ? "Opdaterer..." : "Opdater"}
            </Button>
          </span>
        </Tooltip>
      </Box>
      {user?.role === "admin" && (
        <Paper elevation={2} sx={{
          p: { xs: 1, sm: 2 },
          mb: 3,
          position: "relative",
          display: "flex",
          flexDirection: "column"
        }}>
          <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" justifyContent="flex-start">
            <Box sx={{
              display: "flex", alignItems: "center", gap: 2, width: { xs: "100%", sm: "auto" }
            }}>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: { xs: "1rem", sm: "1.25rem" } }}>
                Vælg skole:
              </Typography>
              <Select
                size="small"
                value={selectedSchool}
                displayEmpty
                onChange={e => setSelectedSchool(e.target.value)}
                sx={{ minWidth: 140, width: { xs: "100%", sm: 180 } }}
              >
                <MenuItem value="">Alle skoler</MenuItem>
                <MenuItem disabled>--------</MenuItem>
                {sortedSchools.map(school => (
                  <MenuItem key={school.id} value={school.id}>{school.name}</MenuItem>
                ))}
              </Select>
            </Box>
          </Stack>
        </Paper>
      )}
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
      <Paper elevation={2} sx={{
        p: { xs: 1, sm: 2 },
        mb: 3,
        position: "relative",
        display: "flex",
        flexDirection: "column"
      }}>
        {loadingClients && (
          <Box sx={{
            position: "absolute",
            left: 0, top: 0, right: 0, bottom: 0,
            background: "rgba(255,255,255,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10
          }}>
            <CircularProgress />
          </Box>
        )}
        <ClientSelectorInline
          clients={filteredClients}
          selected={selectedClients}
          onChange={handleClientSelectorChange}
          schools={schools}
          disabled={false}
          selectedSchool={selectedSchool}
        />
        {selectedClients.length > 1 && (
          <Box sx={{
            mt: 2,
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { xs: "stretch", sm: "center" },
            justifyContent: "space-between",
            gap: { xs: 1.5, sm: 0 }
          }}>
            <Box>
              <Typography variant="body2" sx={{ fontSize: { xs: "1rem", sm: "1.1rem" }, fontWeight: 700 }}>
                Viser kalender for: {activeClientName}
              </Typography>
              <Typography variant="body2" sx={{
                fontSize: { xs: "0.9rem", sm: "0.8rem" },
                color: "#555", fontWeight: 400
              }}>
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
                minWidth: { xs: "100%", sm: 180 },
                width: { xs: "100%", sm: 220 },
                mt: { xs: 1, sm: 0 }
              }}
            >
              {savingCalendar ? "Gemmer..." : "Gem kalender for valgte klienter"}
            </Button>
          </Box>
        )}
      </Paper>
      <Box sx={{
        display: "flex",
        alignItems: { xs: "stretch", sm: "center" },
        mb: 3,
        flexDirection: { xs: "column", sm: "row" },
        gap: { xs: 1.5, sm: 0 },
        width: "100%",
      }}>
        <Box sx={{
          display: "flex", alignItems: "center", gap: 2, flex: 1,
          justifyContent: { xs: "center", sm: "flex-start" }
        }}>
          <Typography variant="h6" sx={{ mr: 1, fontWeight: 700, fontSize: { xs: "1rem", sm: "1.15rem" } }}>
            Markering:
          </Typography>
          <Button
            variant={markMode === "on" ? "contained" : "outlined"}
            color="success"
            size="medium"
            disabled={isDisabled}
            sx={{ fontWeight: markMode === "on" ? 700 : 400, minWidth: 90 }}
            onClick={() => setMarkMode("on")}
          >
            TÆNDT
          </Button>
          <Button
            variant={markMode === "off" ? "contained" : "outlined"}
            color="error"
            size="medium"
            disabled={isDisabled}
            sx={{ fontWeight: markMode === "off" ? 700 : 400, minWidth: 90 }}
            onClick={() => setMarkMode("off")}
          >
            SLUKKET
          </Button>
        </Box>
        <Box sx={{
          flex: 1, display: "flex", justifyContent: { xs: "center", sm: "center" }, mb: { xs: 1, sm: 0 }
        }}>
          <Button
            variant="outlined"
            color="primary"
            size="medium"
            sx={{
              minWidth: 120,
              fontWeight: 700,
              width: { xs: "100%", sm: 120 }
            }}
            onClick={() => setCalendarDialogOpen(true)}
            disabled={isDisabled}
          >
            Vis liste
          </Button>
        </Box>
        <Box sx={{
          flex: 1,
          display: "flex",
          justifyContent: { xs: "center", sm: "flex-end" },
          alignItems: "center",
          gap: 1
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {selectedSeason !== currentSeasonStartYear && (
              <Tooltip title="Ikke indeværende sæson" arrow>
                <WarningAmberIcon
                  color="warning"
                  sx={{
                    mr: 0.5,
                    transition: "opacity 0.7s",
                    opacity: fadeIn ? 1 : 0.2
                  }}
                />
              </Tooltip>
            )}
          </Box>
          <Typography variant="h6" sx={{
            fontWeight: 700,
            color: "#0a275c",
            mr: 2,
            fontSize: { xs: "1rem", sm: "1.15rem" }
          }}>
            Vælg sæson:
          </Typography>
          <Select
            size="small"
            value={selectedSeason}
            onChange={e => setSelectedSeason(Number(e.target.value))}
            sx={{ minWidth: 100, width: { xs: 100, sm: 120 } }}
            disabled={isDisabled}
          >
            {seasons.map(season => (
              <MenuItem key={season.value} value={season.value}>
                {season.label}
              </MenuItem>
            ))}
          </Select>
        </Box>
      </Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "1fr 1fr",
            md: "repeat(4, 1fr)"
          },
          columnGap: { xs: "0.04rem", sm: "0.08rem", md: "0.08rem" },
          rowGap: { xs: "0.5rem", sm: "0.5rem", md: "0.5rem" },
        }}
      >
        {!activeClient && (
          <Typography sx={{ mt: 4, textAlign: "center", gridColumn: "1/-1" }}>
            Vælg en klient for at se kalenderen.
          </Typography>
        )}
        {activeClient && !loadingMarkedDays &&
          schoolYearMonths.map(({ name, month, year }) => (
            <MemoizedMonthCalendar
              key={name + year}
              name={name}
              month={month}
              year={year}
              clientId={activeClient}
              markedDays={markedDays}
              markMode={markMode}
              onDayClick={handleDayClick}
              onDateShiftLeftClick={handleDateShiftLeftClick}
              loadingDialogDate={loadingDialogDate}
              loadingDialogClient={loadingDialogClient}
            />
          ))
        }
        {activeClient && loadingMarkedDays && (
          <Box sx={{ textAlign: "center", mt: 6, gridColumn: "1/-1" }}>
            <CircularProgress />
            <Typography variant="body2" sx={{ mt: 2 }}>Henter kalender...</Typography>
          </Box>
        )}
      </Box>
      <DateTimeEditDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        date={editDialogDate}
        clientId={editDialogClient}
        onSaved={handleSaveDateTime}
        localMarkedDays={markedDays[editDialogClient]}
      />
      <ClientCalendarDialog
        open={calendarDialogOpen}
        onClose={() => setCalendarDialogOpen(false)}
        clientId={activeClient}
      />
    </Box>
  );
}

// MonthCalendar med native browser tooltip på dagene!
const MonthCalendar = React.memo(function MonthCalendar({
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
  const cells = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, d) => d + 1)
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weekRows = useMemo(() => {
    const rows = [];
    let weekStartIdx = 0;
    while (weekStartIdx < cells.length) {
      const weekDays = cells.slice(weekStartIdx, weekStartIdx + 7);
      let firstDay = weekDays.find(d => !!d);
      let dateObj;
      if (firstDay) {
        dateObj = new Date(year, month, firstDay);
      } else {
        dateObj = new Date(year, month, 1 + weekStartIdx - offset);
      }
      const weekNum = getWeekNumber(dateObj);
      rows.push({ weekNum, weekDays });
      weekStartIdx += 7;
    }
    return rows;
  }, [cells, year, month, offset]);

  const circleSize = 36;
  const innerCircleSize = 32;

  useEffect(() => {
    if (!isDragging) return;
    const handleUp = () => setIsDragging(false);
    window.addEventListener("mouseup", handleUp);
    return () => window.removeEventListener("mouseup", handleUp);
  }, [isDragging]);

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

  return (
    <Card sx={{
      borderRadius: "14px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      minWidth: 0,
      background: "#f9fafc",
      p: { xs: 0.5, sm: 1 },
      userSelect: "none"
    }}>
      <CardContent sx={{ p: { xs: 1, sm: 2 } }}>
        <Typography variant="h6" sx={{
          color: "#0a275c", fontWeight: 700, textAlign: "center",
          fontSize: { xs: "1rem", sm: "1.08rem" }, mb: 1
        }}>
          {name} {year}
        </Typography>
        {/* Ugedage-header: første række i grid, 8 kolonner, venstre tom */}
        <Box sx={{
          display: "grid",
          gridTemplateColumns: "repeat(8, 1fr)",
          columnGap: "0.08rem",
          rowGap: "0.5rem",
          mb: 0.5
        }}>
          <Box />
          {weekdayNames.map(wd => (
            <Typography key={wd} variant="caption" sx={{
              fontWeight: 700,
              color: "#555",
              textAlign: "center",
              fontSize: { xs: "0.82rem", sm: "0.90rem" },
              letterSpacing: "0.03em"
            }}>
              {wd}
            </Typography>
          ))}
        </Box>
        <Box sx={{
          display: "grid",
          gridTemplateRows: `repeat(${weekRows.length}, 1fr)`,
          rowGap: "0.5rem"
        }}>
          {weekRows.map((row, rowIdx) => (
            <Box key={rowIdx}
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(8, 1fr)",
                columnGap: "0.08rem"
              }}>
              <Box sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 400,
                fontSize: { xs: "0.65rem", sm: "0.75rem" },
                color: "#222",
                background: "transparent",
                minWidth: 0,
                mr: { xs: 0, sm: 0 }
              }}>
                {row.weekNum}
              </Box>
              {row.weekDays.map((day, idx) => {
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
                      display: "flex", justifyContent: "center", alignItems: "center",
                      p: 0.2, position: "relative"
                    }}>
                    <Box
                      sx={{
                        position: "relative",
                        width: circleSize,
                        height: circleSize,
                        cursor: clientId ? "pointer" : "default",
                        opacity: clientId ? 1 : 0.55,
                        userSelect: "none"
                      }}
                      onMouseDown={e => handleMouseDown(e, dateString)}
                      onMouseEnter={e => handleMouseEnter(e, dateString)}
                      title={
                        cellStatus === "on"
                          ? "Tændt (shift+klik for tid)"
                          : cellStatus === "off"
                            ? "Slukket"
                            : ""
                      }
                    >
                      {isLoading && (
                        <CircularProgress
                          size={circleSize}
                          sx={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            zIndex: 1,
                            color: "#1976d2",
                            background: "transparent"
                          }}
                        />
                      )}
                      <Box
                        sx={{
                          position: "absolute",
                          top: 2,
                          left: 2,
                          width: innerCircleSize,
                          height: innerCircleSize,
                          borderRadius: "50%",
                          background: bg,
                          border: "1px solid #eee",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#0a275c",
                          fontWeight: 500,
                          fontSize: "1.15rem",
                          zIndex: 2,
                          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                          userSelect: "none"
                        }}
                      >
                        {day}
                      </Box>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
});

const MemoizedMonthCalendar = MonthCalendar;
