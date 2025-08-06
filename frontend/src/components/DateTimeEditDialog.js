import React, { useEffect, useState } from "react";
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
  Alert,
  Chip
} from "@mui/material";

// Helper to strip time from ISO date key
const stripTimeFromDateKey = (key) => key.split("T")[0];

const API_BASE = "https://kulturskole-infosk-rm.onrender.com";

// Hent token fra localStorage
function getToken() {
  return localStorage.getItem("token");
}

export default function DateTimeEditDialog({
  open,
  onClose,
  date,
  clientId,
  onSaved,
  localMarkedDays,
}) {
  const [onTime, setOnTime] = useState("");
  const [offTime, setOffTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showTopError, setShowTopError] = useState(false);
  const [showSaved, setShowSaved] = useState(false); // Ny: gemt-indikator

  // Hent tider fra API når dialog åbner
  useEffect(() => {
    if (!open || !date || !clientId) return;
    setLoading(true);
    setError("");
    setShowTopError(false);
    setShowSaved(false);

    const token = getToken();
    fetch(
      `${API_BASE}/api/calendar/marked-days?client_id=${encodeURIComponent(clientId)}&season=${date.substring(0, 4)}`,
      token
        ? { headers: { Authorization: "Bearer " + token } }
        : undefined
    )
      .then(res => {
        if (!res.ok) throw new Error("Fejl ved hentning");
        return res.json();
      })
      .then(data => {
        // Find entry for dag (med eller uden tid)
        const allKeys = Object.keys(data.markedDays || {});
        let found = data.markedDays[date];
        if (!found) {
          const matchKey = allKeys.find(k => stripTimeFromDateKey(k) === date);
          if (matchKey) found = data.markedDays[matchKey];
        }
        // Hvis IKKE fundet i backend, brug localMarkedDays fra frontend!
        if (!found && localMarkedDays && localMarkedDays[date]) {
          found = localMarkedDays[date];
        }
        setOnTime(found?.onTime?.replace(/\./g, ":") || "");
        setOffTime(found?.offTime?.replace(/\./g, ":") || "");
      })
      .catch(() => {
        let fallback = undefined;
        if (localMarkedDays && localMarkedDays[date]) {
          fallback = localMarkedDays[date];
        }
        setOnTime(fallback?.onTime?.replace(/\./g, ":") || "");
        setOffTime(fallback?.offTime?.replace(/\./g, ":") || "");
        setError("Kunne ikke hente tider fra serveren.");
        setShowTopError(true);
      })
      .finally(() => setLoading(false));
  }, [open, date, clientId, localMarkedDays]);

  const validate = () => {
    if (!onTime || !offTime) {
      setError("Begge tidspunkter skal udfyldes.");
      setShowTopError(true);
      return false;
    }
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(onTime) || !timeRegex.test(offTime)) {
      setError("Tid skal være i formatet 08:00 eller 18:30.");
      setShowTopError(true);
      return false;
    }
    setError("");
    setShowTopError(false);
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setError("");
    setShowTopError(false);
    try {
      const token = getToken();
      const normalizedDate = date.length === 10 ? date + "T00:00:00" : date;
      const season = normalizedDate.substring(0, 4);
      const payload = {
        markedDays: {
          [String(clientId)]: {
            [normalizedDate]: {
              status: "on",
              onTime: onTime.replace(/\./g, ":"),
              offTime: offTime.replace(/\./g, ":")
            }
          }
        },
        clients: [clientId],
        season: Number(season)
      };

      const res = await fetch(
        `${API_BASE}/api/calendar/marked-days`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            accept: "application/json",
            ...(token ? { Authorization: "Bearer " + token } : {}),
          },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const errText = await res.text();
        setError(errText || "Kunne ikke gemme tid til serveren.");
        setShowTopError(true);
        setSaving(false);
        setShowSaved(false);
        return;
      }
      if (onSaved) await onSaved({ date: normalizedDate, clientId });
      setShowSaved(true); // Vis gemt-indikator
      setTimeout(() => setShowSaved(false), 2200);
      onClose();
    } catch (e) {
      setError(e.message || "Kunne ikke gemme tid til serveren.");
      setShowTopError(true);
      setShowSaved(false);
    }
    setSaving(false);
  };

  // Formatér dato til visning
  const displayDate = (() => {
    try {
      const d = new Date(date);
      if (!isNaN(d)) {
        const weekday = d.toLocaleDateString("da-DK", { weekday: "long" });
        const day = d.getDate();
        const month = d.toLocaleDateString("da-DK", { month: "long" });
        const year = d.getFullYear();
        return `${weekday} d. ${day}. ${month} ${year}`;
      }
    } catch {}
    return date;
  })();

  const handleOnTimeChange = (e) => {
    const value = e.target.value.replace(/\./g, ":");
    setOnTime(value);
  };
  const handleOffTimeChange = (e) => {
    const value = e.target.value.replace(/\./g, ":");
    setOffTime(value);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        Redigér tid for {displayDate}
      </DialogTitle>
      <DialogContent>
        {/* Hvis der er fejl, vis Alert i toppen */}
        {showTopError && error && (
          <Box sx={{ mb: 2 }}>
            <Alert severity="error">{error}</Alert>
          </Box>
        )}
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 120 }}>
            <CircularProgress size={29} />
            <span>Henter tider...</span>
          </div>
        ) : (
          <>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Indstil tænd/sluk-tidspunkt for denne dag.
            </Typography>
            <TextField
              label="Tænd tid"
              type="time"
              value={onTime}
              onChange={handleOnTimeChange}
              fullWidth
              sx={{ mb: 2 }}
              inputProps={{ step: 300 }}
            />
            <TextField
              label="Sluk tid"
              type="time"
              value={offTime}
              onChange={handleOffTimeChange}
              fullWidth
              inputProps={{ step: 300 }}
            />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={saving || loading}>
          Annullér
        </Button>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Button
            onClick={handleSave}
            color="primary"
            variant="contained"
            disabled={saving || loading || !onTime || !offTime}
          >
            {saving ? <CircularProgress size={20} /> : "Gem"}
          </Button>
          {showSaved && (
            <Chip
              label="Gemt"
              color="success"
              size="small"
              sx={{ ml: 1 }}
            />
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
}
