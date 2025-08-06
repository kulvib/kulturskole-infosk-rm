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
} from "@mui/material";

// Helper to strip time from ISO date key
const stripTimeFromDateKey = (key) => key.split("T")[0];

const API_BASE = "https://kulturskole-infosk-rm.onrender.com";

export default function DateTimeEditDialog({
  open,
  onClose,
  date,
  clientId,
  onSaved,
}) {
  const [onTime, setOnTime] = useState("");
  const [offTime, setOffTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Fetch times from API when dialog opens
  useEffect(() => {
    if (!open || !date || !clientId) return;
    setLoading(true);
    setError("");
    fetch(
      `${API_BASE}/api/calendar/marked-days?client_id=${encodeURIComponent(clientId)}&season=${date.substring(0, 4)}`
    )
      .then(res => {
        if (!res.ok) throw new Error("Fejl ved hentning");
        return res.json();
      })
      .then(data => {
        // Find entry for day (with or without time part)
        const allKeys = Object.keys(data.markedDays || {});
        let found = data.markedDays[date];
        if (!found) {
          const matchKey = allKeys.find(k => stripTimeFromDateKey(k) === date);
          if (matchKey) found = data.markedDays[matchKey];
        }
        setOnTime(found?.onTime?.replace(/\./g, ":") || "");
        setOffTime(found?.offTime?.replace(/\./g, ":") || "");
      })
      .catch(() => {
        setOnTime("");
        setOffTime("");
        setError("Kunne ikke hente tider fra serveren.");
      })
      .finally(() => setLoading(false));
  }, [open, date, clientId]);

  const validate = () => {
    if (!onTime || !offTime) {
      setError("Begge tidspunkter skal udfyldes.");
      return false;
    }
    // Only allow ":" as separator for type="time"
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(onTime) || !timeRegex.test(offTime)) {
      setError("Tid skal være i formatet 08:00 eller 18:30.");
      return false;
    }
    setError("");
    return true;
  };

  // Normalize to "HH:mm" with colon before saving
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setError("");
    try {
      const normalizedDate = date.length === 10 ? date + "T00:00:00" : date;
      const payload = {
        date: normalizedDate,
        client_id: clientId,
        onTime: onTime.replace(/\./g, ":"),
        offTime: offTime.replace(/\./g, ":"),
      };
      const res = await fetch(
        `${API_BASE}/api/calendar/marked-days`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", accept: "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error("Fejl ved gem");
      if (onSaved) await onSaved({ date: normalizedDate, clientId });
      onClose();
    } catch {
      setError("Kunne ikke gemme tid til serveren.");
    }
    setSaving(false);
  };

  // Format date for display
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

  // Only allow ":" as separator in the input (and auto-convert "." to ":")
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
              error={Boolean(error)}
            />
            <TextField
              label="Sluk tid"
              type="time"
              value={offTime}
              onChange={handleOffTimeChange}
              fullWidth
              inputProps={{ step: 300 }}
              error={Boolean(error)}
              helperText={error}
            />
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
          disabled={saving || loading || !onTime || !offTime}
        >
          {saving ? <CircularProgress size={20} /> : "Gem"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
