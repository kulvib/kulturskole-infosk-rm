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
}) {
  const [onTime, setOnTime] = useState("");
  const [offTime, setOffTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Hent tider fra API når dialog åbner
  useEffect(() => {
    if (!open || !date || !clientId) return;
    setLoading(true);
    setError("");

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
      const token = getToken();
      const normalizedDate = date.length === 10 ? date + "T00:00:00" : date;
      // Byg payload som backend forventer!
      const season = normalizedDate.substring(0, 4);
      const payload = {
        markedDays: {
          [normalizedDate]: {
            client_id: clientId,
            status: "on",
            onTime: onTime.replace(/\./g, ":"),
            offTime: offTime.replace(/\./g, ":")
          }
        },
        clients: [clientId],
        season: season
      };
      console.log("Payload der sendes:", payload);

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
        console.error("Fejl fra serveren:", errText);
        throw new Error(errText);
      }
      if (onSaved) await onSaved({ date: normalizedDate, clientId });
      onClose();
    } catch (e) {
      setError(e.message || "Kunne ikke gemme tid til serveren.");
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
