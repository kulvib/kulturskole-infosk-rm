import React, { useState, useEffect, useRef } from "react";
import {
  Card, CardContent, Typography, Box, ToggleButtonGroup, ToggleButton,
  Tooltip, Button, Snackbar, Alert, useTheme,
  CircularProgress, TextField
} from "@mui/material";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import PowerOffIcon from "@mui/icons-material/PowerOff";
import SaveIcon from "@mui/icons-material/Save";

// Helper til at generere sæsoner fra 2024/25 til 2050/51
function getSeasons() {
  const startYear = 2024;
  const endYear = 2050;
  const seasons = [];
  for (let y = startYear; y <= endYear; y++) {
    seasons.push({
      label: `Sæson ${y}/${(y + 1).toString().slice(-2)}`,
      value: y,
    });
  }
  return seasons;
}

function getSchoolYearMonths(startYear) {
  const months = [];
  for (let i = 0; i < 5; i++) {
    months.push({
      name: monthNames[i],
      month: i + 7,
      year: startYear
    });
  }
  for (let i = 5; i < 12; i++) {
    months.push({
      name: monthNames[i],
      month: i - 5,
      year: startYear + 1
    });
  }
  return months;
}

function getDaysInMonth(month, year) {
  return new Date(year, month + 1, 0).getDate();
}

const monthNames = [
  "August", "September", "Oktober", "November", "December",
  "Januar", "Februar", "Marts", "April", "Maj", "Juni", "Juli"
];

// Login-komponent (JWT)
function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
      });
      if (!res.ok) throw new Error("Login fejlede");
      const data = await res.json();
      onLogin(data.access_token);
    } catch (err) {
      setError("Login fejlede!");
    }
  };
  return (
    <Box sx={{ mt: 6, maxWidth: 320, mx: "auto" }}>
      <Card>
        <CardContent>
          <Typography variant="h5" sx={{ mb: 2, textAlign: "center" }}>Login (admin)</Typography>
          <form onSubmit={handleSubmit}>
            <TextField
              label="Brugernavn"
              value={username}
              onChange={e => setUsername(e.target.value)}
              fullWidth
              margin="normal"
              autoComplete="username"
            />
            <TextField
              label="Kodeord"
              value={password}
              onChange={e => setPassword(e.target.value)}
              type="password"
              fullWidth
              margin="normal"
              autoComplete="current-password"
            />
            <Button type="submit" variant="contained" color="primary" fullWidth sx={{ mt: 2 }}>Login</Button>
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}

// WebSocket live-opdatering hook
function useClientLiveWebSocket({ url, onUpdate }) {
  useEffect(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      // Send besked ved åbning, så serveren holder forbindelsen åben
      ws.send("frontend connected!");
    };

    ws.onmessage = (event) => {
      if (event.data === "update" && typeof onUpdate === "function") {
        onUpdate();
      }
    };

    ws.onerror = (event) => {
      // evt. log fejl
    };

    ws.onclose = (event) => {
      // evt. reconnect logic
    };

    // Cleanup ved unmount
    return () => {
      ws.close();
    };
  }, [url, onUpdate]);
}

