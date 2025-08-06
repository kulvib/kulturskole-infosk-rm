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
  const [onTime, setOnTime] = useState("");
  const [offTime, setOffTime] = useState("");

  // Opdater visning når dialogen åbner eller data ændrer sig
  useEffect(() => {
    setOnTime(
      customTime && typeof customTime.onTime === "string"
        ? customTime.onTime
        : defaultTimes?.onTime || ""
    );
    setOffTime(
      customTime && typeof customTime.offTime === "string"
        ? customTime.offTime
        : defaultTimes?.offTime || ""
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
      ? customTime.onTime
      : defaultTimes?.onTime || "";

  const offTimePlaceholder =
    customTime && typeof customTime.offTime === "string" && customTime.offTime
      ? customTime.offTime
      : defaultTimes?.offTime || "";

  // Dansk dato-format eller YYYY-MM-DD fallback
  const displayDate = (() => {
    try {
      const d = new Date(date);
      if (!isNaN(d)) {
        return d.toLocaleDateString("da-DK", {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
        });
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
          Standard: {defaultTimes?.onTime} – {defaultTimes?.offTime}
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
