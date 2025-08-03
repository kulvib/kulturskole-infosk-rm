import React, { useState, useEffect, useRef } from "react";
import {
  Card, CardContent, Typography, Box, ToggleButtonGroup, ToggleButton,
  Tooltip, Button, Snackbar, Alert, useTheme,
  FormControl, InputLabel, Select, MenuItem, Checkbox, ListItemText, OutlinedInput, CircularProgress
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

export default function CalendarView() {
  const theme = useTheme();
  const seasons = getSeasons();
  const [selectedSeason, setSelectedSeason] = useState(seasons[0].value);
  const [schoolYearMonths, setSchoolYearMonths] = useState(getSchoolYearMonths(seasons[0].value));
  const [markedDays, setMarkedDays] = useState({});
  const [mode, setMode] = useState("on");
  const [dragging, setDragging] = useState(false);
  const [dragMode, setDragMode] = useState(null);
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackError, setSnackError] = useState("");
  const [selectedClients, setSelectedClients] = useState([]);
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [allSelected, setAllSelected] = useState(false);
  const dragDaysRef = useRef(new Set());

  useEffect(() => {
    setSchoolYearMonths(getSchoolYearMonths(selectedSeason));
  }, [selectedSeason]);

  // Hent alle klienter med status "approved"
  useEffect(() => {
    async function fetchClients() {
      setLoadingClients(true);
      try {
        const res = await fetch("/api/clients/");
        const data = await res.json();
        const approvedClients = Array.isArray(data)
          ? data.filter(cli => cli.status === "approved")
          : [];
        setClients(approvedClients);
      } catch (err) {
        setClients([]);
      }
      setLoadingClients(false);
    }
    fetchClients();
  }, []);

  useEffect(() => {
    setAllSelected(selectedClients.length === clients.length && clients.length > 0);
  }, [selectedClients, clients]);

  // Hent markeringer for valgt sæson og valgte klienter
  useEffect(() => {
    async function fetchMarkedDays() {
      if (!selectedClients.length) {
        setMarkedDays({});
        return;
      }
      try {
        // Hent markeringer for hver klient og saml fælles markeringer
        const allMarked = {};
        for (const clientId of selectedClients) {
          const query = `?season=${selectedSeason}&client_id=${clientId}`;
          const res = await fetch("/api/calendar/marked-days" + query);
          const json = await res.json();
          const markings = json.markedDays || {};
          // Saml markeringer: For første klient, brug alle. For efterfølgende, behold kun de dage hvor status er ens!
          if (Object.keys(allMarked).length === 0) {
            Object.assign(allMarked, markings);
          } else {
            for (const dayKey of Object.keys(allMarked)) {
              if (markings[dayKey] !== allMarked[dayKey]) {
                delete allMarked[dayKey]; // kun fælles status beholdes
              }
            }
          }
        }
        setMarkedDays(allMarked);
      } catch (e) {
        setMarkedDays({});
      }
    }
    fetchMarkedDays();
  }, [selectedSeason, selectedClients]);

  const handleClientsChange = (event) => {
    const value = event.target.value;
    setSelectedClients(typeof value === "string" ? value.split(',') : value);
  };

  const handleSelectAllClients = () => {
    if (allSelected) {
      setSelectedClients([]);
    } else {
      setSelectedClients(clients.map(c => c.id));
    }
  };

  const handleDayClick = (year, month, day) => {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setMarkedDays(prev => ({
      ...prev,
      [key]: prev[key] === mode ? undefined : mode
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
    setMarkedDays(prev => {
      const updated = { ...prev };
      dragDaysRef.current.forEach(k => {
        if (dragMode === "mark") updated[k] = mode;
        else if (dragMode === "unmark") updated[k] = undefined;
      });
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
    if (!selectedClients.length) {
      setSnackError("Vælg mindst én klient først!");
      return;
    }
    try {
      const res = await fetch("/api/calendar/marked-days", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markedDays,
          clients: selectedClients,
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

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", mt: 4, fontFamily: theme.typography.fontFamily }}>
      {/* Top-bar: Vælg klienter, tænd/sluk klient, Gem markeringer */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 2, gap: 2 }}>
        <FormControl sx={{ minWidth: 320 }}>
          <InputLabel id="client-select-label">Vælg klient(er)</InputLabel>
          <Select
            labelId="client-select-label"
            multiple
            value={selectedClients}
            onChange={handleClientsChange}
            input={<OutlinedInput label="Vælg klient(er)" />}
            renderValue={selected =>
              selected.length === clients.length
                ? "Alle"
                : selected.map(id => {
                    const c = clients.find(cli => cli.id === id);
                    return c ? c.name : id;
                  }).join(", ")
            }
          >
            <MenuItem value="all" onClick={handleSelectAllClients} dense>
              <Checkbox checked={allSelected} indeterminate={selectedClients.length > 0 && !allSelected} />
              <ListItemText primary="Vælg alle" />
            </MenuItem>
            {loadingClients &&
              <MenuItem disabled>
                <CircularProgress size={20} sx={{ mr: 2 }} /> <Typography>Indlæser...</Typography>
              </MenuItem>
            }
            {!loadingClients && clients.length === 0 &&
              <MenuItem disabled>
                <Typography>Ingen godkendte klienter</Typography>
              </MenuItem>
            }
            {clients.map(cli => (
              <MenuItem key={cli.id} value={cli.id}>
                <Checkbox checked={selectedClients.indexOf(cli.id) > -1} />
                <ListItemText primary={cli.name} secondary={cli.unique_id} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
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
          disabled={!selectedClients.length}
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
