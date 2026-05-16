import React, { useEffect, useState, useRef, useCallback } from "react";
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

const EARLIEST = "00:00";
const LATEST = "23:59";

function getAuthHeaders(extra = {}) {
  const token = localStorage.getItem("token");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

function normalizeDateString(dateStr) {
  if (!dateStr) return "";
  return String(dateStr).split("T")[0];
}

function formatFullDate(dateStr) {
  const norm = normalizeDateString(dateStr);
  if (!norm) return "";

  const [yyyy, mm, dd] = norm.split("-");
  if (!yyyy || !mm || !dd) return "";

  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), 12, 0, 0, 0);
  if (Number.isNaN(d.getTime())) return "";

  return `${WEEKDAYS[d.getDay()]} d. ${d.getDate()}.${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// Returnerer string "2025/2026".
function getSeasonFromDate(dateStr) {
  const normDate = normalizeDateString(dateStr);
  const year = parseInt(normDate.substring(0, 4), 10);
  const month = parseInt(normDate.substring(5, 7), 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return "";
  const startYear = month >= 8 ? year : year - 1;
  return `${startYear}/${startYear + 1}`;
}

function getDefaultTimes(dateStr, schoolTimes) {
  const norm = normalizeDateString(dateStr);
  const [yyyy, mm, dd] = norm.split("-");
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd), 12, 0, 0, 0);
  const day = Number.isNaN(date.getTime()) ? 1 : date.getDay();

  const fallback = {
    weekday: { onTime: "09:00", offTime: "22:30" },
    weekend: { onTime: "08:00", offTime: "18:00" }
  };

  const times = schoolTimes || fallback;

  return (day === 0 || day === 6)
    ? times?.weekend || fallback.weekend
    : times?.weekday || fallback.weekday;
}

function findDayObj(markedDays = {}, normDate) {
  if (!markedDays || typeof markedDays !== "object") return {};
  if (markedDays[normDate]) return markedDays[normDate];

  const key = Object.keys(markedDays).find(k => String(k).startsWith(normDate));
  return key ? markedDays[key] : {};
}

function isValidTimeFormat(t) {
  return /^\d{2}:\d{2}$/.test(String(t || ""));
}

function isOnBeforeOff(on, off) {
  return isValidTimeFormat(on) && isValidTimeFormat(off) && on <= off;
}

export default function DateTimeEditDialog({
  open,
  onClose,
  date,
  clientId,
  onSaved,
  schoolTimes,
  season, // Modtages fra CalendarPage som string "2025/2026".
}) {
  const [onTime, setOnTime] = useState("");
  const [offTime, setOffTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const closeTimer = useRef(null);
  const abortRef = useRef(null);

  const handleCloseSnackbar = useCallback(() => {
    setSnackbar(prev => ({ ...prev, open: false }));
  }, []);

  useEffect(() => {
    if (!open || !date || !clientId) return undefined;

    if (abortRef.current) {
      try { abortRef.current.abort(); } catch {}
    }

    const controller = new AbortController();
    abortRef.current = controller;
    let cancelled = false;

    setLoading(true);
    setOnTime("");
    setOffTime("");

    const normDate = normalizeDateString(date);
    const seasonStr = season || getSeasonFromDate(normDate);

    async function loadTimes() {
      try {
        const res = await fetch(
          `${apiUrl}/api/calendar/marked-days?client_id=${encodeURIComponent(clientId)}&season=${encodeURIComponent(seasonStr)}`,
          {
            credentials: "include",
            headers: getAuthHeaders(),
            signal: controller.signal,
          }
        );

        if (!res.ok) throw new Error("Kunne ikke hente tider");

        const data = await res.json();
        if (cancelled) return;

        const dayObj = findDayObj(data.markedDays || data.marked_days || {}, normDate);

        if (dayObj.onTime && dayObj.offTime) {
          setOnTime(dayObj.onTime);
          setOffTime(dayObj.offTime);
        } else {
          const def = getDefaultTimes(normDate, schoolTimes);
          setOnTime(def.onTime);
          setOffTime(def.offTime);
        }
      } catch (err) {
        if (cancelled || err?.name === "AbortError") return;

        setSnackbar({ open: true, message: "Fejl ved hentning!", severity: "error" });
        const def = getDefaultTimes(normDate, schoolTimes);
        setOnTime(def.onTime);
        setOffTime(def.offTime);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadTimes();

    return () => {
      cancelled = true;
      try { controller.abort(); } catch {}
    };
  }, [open, date, clientId, schoolTimes, season]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      if (abortRef.current) {
        try { abortRef.current.abort(); } catch {}
      }
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

    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }

    setSaving(true);

    try {
      const normDate = normalizeDateString(date);
      const seasonStr = season || getSeasonFromDate(normDate);

      const resGet = await fetch(
        `${apiUrl}/api/calendar/marked-days?client_id=${encodeURIComponent(clientId)}&season=${encodeURIComponent(seasonStr)}`,
        {
          credentials: "include",
          headers: getAuthHeaders(),
        }
      );

      let serverData = {};
      if (resGet.ok) {
        const data = await resGet.json();
        serverData = data.markedDays || data.marked_days || {};
      }

      let updateKey = normDate;
      const existingKey = Object.keys(serverData).find(k => String(k).startsWith(normDate));
      if (existingKey) updateKey = existingKey;

      const updatedDays = { ...serverData };
      updatedDays[updateKey] = { status: "on", onTime, offTime };

      const payload = {
        markedDays: { [String(clientId)]: updatedDays },
        clients: [clientId],
        season: seasonStr,
      };

      const res = await fetch(`${apiUrl}/api/calendar/marked-days`, {
        method: "POST",
        headers: getAuthHeaders({
          "Content-Type": "application/json",
          accept: "application/json",
        }),
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Gemning fejlede");

      let returnedDay = updatedDays[updateKey];

      try {
        const resGet2 = await fetch(
          `${apiUrl}/api/calendar/marked-days?client_id=${encodeURIComponent(clientId)}&season=${encodeURIComponent(seasonStr)}`,
          {
            credentials: "include",
            headers: getAuthHeaders(),
          }
        );

        if (resGet2.ok) {
          const data2 = await resGet2.json();
          const dayObj2 = findDayObj(data2.markedDays || data2.marked_days || {}, normDate);
          if (dayObj2 && (dayObj2.onTime || dayObj2.offTime || dayObj2.status)) {
            returnedDay = dayObj2;
            setOnTime(dayObj2.onTime || "");
            setOffTime(dayObj2.offTime || "");
          }
        }
      } catch {
        // Fallback til returnedDay fra lokal merge.
      }

      if (onSaved) onSaved({ date: normDate, clientId, day: returnedDay });

      setSnackbar({ open: true, message: "Gemt!", severity: "success" });
      closeTimer.current = setTimeout(() => {
        setSnackbar({ open: false, message: "", severity: "success" });
        if (onClose) onClose();
      }, 1200);
    } catch (err) {
      setSnackbar({
        open: true,
        message: err?.message || "Fejl ved gemning!",
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDialogClose = () => {
    if (saving) return;
    if (onClose) onClose();
  };

  return (
    <Dialog open={open} onClose={handleDialogClose} maxWidth="xs" fullWidth>
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
                  type="time"
                  fullWidth
                  value={onTime}
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
                  type="time"
                  fullWidth
                  value={offTime}
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
        <Button onClick={handleDialogClose} color="inherit" disabled={saving || loading}>
          Annullér
        </Button>
        <Button onClick={handleSave} color="primary" variant="contained" disabled={saving || loading}>
          {saving ? <CircularProgress size={20} /> : "Gem"}
        </Button>
      </DialogActions>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={1800}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <MuiAlert elevation={6} variant="filled" onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </MuiAlert>
      </Snackbar>
    </Dialog>
  );
}
