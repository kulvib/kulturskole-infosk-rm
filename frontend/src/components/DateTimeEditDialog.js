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

  // Hjælpefunktion til at finde dag-nøgle i API-data
  function findDayObj(markedDays, normDate) {
    if (markedDays[normDate]) return markedDays[normDate];
    // Søg efter nøgle der starter med normDate (fx "2025-08-01T00:00:00")
    const key = Object.keys(markedDays).find(k => k.startsWith(normDate));
    return key ? markedDays[key] : {};
  }

  // Hent tider fra API hver gang dialogen åbnes
  useEffect(() => {
    if (!open || !date || !clientId) return;
    setLoading(true);
    setStatus("");
    setOnTime(""); setOffTime("");
    const token = getToken();
    const normDate = date.split("T")[0];
    fetch(
      `${API_BASE}/api/calendar/marked-days?client_id=${encodeURIComponent(clientId)}&season=${normDate.slice(0, 4)}`,
      token ? { headers: { Authorization: "Bearer " + token } } : undefined
    )
      .then(res => res.json())
      .then(data => {
        const dayObj = findDayObj(data.markedDays || {}, normDate);
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
        setStatus("");
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

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setStatus("");
    try {
      const normDate = date.split("T")[0];
      const season = normDate.substring(0, 4);
      const token = getToken();

      // Hent eksisterende data fra API
      const resGet = await fetch(
        `${API_BASE}/api/calendar/marked-days?client_id=${encodeURIComponent(clientId)}&season=${season}`,
        token ? { headers: { Authorization: "Bearer " + token } } : undefined
      );
      let serverData = {};
      if (resGet.ok) {
        const data = await resGet.json();
        serverData = data.markedDays || {};
      }
      // Find korrekt nøgle, evt. med tid
      let updateKey = normDate;
      const existingKey = Object.keys(serverData).find(k => k.startsWith(normDate));
      if (existingKey) updateKey = existingKey;
      const updatedDays = { ...serverData };
      updatedDays[updateKey] = {
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

      // Hent nyeste tider fra API efter gem
      const resGet2 = await fetch(
        `${API_BASE}/api/calendar/marked-days?client_id=${encodeURIComponent(clientId)}&season=${season}`,
        token ? { headers: { Authorization: "Bearer " + token } } : undefined
      );
      if (resGet2.ok) {
        const data2 = await resGet2.json();
        const dayObj2 = findDayObj(data2.markedDays || {}, normDate);
        setOnTime(dayObj2.onTime || "");
        setOffTime(dayObj2.offTime || "");
      }
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
            <Box sx={{ mb: 2 }}>
              <Typography
                variant="subtitle2"
                sx={{ mb: 0.5, fontWeight: 500 }}
              >
                Tænd tid
              </Typography>
              <TextField
                type="time"
                fullWidth
                value={onTime}
                onChange={e => setOnTime(e.target.value)}
                InputProps={{
                  style: { backgroundColor: "#f6f6f6" }
                }}
                inputProps={{
                  step: 300,
                }}
              />
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography
                variant="subtitle2"
                sx={{ mb: 0.5, fontWeight: 500 }}
              >
                Sluk tid
              </Typography>
              <TextField
                type="time"
                fullWidth
                value={offTime}
                onChange={e => setOffTime(e.target.value)}
                InputProps={{
                  style: { backgroundColor: "#f6f6f6" }
                }}
                inputProps={{
                  step: 300,
                }}
              />
            </Box>
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
