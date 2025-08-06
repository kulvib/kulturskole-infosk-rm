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
  // Hjælpefunktion for sikkert format
  const formatTime = t =>
    t && typeof t === "string" && t.match(/^\d{2}[:.]\d{2}$/)
      ? t.replace(".", ":")
      : "";

  const [onTime, setOnTime] = useState(formatTime(defaultTimes?.onTime));
  const [offTime, setOffTime] = useState(formatTime(defaultTimes?.offTime));

  useEffect(() => {
    setOnTime(
      customTime && customTime.onTime
        ? formatTime(customTime.onTime)
        : formatTime(defaultTimes?.onTime)
    );
    setOffTime(
      customTime && customTime.offTime
        ? formatTime(customTime.offTime)
        : formatTime(defaultTimes?.offTime)
    );
  }, [customTime, defaultTimes, date, open]);

  if (!date) return null;

  const handleSave = () => {
    if (onTime && offTime) {
      onSave({
        clientId,
        date,
        onTime,
        offTime,
      });
      onClose();
    }
  };

  // Placeholder skal ALTID afspejle den aktuelle værdi fra databasen (altså customTime hvis den findes, ellers default)
  const onTimePlaceholder =
    customTime && typeof customTime.onTime === "string" && customTime.onTime
      ? formatTime(customTime.onTime)
      : formatTime(defaultTimes?.onTime) || "";

  const offTimePlaceholder =
    customTime && typeof customTime.offTime === "string" && customTime.offTime
      ? formatTime(customTime.offTime)
      : formatTime(defaultTimes?.offTime) || "";

  // Dansk format: lørdag d. 2. august 2025
  const displayDate = (() => {
    try {
      const d = new Date(date);
      if (!isNaN(d)) {
        // Ugedag og måned med langt navn
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
          onChange={e => setOnTime(e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
          inputProps={{
            step: 300,
            placeholder: onTimePlaceholder,
          }}
        />
        <TextField
          label="Sluk tid"
          type="time"
          value={offTime}
          onChange={e => setOffTime(e.target.value)}
          fullWidth
          inputProps={{
            step: 300,
            placeholder: offTimePlaceholder,
          }}
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
