import React, { useEffect, useState, useRef } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, CircularProgress, Box,
  Snackbar, Alert as MuiAlert,
} from "@mui/material";
import { apiUrl } from "../../api";

const WEEKDAYS = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];
const MONTHS = [
  "januar", "februar", "marts", "april", "maj", "juni",
  "juli", "august", "september", "oktober", "november", "december"
];

function formatFullDate(dateStr) {
  if (!dateStr) return "";
  const [yyyy, mm, dd] = dateStr.split("T")[0].split("-");
  if (!yyyy || !mm || !dd) return "";
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return `${WEEKDAYS[d.getDay()]} d. ${d.getDate()}.${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const EARLIEST = "00:00";
const LATEST = "23:59";

// FIX: Returnerer string "2025/2026" i stedet for integer
function getSeasonFromDate(dateStr) {
  const normDate = dateStr.split("T")[0];
  const year = parseInt(normDate.substring(0, 4));
  const month = parseInt(normDate.substring(5, 7));
  const startYear = month >= 8 ? year : year - 1;
  return `${startYear}/${startYear + 1}`;
}

function getDefaultTimes(dateStr, schoolTimes) {
  const date = new Date(dateStr);
  const day = date.getDay();
  const fallback = {
    weekday: { onTime: "09:00", offTime: "22:30" },
    weekend: { onTime: "08:00", offTime: "18:00" }
  };
  const times = schoolTimes || fallback;
  return (day === 0 || day === 6)
    ? times?.weekend || fallback.weekend
    : times?.weekday || fallback.weekday;
}

function findDayObj(markedDays, normDate) {
  if (markedDays[normDate]) return markedDays[normDate];
  const key = Object.keys(markedDays).find(k => k.startsWith(normDate));
  return key ? markedDays[key] : {};
}

export default function DateTimeEditDialog({
  open,
  onClose,
  date,
  clientId,
  onSaved,
  schoolTimes,
  season, // FIX: modtages fra CalendarPage som string "2025/2026"
}) {
  const [onTime, setOnTime] = useState("");
  const [offTime, setOffTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const closeTimer = useRef(null);

  const handleCloseSnackbar = () => setSnackbar({ ...snackbar, open: false });

  function isValidTimeFormat(t) {
    return /^\d{2}:\d{2}$/.test(t);
  }
  function isOnBeforeOff(on, off) {
    return isValidTimeFormat(on) && isValidTimeFormat(off) && on <= off;
  }

  useEffect(() => {
    if (!open || !date || !clientId) return;
    setLoading(true);
    setOnTime("");
    setOffTime("");

    const normDate = date.split("T")[0];
    // FIX: Brug season-prop hvis tilgængelig, ellers beregn fra dato
    const seasonStr = season || getSeasonFromDate(normDate);

    fetch(
      `${apiUrl}/api/calendar/marked-days?client_id=${encodeURIComponent(clientId)}&season=${encodeURIComponent(seasonStr)}`,
      { credentials: "include" }
    )
      .then(res => res.json())
      .then(data => {
        const dayObj = findDayObj(data.markedDays || {}, normDate);
        if (dayObj.onTime && dayObj.offTime) {
          setOnTime(dayObj.onTime);
          setOffTime(dayObj.offTime);
        } else {
          const def = getDefaultTimes(normDate, schoolTimes);
          setOnTime(def.onTime);
          setOffTime(def.offTime);
        }
      })
      .catch(() => {
        setSnackbar({ open: true, message: "Fejl ved hentning!", severity: "error" });
        const def = getDefaultTimes(normDate, schoolTimes);
        setOnTime(def.onTime);
        setOffTime(def.offTime);
      })
      .finally(() => setLoading(false));
  }, [open, date, clientId, schoolTimes, season]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const validate = () => {
    if (!onTime || !offTime) {
      setSnackbar({ open: true, message: "Begge tider skal udfyldes!", severity: "error" });
      return false;
    }
    if (!isValidTimeFormat(onTime) || !isValidTimeFormat(offTime)) {
      setSnackbar({ open: true, message: "Tid skal være på formatet hh:mm!", severity: "error" });
      return false;
    }
    if (onTime < EARLIEST || onTime > LATEST || offTime < EARLIEST || offTime > LATEST) {
      setSnackbar({ open: true, message: "Tid skal være indenfor datoens interval!", severity: "error" });
      return false;
    }
    if (!isOnBeforeOff(onTime, offTime)) {
      setSnackbar({ open: true, message: "Tænd tid skal være før sluk tid!", severity: "error" });
      return false;
    }
    return true;
  };

  const onTimeMax = offTime && isValidTimeFormat(offTime) ? offTime : LATEST;
  const offTimeMin = onTime && isValidTimeFormat(onTime) ? onTime : EARLIEST;

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const normDate = date.split("T")[0];
      // FIX: seasonStr er altid string "2025/2026"
      const seasonStr = season || getSeasonFromDate(normDate);

      const resGet = await fetch(
        `${apiUrl}/api/calendar/marked-days?client_id=${encodeURIComponent(clientId)}&season=${encodeURIComponent(seasonStr)}`,
        { credentials: "include" }
      );
      let serverData = {};
      if (resGet.ok) {
        const data = await resGet.json();
        serverData = data.markedDays || {};
      }

      let updateKey = normDate;
      const existingKey = Object.keys(serverData).find(k => k.startsWith(normDate));
      if (existingKey) updateKey = existingKey;

      const updatedDays = { ...serverData };
      updatedDays[updateKey] = { status: "on", onTime, offTime };

      // FIX: season sendes som string — ikke Number()
      const payload = {
        markedDays: { [String(clientId)]: updatedDays },
        clients: [clientId],
        season: seasonStr,
      };

      const res = await fetch(`${apiUrl}/api/calendar/marked-days`, {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Gemning fejlede");

      let returnedDay = updatedDays[updateKey];
      try {
        const resGet2 = await fetch(
          `${apiUrl}/api/calendar/marked-days?client_id=${encodeURIComponent(clientId)}&season=${encodeURIComponent(seasonStr)}`,
          { credentials: "include" }
        );
        if (resGet2.ok) {
          const data2 = await resGet2.json();
          const dayObj2 = findDayObj(data2.markedDays || {}, normDate);
          if (dayObj2 && (dayObj2.onTime || dayObj2.offTime || dayObj2.status)) {
            returnedDay = dayObj2;
            setOnTime(dayObj2.onTime || "");
            setOffTime(dayObj2.offTime || "");
          }
        }
      } catch { }

      if (onSaved) onSaved({ date: normDate, clientId, day: returnedDay });

      setSnackbar({ open: true, message: "Gemt!", severity: "success" });
      closeTimer.current = setTimeout(() => {
        setSnackbar({ open: false, message: "", severity: "success" });
        if (onClose) onClose();
      }, 1200);

    } catch {
      setSnackbar({ open: true, message: "Fejl ved gemning!", severity: "error" });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", position: "relative" }}>
          <span style={{ margin: "0 auto" }}>
            {date ? `Rediger tid for ${formatFullDate(date)}` : "Rediger tid"}
          </span>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          {loading ? (
            <Box sx={{ minHeight: 80, display: "flex", alignItems: "center" }}>
              <CircularProgress sx={{ mr: 2 }} /> Henter tider...
            </Box>
          ) : (
            <Box sx={{ display: "flex", gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 500 }}>
                  Tænd tid
                </Typography>
                <TextField
                  type="time" fullWidth value={onTime}
                  onChange={e => setOnTime(e.target.value)}
                  InputProps={{ style: { backgroundColor: "#f6f6f6" } }}
                  inputProps={{ min: EARLIEST, max: onTimeMax, step: 300 }}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 500 }}>
                  Sluk tid
                </Typography>
                <TextField
                  type="time" fullWidth value={offTime}
                  onChange={e => setOffTime(e.target.value)}
                  InputProps={{ style: { backgroundColor: "#f6f6f6" } }}
                  inputProps={{ min: offTimeMin, max: LATEST, step: 300 }}
                />
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={saving || loading}>
          Annullér
        </Button>
        <Button onClick={handleSave} color="primary" variant="contained" disabled={saving || loading}>
          {saving ? <CircularProgress size={20} /> : "Gem"}
        </Button>
      </DialogActions>
      <Snackbar
        open={snackbar.open} autoHideDuration={1800} onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <MuiAlert elevation={6} variant="filled" onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </MuiAlert>
      </Snackbar>
    </Dialog>
  );
}
