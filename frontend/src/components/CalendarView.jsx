import React, { useState, useRef } from "react";
import { Card, CardContent, Typography, Box, ToggleButtonGroup, ToggleButton, Tooltip, Button, Snackbar, Alert } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LockIcon from "@mui/icons-material/Lock";
import SaveIcon from "@mui/icons-material/Save";
import "./CalendarView.css";

function getDaysInMonth(month, year) {
  return new Date(year, month + 1, 0).getDate();
}

const monthNames = [
  "August", "September", "Oktober", "November", "December",
  "Januar", "Februar", "Marts", "April", "Maj", "Juni", "Juli"
];

function getSchoolYearMonths() {
  const now = new Date();
  const startYear = now.getMonth() < 7 ? now.getFullYear() - 1 : now.getFullYear();
  const months = [];
  for (let i = 0; i < 12; i++) {
    let monthIndex = (i + 7) % 12;
    let year = monthIndex < 7 ? startYear + 1 : startYear;
    months.push({ name: monthNames[i], month: monthIndex, year });
  }
  return months;
}

export default function CalendarView() {
  const [markedDays, setMarkedDays] = useState({});
  const [mode, setMode] = useState("on");
  const [dragging, setDragging] = useState(false);
  const [dragMode, setDragMode] = useState(null);
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackError, setSnackError] = useState("");
  const schoolYearMonths = getSchoolYearMonths();
  const dragDaysRef = useRef(new Set());

  // Click handler (single day)
  const handleDayClick = (year, month, day) => {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setMarkedDays(prev => ({
      ...prev,
      [key]: prev[key] === mode ? undefined : mode
    }));
  };

  // Mouse down (start drag)
  const handleDayMouseDown = (year, month, day, status) => {
    setDragging(true);
    setDragMode(status === mode ? "unmark" : "mark");
    dragDaysRef.current = new Set();
    handleDayMouseOver(year, month, day);
  };

  // Mouse over (drag mark/unmark)
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

  // Mouse up (end drag)
  const handleMouseUp = () => {
    setDragging(false);
    dragDaysRef.current = new Set();
    setDragMode(null);
  };

  React.useEffect(() => {
    if (!dragging) return;
    const onUp = () => handleMouseUp();
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [dragging]);

  // GEM MARKERING TIL BACKEND
  const handleSave = async () => {
    setSnackError("");
    try {
      // Skift URL til din backend endpoint!
      const res = await fetch("https://kulturskole-backend.onrender.com/calendar/marked-days", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
          // Tilføj evt. Authorization header hvis API kræver token
        },
        body: JSON.stringify({ markedDays })
      });
      if (!res.ok) throw new Error("Kunne ikke gemme markeringer");
      setSnackOpen(true);
    } catch (err) {
      setSnackError(err.message);
    }
  };

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", mt: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        <LockIcon sx={{ fontSize: 32, color: "#d32f2f", mr: 2 }} />
        <Card sx={{ minWidth: 260, mr: 3, background: "#e9f7fb", border: "1px solid #036" }}>
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
              <ToggleButton value="on" sx={{ color: "#03a9f4", fontWeight: 700 }}>
                Tænd klient
              </ToggleButton>
              <ToggleButton value="off" sx={{ color: "#4caf50", fontWeight: 700 }}>
                Sluk klient
              </ToggleButton>
            </ToggleButtonGroup>
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: "inline-flex", alignItems: "center", mr: 2 }}>
                <Box className="legend-dot on" />
                <Typography variant="body2">Tænd klient</Typography>
              </Box>
              <Box sx={{ display: "inline-flex", alignItems: "center" }}>
                <Box className="legend-dot off" />
                <Typography variant="body2">Sluk klient</Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, background: "#b3e5fc", border: "1px solid #81d4fa" }}>
          <CardContent sx={{ display: "flex", alignItems: "center" }}>
            <InfoOutlinedIcon sx={{ mr: 2, color: "#0288d1" }} />
            <Typography variant="body2">
              Træk og slip imellem dagene for at markere flere dage på én gang.<br />
              Dage som ikke er markeret, kan betragtes som fælles afspadsering (nul-dage).<br />
              Når du vælger "Tænd klient", vil klienten være synlig på disse dage.
            </Typography>
          </CardContent>
        </Card>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          color="primary"
          sx={{ height: 48, ml: 3, fontWeight: 700, boxShadow: 2 }}
          onClick={handleSave}
        >
          Gem markeringer
        </Button>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3 }}>
        {schoolYearMonths.map(({ name, month, year }, idx) => (
          <Card key={name} className="month-card" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ color: "#036", fontWeight: 700, mb: 1 }}>
                {name}
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.5 }}>
                {["Ma", "Ti", "On", "To", "Fr", "Lø", "Sø"].map(wd => (
                  <Typography key={wd} variant="caption" sx={{ fontWeight: 600, color: "#888", textAlign: "center" }}>
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
                  const status = markedDays[key];
                  return (
                    <Tooltip title={status === "on" ? "Tænd klient" : status === "off" ? "Sluk klient" : "Ingen markering"} arrow key={key}>
                      <Button
                        className={`day-btn ${status || ""}`}
                        variant={status ? "contained" : "outlined"}
                        sx={{
                          minWidth: 0,
                          px: 0.7,
                          py: 0.5,
                          borderRadius: "50%",
                          background: status === "on" ? "#03a9f4" : status === "off" ? "#4caf50" : "inherit",
                          color: status ? "#fff" : "#333",
                          borderColor: status ? "transparent" : "#ddd",
                          fontWeight: 600,
                          fontSize: "1rem",
                          transition: "background 0.2s",
                          boxShadow: status ? 2 : 0,
                          cursor: "pointer"
                        }}
                        onMouseDown={() => handleDayMouseDown(year, month, day, status)}
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
