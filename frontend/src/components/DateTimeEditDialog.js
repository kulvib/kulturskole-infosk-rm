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
 * - defaultTimes: { onTime, offTime }
 * - season: string (f.eks. "2025")
 *
 * Denne komponent henter selv data fra din backend når den åbnes,
 * og gemmer data til din backend når du trykker "Gem".
 */
export default function DateTimeEditDialog({
  open,
  onClose,
  date,
  clientId,
  defaultTimes = { onTime: "08:00", offTime: "18:00" },
  season = "",
}) {
  const [onTime, setOnTime] = useState("");
  const [offTime, setOffTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [apiError, setApiError] = useState("");

  // Hjælpefunktion for sikkert format (punktum eller kolon -> kolon)
  const formatTime = t =>
    t && typeof t === "string" ? t.replace(".", ":") : "";

  // Hent eksisterende tider fra backend når dialogen åbnes
  useEffect(() => {
    if (!open || !date || !clientId) return;
    let ignore = false;
    async function fetchTime() {
      setLoading(true);
      setApiError("");
      setError("");
      try {
        const res = await fetch(
          `/api/times?date=${encodeURIComponent(date)}&clientId=${encodeURIComponent(clientId)}`
        );
        if (!res.ok) throw new Error("Kunne ikke hente tid fra serveren");
        const data = await res.json();
        // Sørg for at tider er i HH:MM format
        setOnTime(
          data && data.onTime ? formatTime(data.onTime) : formatTime(defaultTimes.onTime)
        );
        setOffTime(
          data && data.offTime ? formatTime(data.offTime) : formatTime(defaultTimes.offTime)
        );
      } catch (err) {
        setOnTime(formatTime(defaultTimes.onTime));
        setOffTime(formatTime(defaultTimes.offTime));
        setApiError("Kunne ikke hente tid fra serveren.");
      }
      setLoading(false);
    }
    fetchTime();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line
  }, [open, date, clientId, defaultTimes.onTime, defaultTimes.offTime]);

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

  // Gem tider til backend
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setApiError("");
    try {
      // Byg payload til backend
      const payload = {
        markedDays: {
          [date]: {
            onTime,
            offTime,
            status: "on",
          },
        },
        clients: [clientId],
        season: season || (date ? date.split("-")[0] : ""),
      };
      const res = await fetch("/api/times", {
        method: "POST", // eller "PUT" alt efter din backend
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let msg = "Kunne ikke gemme tid til serveren.";
        try {
          const err = await res.json();
          if (err && err.detail) msg += " " + JSON.stringify(err.detail);
        } catch {}
        throw new Error(msg);
      }
      setSaving(false);
      onClose();
    } catch (err) {
      setApiError(
        err?.message || "Kunne ikke gemme tid til serveren."
      );
      setSaving(false);
    }
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
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 120 }}>
            <CircularProgress size={29} />
            <span>Henter tider...</span>
          </div>
        ) : (
          <>
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
            {apiError && (
              <Typography sx={{ color: "red", mt: 1 }}>{apiError}</Typography>
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
