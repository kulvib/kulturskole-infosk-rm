import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
} from "@mui/material";

/**
 * Props:
 * - open: boolean
 * - onClose: function
 * - date: string (YYYY-MM-DD)
 * - clientId: id for klienten (valgfrit)
 * - customTime: { onTime, offTime, status } eller null
 * - defaultTimes: { onTime, offTime }
 * - onSave: function({ clientId, date, onTime, offTime })
 */
export default function DateTimeEditDialog({
  open,
  onClose,
  date,
  clientId,
  customTime,
  defaultTimes,
  onSave,
}) {
  // Hjælpefunktion for sikkert format (punktum eller kolon -> kolon)
  const formatTime = t =>
    t && typeof t === "string"
      ? t.replace(".", ":")
      : "";

  const [onTime, setOnTime] = useState("");
  const [offTime, setOffTime] = useState("");
  const [error, setError] = useState(""); // For valideringsfejl

  useEffect(() => {
    setOnTime(
      customTime && typeof customTime.onTime === "string" && customTime.onTime
        ? formatTime(customTime.onTime)
        : formatTime(defaultTimes?.onTime)
    );
    setOffTime(
      customTime && typeof customTime.offTime === "string" && customTime.offTime
        ? formatTime(customTime.offTime)
        : formatTime(defaultTimes?.offTime)
    );
    setError("");
  }, [customTime, defaultTimes, date, open]);

  if (!date) return null;

  // Ekstra validering: Tider skal være gyldige og onTime < offTime
  const validate = () => {
    if (!onTime || !offTime) {
      setError("Begge tidspunkter skal udfyldes.");
      return false;
    }
    // Tjek format (skal være HH:MM og 00 ≤ MM < 60)
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(onTime) || !timeRegex.test(offTime)) {
      setError("Tid skal være i formatet 08:00 eller 18:30.");
      return false;
    }
    // Sammenlign tider
    const [onH, onM] = onTime.split(":").map(Number);
    const [offH, offM] = offTime.split(":").map(Number);
    if (onH > 23 || offH > 23 || onM > 59 || offM > 59) {
      setError("Tid skal være gyldig (00:00 - 23:59).");
      return false;
    }
    if (onH > offH || (onH === offH && onM >= offM)) {
      setError("Tænd-tid skal være før sluk-tid.");
      return false;
    }
    setError("");
    return true;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({
      clientId,
      date,
      onTime,
      offTime,
    });
    onClose();
  };

  // Dansk format: lørdag d. 2. august 2025
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
        <Typography variant="body2" sx={{ mb: 2 }}>
          Indstil tænd/sluk-tidspunkt for denne dag.<br />
          Standard: {formatTime(defaultTimes?.onTime)} – {formatTime(defaultTimes?.offTime)}
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Annullér
        </Button>
        <Button onClick={handleSave} color="primary" variant="contained" disabled={!onTime || !offTime}>
          Gem
        </Button>
      </DialogActions>
    </Dialog>
  );
}
