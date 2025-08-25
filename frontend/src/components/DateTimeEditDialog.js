import React, { useEffect, useState, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  CircularProgress,
  Box,
  Snackbar,
  Alert as MuiAlert,
} from "@mui/material";
import { getMarkedDays, saveMarkedDays } from "../api"; // Brug fælles API

const WEEKDAYS = [
  "søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"
];
const MONTHS = [
  "januar", "februar", "marts", "april", "maj", "juni",
  "juli", "august", "september", "oktober", "november", "december"
];

function formatFullDate(dateStr) {
  if (!dateStr) return "";
  const [yyyy, mm, dd] = dateStr.split("T")[0].split("-");
  if (!yyyy || !mm || !dd) return "";
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  const weekday = WEEKDAYS[d.getDay()];
  const day = d.getDate();
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${weekday} d. ${day}.${month} ${year}`;
}

function findDayObj(markedDays, normDate) {
  if (!markedDays) return {};
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
  localMarkedDays // typisk: markedDays[clientId] fra CalendarPage
}) {
  const [onTime, setOnTime] = useState("");
  const [offTime, setOffTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Snackbar state
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const closeTimer = useRef(null);

  const handleCloseSnackbar = () => {
    setSnackbar(s => ({ ...s, open: false }));
  };

  useEffect(() => {
    if (!open || !date || !clientId) return;
    setLoading(true);
    setOnTime(""); setOffTime("");
    const normDate = date.split("T")[0];
    if (localMarkedDays && Object.keys(localMarkedDays).length > 0) {
      const dayObj = findDayObj(localMarkedDays, normDate);
      setOnTime(dayObj.onTime || "");
      setOffTime(dayObj.offTime || "");
      setLoading(false);
    } else {
      // fallback: hent fra backend
      getMarkedDays(Number(normDate.slice(0, 4)), clientId)
        .then(data => {
          const dayObj = findDayObj(data.markedDays || {}, normDate);
          setOnTime(dayObj.onTime || "");
          setOffTime(dayObj.offTime || "");
        })
        .catch(() => {
          setSnackbar({ open: true, message: "Fejl ved hentning!", severity: "error" });
        })
        .finally(() => setLoading(false));
    }
    // clean-up timer
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [open, date, clientId, localMarkedDays]);

  const validate = () => {
    if (!onTime || !offTime) {
      setSnackbar({ open: true, message: "Begge tider skal udfyldes!", severity: "error" });
      return false;
    }
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(onTime) || !timeRegex.test(offTime)) {
      setSnackbar({ open: true, message: "Tid skal være på formatet hh:mm!", severity: "error" });
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const normDate = date.split("T")[0];
      const season = Number(normDate.substring(0, 4));
      // Hent markedDays fra backend for merge
      const backendDays = await getMarkedDays(season, clientId);
      let serverData = backendDays.markedDays?.[clientId] || {};
      let updateKey = normDate;
      const existingKey = Object.keys(serverData).find(k => k.startsWith(normDate));
      if (existingKey) updateKey = existingKey;
      const updatedDays = { ...serverData };
      updatedDays[updateKey] = {
        status: "on",
        onTime,
        offTime
      };

      const payload = {
        markedDays: {
          [String(clientId)]: updatedDays
        },
        clients: [clientId],
        season: season
      };

      await saveMarkedDays(payload);

      setSnackbar({ open: true, message: "Gemt!", severity: "success" });
      if (onSaved) onSaved({ date: normDate, clientId });

      // Opdater input felter med evt. backend rettelser
      const backendAfterSave = await getMarkedDays(season, clientId);
      const dayObj2 = findDayObj(backendAfterSave.markedDays?.[clientId] || {}, normDate);
      setOnTime(dayObj2.onTime || "");
      setOffTime(dayObj2.offTime || "");

      // Luk dialogen automatisk efter success
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
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle sx={{ pb: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", position: "relative" }}>
          <span style={{ margin: "0 auto" }}>
            {date ? `Rediger tid for ${formatFullDate(date)}` : "Rediger tid"}
          </span>
        </Box>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ minHeight: 80, display: "flex", alignItems: "center" }}>
            <CircularProgress sx={{ mr: 2 }} /> Henter tider...
          </Box>
        ) : (
          <>
            <Box sx={{ mb: 2 }}>
              <Typography
                variant="subtitle2"
                sx={{ mb: 0.5, fontWeight: 500 }}
              >
                Tænd tid
              </Typography>
              <TextField
                type="time"
                fullWidth
                value={onTime}
                onChange={e => setOnTime(e.target.value)}
                InputProps={{
                  style: { backgroundColor: "#f6f6f6" }
                }}
                inputProps={{
                  step: 300,
                }}
              />
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography
                variant="subtitle2"
                sx={{ mb: 0.5, fontWeight: 500 }}
              >
                Sluk tid
              </Typography>
              <TextField
                type="time"
                fullWidth
                value={offTime}
                onChange={e => setOffTime(e.target.value)}
                InputProps={{
                  style: { backgroundColor: "#f6f6f6" }
                }}
                inputProps={{
                  step: 300,
                }}
              />
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={saving || loading}>
          Annullér
        </Button>
        <Button
          onClick={handleSave}
          color="primary"
          variant="contained"
          disabled={saving || loading}
        >
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