export default function CalendarView() {
  const theme = useTheme();
  const seasons = getSeasons();
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [selectedSeason, setSelectedSeason] = useState(seasons[0].value);
  const [schoolYearMonths, setSchoolYearMonths] = useState(getSchoolYearMonths(seasons[0].value));
  const [markedDaysByClient, setMarkedDaysByClient] = useState({});
  const [mode, setMode] = useState("on");
  const [dragging, setDragging] = useState(false);
  const [dragMode, setDragMode] = useState(null);
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackError, setSnackError] = useState("");
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const dragDaysRef = useRef(new Set());
  const [activeClientId, setActiveClientId] = useState(null);

  useEffect(() => {
    setSchoolYearMonths(getSchoolYearMonths(selectedSeason));
  }, [selectedSeason]);

  // Login-token gem til localStorage
  useEffect(() => {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  }, [token]);

  // Funktion til at hente klientlisten via API
  const loadClients = async () => {
    setLoadingClients(true);
    try {
      const res = await fetch("/api/clients/", {
        headers: { Authorization: "Bearer " + token }
      });
      if (res.status === 401) {
        setToken("");
        setClients([]);
        setLoadingClients(false);
        return;
      }
      const data = await res.json();
      const approvedClients = Array.isArray(data)
        ? data.filter(cli => cli.status === "approved")
        : [];
      setClients(approvedClients);
    } catch (err) {
      setClients([]);
    }
    setLoadingClients(false);
  };

  // Hent alle godkendte klienter ved start og ved login
  useEffect(() => {
    if (token) loadClients();
  }, [token]);

  // WebSocket live-opdatering: Hent klienter ved "update"
  useClientLiveWebSocket({
    url: "wss://kulturskole-infosk-rm.onrender.com/ws/clients",
    onUpdate: () => {
      loadClients();
    }
  });

  // Sæt første aktive klient ved load
  useEffect(() => {
    if (clients.length > 0 && (activeClientId === null || !clients.some(c => c.id === activeClientId))) {
      setActiveClientId(clients[0].id);
    }
  }, [clients, activeClientId]);

  // Hent markeringer for valgt sæson og alle godkendte klienter
  useEffect(() => {
    if (!token || !clients.length) {
      setMarkedDaysByClient({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const allData = {};
        for (const client of clients) {
          const query = `?season=${selectedSeason}&client_id=${client.id}`;
          const res = await fetch("/api/calendar/marked-days" + query, {
            headers: { "Authorization": "Bearer " + token }
          });
          if (!res.ok) continue;
          const json = await res.json();
          allData[client.id] = json.markedDays || {};
        }
        if (!cancelled) setMarkedDaysByClient(allData);
      } catch (e) {
        if (!cancelled) setMarkedDaysByClient({});
      }
    })();
    return () => { cancelled = true; };
  }, [selectedSeason, clients, token]);

  const markedDays = markedDaysByClient[activeClientId] || {};

  const handleClientClick = (clientId) => {
    setActiveClientId(clientId);
  };

  const handleDayClick = (year, month, day) => {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setMarkedDaysByClient(prev => ({
      ...prev,
      [activeClientId]: {
        ...prev[activeClientId],
        [key]: prev[activeClientId]?.[key] === mode ? undefined : mode
      }
    }));
  };

  const handleDayMouseDown = (year, month, day, status) => {
    setDragging(true);
    setDragMode(status === mode ? "unmark" : "mark");
    dragDaysRef.current = new Set();
    handleDayMouseOver(year, month, day);
  };

  const handleDayMouseOver = (year, month, day) => {
    if (!dragging) return;
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    dragDaysRef.current.add(key);
    setMarkedDaysByClient(prev => {
      const updated = { ...prev };
      const clientMarkedDays = { ...updated[activeClientId] };
      dragDaysRef.current.forEach(k => {
        if (dragMode === "mark") clientMarkedDays[k] = mode;
        else if (dragMode === "unmark") clientMarkedDays[k] = undefined;
      });
      updated[activeClientId] = clientMarkedDays;
      return updated;
    });
  };

  const handleMouseUp = () => {
    setDragging(false);
    dragDaysRef.current = new Set();
    setDragMode(null);
  };

  useEffect(() => {
    if (!dragging) return;
    const onUp = () => handleMouseUp();
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [dragging]);

  const handleSave = async () => {
    setSnackError("");
    if (!clients.length || !activeClientId) {
      setSnackError("Ingen godkendte klienter!");
      return;
    }
    try {
      const res = await fetch("/api/calendar/marked-days", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
          markedDays: markedDays,
          clients: [activeClientId],
          season: selectedSeason
        })
      });
      if (!res.ok) throw new Error("Kunne ikke gemme markeringer");
      setSnackOpen(true);
    } catch (err) {
      setSnackError(err.message);
    }
  };

  // CSS-in-JS styling
  const monthCardSx = {
    background: "#fff",
    borderRadius: "14px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    aspectRatio: "1 / 1",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  };
  const dayBtnBase = {
    margin: "0.5px",
    userSelect: "none",
    minWidth: 0,
    width: "1.7em",
    height: "1.7em",
    px: 0.2,
    py: 0.2,
    borderRadius: "50%",
    borderWidth: 1,
    fontWeight: 600,
    fontSize: "0.9rem",
    boxShadow: 1,
    lineHeight: 1,
    m: "auto",
    transition: "background 0.2s",
    cursor: "pointer",
  };
  const dayBtnStatus = {
    on: { background: "#e8f5e9 !important", color: "#388e3c !important", borderColor: "#388e3c" },
    off: { background: "#ffebee !important", color: "#d32f2f !important", borderColor: "#d32f2f" },
    default: { background: "inherit", color: "#333", borderColor: "#ddd" }
  };
  const legendDotBase = {
    display: "inline-block",
    width: 18,
    height: 18,
    borderRadius: "50%",
    marginRight: 6,
    verticalAlign: "middle",
    border: "2px solid #888",
  };
  const legendDotStatus = {
    on: { background: "#388e3c", borderColor: "#388e3c" },
    off: { background: "#d32f2f", borderColor: "#d32f2f" },
    default: {}
  };

  if (!token) {
    return <Login onLogin={setToken} />;
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", mt: 4, fontFamily: theme.typography.fontFamily }}>
      {/* Top-bar: Vis alle godkendte klienter som knapper */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Vælg klient for redigering:
        </Typography>
        {loadingClients && <CircularProgress size={22} sx={{ mr: 2 }} />}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {clients.length === 0 && !loadingClients &&
            <Typography>Ingen godkendte klienter</Typography>
          }
          {clients.map(cli => (
            <Button
              key={cli.id}
              variant={cli.id === activeClientId ? "contained" : "outlined"}
              color={cli.id === activeClientId ? "primary" : "inherit"}
              onClick={() => handleClientClick(cli.id)}
              sx={{
                fontWeight: 700,
                minWidth: 110,
                borderRadius: 3,
                background: cli.id === activeClientId ? "#e9f7fb" : undefined,
                boxShadow: cli.id === activeClientId ? 2 : 0
              }}
            >
              {cli.name}
            </Button>
          ))}
        </Box>
      </Box>
      {/* Marker arbejdsdage og gem */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 2, gap: 2 }}>
        <Card sx={{ minWidth: 260, background: "#e9f7fb", border: "1px solid #036" }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Marker arbejdsdage som
            </Typography>
            <ToggleButtonGroup
              exclusive
              value={mode}
              onChange={(e, val) => val && setMode(val)}
              size="small"
            >
              <ToggleButton value="on" sx={{ color: "#388e3c", fontWeight: 700 }}>
                <PowerSettingsNewIcon sx={{ color: "#388e3c", mr: 1 }} />
                Tænd klient
              </ToggleButton>
              <ToggleButton value="off" sx={{ color: "#d32f2f", fontWeight: 700 }}>
                <PowerOffIcon sx={{ color: "#d32f2f", mr: 1 }} />
                Sluk klient
              </ToggleButton>
            </ToggleButtonGroup>
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: "inline-flex", alignItems: "center", mr: 2 }}>
                <Box sx={{ ...legendDotBase, ...legendDotStatus.on }} />
                <Typography variant="body2" sx={{ color: "#388e3c" }}>Tænd klient</Typography>
              </Box>
              <Box sx={{ display: "inline-flex", alignItems: "center" }}>
                <Box sx={{ ...legendDotBase, ...legendDotStatus.off }} />
                <Typography variant="body2" sx={{ color: "#d32f2f" }}>Sluk klient</Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          color="primary"
          sx={{ height: 48, fontWeight: 700, boxShadow: 2 }}
          onClick={handleSave}
          disabled={!activeClientId}
        >
          Gem markeringer
        </Button>
      </Box>
      {/* Sæsonvælger */}
      <Box sx={{ mb: 3 }}>
        <Typography component="label" htmlFor="seasonSelect" sx={{ fontWeight: 600 }}>
          Vælg sæson:
        </Typography>{" "}
        <select
          id="seasonSelect"
          value={selectedSeason}
          onChange={e => setSelectedSeason(Number(e.target.value))}
          style={{
            padding: "6px 12px",
            fontSize: "1rem",
            fontWeight: "bold",
            borderRadius: 4,
            border: "1px solid #036",
            background: "#e9f7fb",
            fontFamily: theme.typography.fontFamily
          }}
        >
          {seasons.map(season =>
            <option key={season.value} value={season.value}>
              {season.label}
            </option>
          )}
        </select>
      </Box>
      {/* Månedsfelter */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 3,
        }}
      >
        {schoolYearMonths.map(({ name, month, year }, idx) => (
          <Card key={name + year} sx={monthCardSx}>
            <CardContent sx={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", p: 1 }}>
              <Typography variant="h6" sx={{ color: "#036", fontWeight: 700, mb: 0.5, textAlign: "center", fontSize: "1.05rem" }}>
                {name} {year}
              </Typography>
              <Box
                sx={{
                  flex: 1,
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: 0.3,
                  alignItems: "start",
                  pt: 0.5,
                  fontFamily: theme.typography.fontFamily
                }}
              >
                {["Ma", "Ti", "On", "To", "Fr", "Lø", "Sø"].map(wd => (
                  <Typography key={wd} variant="caption"
                    sx={{
                      fontWeight: 600,
                      color: "#888",
                      textAlign: "center",
                      fontSize: "0.85rem"
                    }}
                  >
                    {wd}
                  </Typography>
                ))}
                {(() => {
                  const firstDay = new Date(year, month, 1).getDay();
                  return Array((firstDay === 0 ? 6 : firstDay - 1)).fill(null).map((_, i) => (
                    <Box key={`empty-${i}`} />
                  ));
                })()}
                {Array(getDaysInMonth(month, year)).fill(null).map((_, dayIdx) => {
                  const day = dayIdx + 1;
                  const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const status = markedDays[key] || "off";
                  return (
                    <Tooltip title={
                      status === "on"
                        ? "Tænd klient"
                        : "Sluk klient"
                    } arrow key={key}>
                      <Button
                        variant={status ? "contained" : "outlined"}
                        sx={{
                          ...dayBtnBase,
                          ...(status === "on" ? dayBtnStatus.on :
                              status === "off" ? dayBtnStatus.off :
                              dayBtnStatus.default)
                        }}
                        onMouseDown={() => handleDayMouseDown(year, month, day, markedDays[key])}
                        onMouseOver={() => handleDayMouseOver(year, month, day)}
                        onClick={() => handleDayClick(year, month, day)}
                      >
                        {day}
                      </Button>
                    </Tooltip>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
      {/* Snackbar feedback */}
      <Snackbar open={snackOpen} autoHideDuration={2500} onClose={() => setSnackOpen(false)}>
        <Alert severity="success" sx={{ width: '100%' }}>
          Markeringer gemt!
        </Alert>
      </Snackbar>
      <Snackbar open={!!snackError} autoHideDuration={3000} onClose={() => setSnackError("")}>
        <Alert severity="error" sx={{ width: '100%' }}>
          {snackError}
        </Alert>
      </Snackbar>
    </Box>
  );
}
