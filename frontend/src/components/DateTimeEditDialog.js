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
  Alert
} from "@mui/material";

const API_BASE = "https://kulturskole-infosk-rm.onrender.com";
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
  const [status, setStatus] = useState(""); // "success" | "error" | ""
  const closeTimer = useRef(null);

  // Hent tider fra API hver gang dialogen åbnes
  useEffect(() => {
    if (!open || !date || !clientId) return;
    setLoading(true);
    setStatus("");
    setOnTime("");
    setOffTime("");
    const token = getToken();
    fetch(
      `${API_BASE}/api/calendar/marked-days?client_id=${encodeURIComponent(clientId)}&season=${date.slice(0, 4)}`,
      token ? { headers: { Authorization: "Bearer " + token } } : undefined
    )
      .then(res => res.json())
      .then(data => {
        // Find korrekt dag
        const normDate = date.split("T")[0];
        const dayObj = data.markedDays?.[normDate] || {};
        setOnTime(dayObj.onTime || "");
        setOffTime(dayObj.offTime || "");
      })
      .catch(() => {
        setStatus("error");
      })
      .finally(() => setLoading(false));
  }, [open, date, clientId]);

  // Luk dialogen automatisk efter 1 sekund ved succes
  useEffect(() => {
    if (status === "success") {
      closeTimer.current = setTimeout(() => {
        setStatus(""); // Clear feedback
        if (onClose) onClose();
      }, 1000);
    }
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [status, onClose]);

  const validate = () => {
    if (!onTime || !offTime) {
      setStatus("error");
      return false;
    }
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(onTime) || !timeRegex.test(offTime)) {
      setStatus("error");
      return false;
    }
    return true;
  };

  const fetchLatestTimes = async (clientId, normDate, season) => {
    const token = getToken();
    const resGet = await fetch(
      `${API_BASE}/api/calendar/marked-days?client_id=${encodeURIComponent(clientId)}&season=${season}`,
      token ? { headers: { Authorization: "Bearer " + token } } : undefined
    );
    if (resGet.ok) {
      const data = await resGet.json();
      const dayObj = data.markedDays?.[normDate] || {};
      setOnTime(dayObj.onTime || "");
      setOffTime(dayObj.offTime || "");
    }
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setStatus("");
    try {
      const token = getToken();
      const normDate = date.split("T")[0];
      const season = normDate.substring(0, 4);

      // Hent eksisterende markedDays for klienten/sæsonen
      const resGet = await fetch(
        `${API_BASE}/api/calendar/marked-days?client_id=${encodeURIComponent(clientId)}&season=${season}`,
        token ? { headers: { Authorization: "Bearer " + token } } : undefined
      );
      let serverData = {};
      if (resGet.ok) {
        const data = await resGet.json();
        serverData = data.markedDays || {};
      }
      // Merge denne dag
      const updatedDays = { ...serverData };
      updatedDays[normDate] = {
        status: "on",
        onTime,
        offTime
      };

      const payload = {
        markedDays: {
          [String(clientId)]: updatedDays
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
      if (!res.ok) throw new Error();
      setStatus("success");
      if (onSaved) onSaved({ date: normDate, clientId });

      // HENT FRISKE TIDER EFTER GEM
      await fetchLatestTimes(clientId, normDate, season);
    } catch {
      setStatus("error");
    }
    setSaving(false);
  };

  return (
    <Dialog
      open={open}
      onClose={status === "error" ? onClose : undefined}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle sx={{ pb: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", position: "relative" }}>
          {/* “Gemt” indikationen i venstre hjørne */}
          {status === "success" && (
            <Typography
              sx={{
                position: "absolute",
                left: 0,
                top: 0,
                color: "#388e3c",
                fontWeight: "normal",
                fontSize: "1rem",
                pl: 0.5,
                pt: 0.5
              }}
            >
              Gemt
            </Typography>
          )}
          <span style={{ margin: "0 auto" }}>
            Redigér tid for {date}
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
            <TextField
              label="Tænd tid"
              type="time"
              value={onTime}
              onChange={e => setOnTime(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
              inputProps={{ step: 300 }}
            />
            <TextField
              label="Sluk tid"
              type="time"
              value={offTime}
              onChange={e => setOffTime(e.target.value)}
              fullWidth
              inputProps={{ step: 300 }}
            />
            {status === "error" && (
              <Alert severity="error" sx={{ mt: 1 }}>
                Fejl ved gemning eller hentning!
              </Alert>
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
          disabled={saving || loading}
        >
          {saving ? <CircularProgress size={20} /> : "Gem"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
