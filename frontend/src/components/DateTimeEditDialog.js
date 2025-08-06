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

export default function DateTimeEditDialog({
  open,
  onClose,
  date,
  clientId,
  onSaved, // kan bruges hvis du vil opdatere kalenderen efter gem
}) {
  const [onTime, setOnTime] = useState("");
  const [offTime, setOffTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Hjælpefunktion til at sætte standardtider
  const getDefaultTimes = (dateStr) => {
    const dateObj = new Date(dateStr);
    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
    return {
      onTime: isWeekend ? "08:00" : "09:00",
      offTime: isWeekend ? "18:00" : "22:30",
    };
  };

  useEffect(() => {
    if (!open || !date || !clientId) return;
    setLoading(true);
    setError("");
    fetch(
      `https://kulturskole-infosk-rm.onrender.com/api/calendar/marked-days?date=${encodeURIComponent(date)}&clientId=${encodeURIComponent(clientId)}`
    )
      .then(res => {
        if (!res.ok) throw new Error("Fejl ved hentning af tider");
        return res.json();
      })
      .then(data => {
        setOnTime(data.onTime ? data.onTime.replace(/\./g, ":") : getDefaultTimes(date).onTime);
        setOffTime(data.offTime ? data.offTime.replace(/\./g, ":") : getDefaultTimes(date).offTime);
      })
      .catch(() => {
        // Brug default-tider hvis der ikke kan hentes fra server
        const defaults = getDefaultTimes(date);
        setOnTime(defaults.onTime);
        setOffTime(defaults.offTime);
        setError("Kunne ikke hente tider. Viser standardtidspunkter.");
      })
      .finally(() => setLoading(false));
  }, [open, date, clientId]);

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
      const res = await fetch(
        "https://kulturskole-infosk-rm.onrender.com/api/calendar/marked-days",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", accept: "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error("Fejl ved gem");
      if (onSaved) onSaved({ date, clientId, onTime, offTime });
      onClose();
    } catch {
      setError("Kunne ikke gemme tid til serveren.");
    }
    setSaving(false);
  };

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
              onChange={e => setOnTime(e.target.value.replace(/\./g, ":"))}
              fullWidth
              sx={{ mb: 2 }}
              inputProps={{ step: 300 }}
              error={Boolean(error)}
            />
            <TextField
              label="Sluk tid"
              type="time"
              value={offTime}
              onChange={e => setOffTime(e.target.value.replace(/\./g, ":"))}
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
