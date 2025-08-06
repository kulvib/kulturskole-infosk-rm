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

/**
 * Props:
 * - open: boolean
 * - onClose: function
 * - date: string (YYYY-MM-DD)
 * - clientId: string
 */
export default function DateTimeEditDialog({
  open,
  onClose,
  date,
  clientId,
}) {
  const [onTime, setOnTime] = useState("");
  const [offTime, setOffTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Robust: erstatter ALLE punktummer med kolon
  const formatTime = t =>
    t && typeof t === "string" ? t.replace(/\./g, ":") : "";

  // Hent tider fra backend når dialogen åbnes
  useEffect(() => {
    if (!open || !date || !clientId) return;
    setLoading(true);
    setError("");
    fetch(`/api/times?date=${encodeURIComponent(date)}&clientId=${encodeURIComponent(clientId)}`)
      .then(res => {
        if (!res.ok) throw new Error("Fejl ved hentning af tider");
        return res.json();
      })
      .then(data => {
        setOnTime(data.onTime ? formatTime(data.onTime) : "");
        setOffTime(data.offTime ? formatTime(data.offTime) : "");
      })
      .catch(() => {
        setOnTime("");
        setOffTime("");
        setError("Kunne ikke hente tider.");
      })
      .finally(() => setLoading(false));
  }, [open, date, clientId]);

  // Validering
  const validate = () => {
    if (!onTime || !offTime) {
      setError("Begge tidspunkter skal udfyldes.");
      return false;
    }
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(onTime) || !timeRegex.test(offTime)) {
      setError("Tid skal være i formatet 08:00 eller 18:30.");
      return false;
    }
    setError("");
    return true;
  };

  // POST til backend
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        date,
        clientId,
        onTime,
        offTime,
      };
      const res = await fetch(`/api/times`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Fejl ved gem");
      onClose();
    } catch {
      setError("Kunne ikke gemme tid til serveren.");
    }
    setSaving(false);
  };

  // Dansk format: lørdag d. 2. august 2025 (aldrig forkortet)
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
              onChange={e => setOnTime(formatTime(e.target.value))}
              fullWidth
              sx={{ mb: 2 }}
              inputProps={{ step: 300 }}
              error={Boolean(error)}
            />
            <TextField
              label="Sluk tid"
              type="time"
              value={offTime}
              onChange={e => setOffTime(formatTime(e.target.value))}
              fullWidth
              inputProps={{ step: 300 }}
              error={Boolean(error)}
              helperText={error}
            />
            {error && (
              <Typography sx={{ color: "red", mt: 1 }}>{error}</Typography>
            )}
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
