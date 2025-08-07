import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Box, Card, CardContent, Typography, Button, CircularProgress, Paper, IconButton,
  Alert, Checkbox, TextField
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { getClients, saveMarkedDays, getMarkedDays } from "../api";
import { useAuth } from "../auth/authcontext";
import DateTimeEditDialog from "./DateTimeEditDialog";

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

// Helper for deep comparison of markedDays objects
function deepEqual(obj1, obj2) {
  return JSON.stringify(obj1) === JSON.stringify(obj2);
}

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
    // SHIFT+VENSTRE klik åbner dialogen (hvis status "on")
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
    // Ellers start drag markering
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
  const [selectedSeason, setSelectedSeason] = useState(2025);
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

  // Feedback state for gemt/fejl
  const [saveStatus, setSaveStatus] = useState({ status: "idle", message: "" });
  const saveIndicatorTimer = useRef(null);

  const autoSaveTimer = useRef(null);

  // Holder den sidst gemte markedDays fra dialogen
  const lastDialogSavedMarkedDays = useRef({});
  const lastDialogSavedTimestamp = useRef(0);

  const seasons = getSeasons(2025, 2040);

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
        }
      });
    return () => { isCurrent = false; };
  }, [selectedSeason, activeClient, token]);

  // AUTOSAVE: Kun for aktiv klient!
  useEffect(() => {
    if (editDialogOpen) return; // Stop autosave mens dialogen er åben
    if (!activeClient) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    // Gem kun hvis der ER ændringer siden sidst dialog-gem for den aktive klient
    const changedSinceDialog =
      !deepEqual(
        markedDays[activeClient],
        lastDialogSavedMarkedDays.current[activeClient]
      );
    if (!changedSinceDialog) return;

    autoSaveTimer.current = setTimeout(() => {
      handleSaveSingleClient(activeClient); // autosave: kun for aktiv klient
    }, 1000);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
    // eslint-disable-next-line
  }, [markedDays[activeClient], activeClient, editDialogOpen]);

  // Gem kun for én klient (autosave)
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
      // Opdater sidst gemte
      lastDialogSavedMarkedDays.current = {
        ...lastDialogSavedMarkedDays.current,
        [clientId]: markedDays[clientId]
      };
      lastDialogSavedTimestamp.current = Date.now();
    } catch (e) {
      setSaveStatus({ status: "error", message: e.message || "Kunne ikke autosave!" });
    }
  };

  const handleClientSelectorChange = (newSelected) => {
    setSelectedClients(newSelected);
    if (!newSelected.includes(activeClient)) {
      setActiveClient(newSelected.length > 0 ? newSelected[newSelected.length - 1] : null);
    }
  };

  // Brugeren kan kun markere med den valgte farve; ingen neutrale felter!
  const handleDayClick = (clientIds, dateString, mode, markedDays) => {
    setMarkedDays(prev => {
      const updated = { ...prev };
      selectedClients.forEach(cid => {
        updated[cid] = { ...(updated[cid] || {}), [dateString]: { status: mode } };
      });
      return updated;
    });
  };

  // SHIFT+VENSTRE klik handler med 1,1 sek forsinkelse og loader!
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

  // Opdater localMarkedDays for dialogen efter gem
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

      setSaveStatus({ status: "success", message: "Gemt" });
      if (saveIndicatorTimer.current) clearTimeout(saveIndicatorTimer.current);
      saveIndicatorTimer.current = setTimeout(() => {
        setSaveStatus({ status: "idle", message: "" });
      }, 2000);
    } catch {
      setSaveStatus({ status: "error", message: "Kunne ikke hente nyeste tider" });
    }
  };

  const schoolYearMonths = getSchoolYearMonths(selectedSeason);

  // GEM FOR ALLE KLIENTER: De andre klienter får data fra activeClient!
  const handleSave = useCallback(
    async (showSuccessFeedback = false) => {
      if (showSuccessFeedback) setSaveStatus({ status: "idle", message: "" });
      if (selectedClients.length === 0) {
        setSaveStatus({ status: "error", message: "Ingen klienter valgt" });
        return;
      }
      if (!activeClient) {
        setSaveStatus({ status: "error", message: "Ingen aktiv klient valgt" });
        return;
      }

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
        // Kopier markedDays fra activeClient hvis ikke aktiv
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
          setSaveStatus({ status: "success", message: "Gemt" });
          if (saveIndicatorTimer.current) clearTimeout(saveIndicatorTimer.current);
          saveIndicatorTimer.current = setTimeout(() => {
            setSaveStatus({ status: "idle", message: "" });
          }, 2000);
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
        setSaveStatus({ status: "error", message: e.message || "Kunne ikke gemme!" });
      }
    }, [selectedClients, activeClient, markedDays, schoolYearMonths, selectedSeason]
  );

  useEffect(() => {
    return () => {
      if (saveIndicatorTimer.current) clearTimeout(saveIndicatorTimer.current);
    };
  }, []);

  const clientMarkedDays = markedDays[activeClient];
  const loadingMarkedDays = activeClient && clientMarkedDays === undefined;

  const navn = activeClient
    ? clients.find(c => c.id === activeClient)?.locality || clients.find(c => c.id === activeClient)?.name || "Ingen valgt"
    : "";
  const andre = selectedClients.length > 1
    ? clients
        .filter(c => selectedClients.includes(c.id) && c.id !== activeClient)
        .map(c => c.locality || c.name)
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", mt: 4, fontFamily: "inherit" }}>
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

      <Paper elevation={2} sx={{ p: 2, mb: 3, position: "relative" }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: "#0a275c", mb: 1 }}>
          Godkendte klienter
        </Typography>
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
        {activeClient && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ fontSize: "1rem", fontWeight: 700 }}>
              Viser kalender for: {navn}
              {selectedClients.length > 1 && " - "}
            </Typography>
            {selectedClients.length > 1 && (
              <Typography variant="body2" sx={{ fontSize: "0.8rem", color: "#555", fontWeight: 400 }}>
                ændringerne slår også igennem på klienterne: {andre}
              </Typography>
            )}
          </Box>
        )}
      </Paper>

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
        <Box sx={{ display: "flex", alignItems: "center", mr: 2, minWidth: 55 }}>
          {saveStatus.status === "success" && (
            <Typography
              sx={{
                color: "#388e3c",
                fontWeight: 600,
                fontSize: "1rem",
                transition: "opacity 0.3s",
                opacity: 1
              }}
            >
              Gemt
            </Typography>
          )}
          {saveStatus.status === "error" && (
            <Alert severity="error" sx={{ mr: 1, py: 0.5, px: 2, fontSize: 14 }}>
              {saveStatus.message}
            </Alert>
          )}
        </Box>
        <Button
          variant="contained"
          color="primary"
          onClick={() => handleSave(true)}
        >
          Gem kalender for valgte klienter
        </Button>
      </Box>

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
    </Box>
  );
}
