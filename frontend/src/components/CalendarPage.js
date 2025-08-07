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
                    <CircularProgress size={18} sx={{ position: "absolute", top: 2, left: 2 }} />
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

  // AUTOSAVE: kør ikke mens dialogen er åben og kun hvis ændret siden sidste dialog-gem
  useEffect(() => {
    if (editDialogOpen) return; // Stop autosave mens dialogen er åben
    if (selectedClients.length === 0 || !activeClient) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    // Kun gem hvis der ER ændringer siden sidst dialog-gem
    const changedSinceDialog =
      !deepEqual(
        markedDays,
        lastDialogSavedMarkedDays.current
      );

    if (!changedSinceDialog) return;

    autoSaveTimer.current = setTimeout(() => {
      handleSave(false); // autosave: vis kun fejl, ikke "Gemt!"
    }, 1000);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
    // eslint-disable-next-line
  }, [markedDays, selectedClients, activeClient, selectedSeason, editDialogOpen]);

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
        // Sæt altid status til valgt mode, uanset nuværende
        updated[cid] = { ...(updated[cid] || {}), [dateString]: { status: mode } };
      });
      return updated;
    });
  };

  // SHIFT+VENSTRE klik handler med 1,5 sek forsinkelse
  const handleDateShiftLeftClick = (clientId, date) => {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
    setLoadingDialogDate(null);
    setLoadingDialogClient(null);

    setTimeout(() => {
      setEditDialogClient(clientId);
      setEditDialogDate(date);
      setEditDialogOpen(true);
    }, 1500);
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

      // Gem den aktuelle markedDays som "sidst gemt via dialog"
      lastDialogSavedMarkedDays.current = { ...markedDays, [clientId]: mapped };
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
        payloadMarkedDays[clientKey] = {};
        allDates.forEach(dateStr => {
          const md = markedDays[cid]?.[dateStr] || markedDays[activeClient]?.[dateStr];
          if (md && md.status === "on") {
            const onTime = md.onTime || getDefaultTimes(dateStr).onTime;
            const offTime = md.offTime || getDefaultTimes(dateStr).offTime;
            payloadMarkedDays[clientKey][dateStr] = {
              status: "on",
              onTime,
              offTime
            };
          } else {
            // ALTID slukket hvis ikke markeret
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
          <Typography variant="body1" sx={{ mt: 2, fontSize: "1.15rem" }}>
            <Box component="span" fontWeight={700}>
              Viser kalender for: {navn}
              {selectedClients.length > 1 && " - "}
            </Box>
            {selectedClients.length > 1 &&
              <>ændringerne slår også igennem på klienterne: {andre}</>
            }
          </Typography>
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
