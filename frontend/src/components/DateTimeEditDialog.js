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

// Dansk navne for ugedage og måneder
const WEEKDAYS = [
  "søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"
];
const MONTHS = [
  "januar", "februar", "marts", "april", "maj", "juni",
  "juli", "august", "september", "oktober", "november", "december"
];

// Formatter dato til "lørdag d. 2.august 2025"
function formatFullDate(dateStr) {
  if (!dateStr) return "";
  const [yyyy, mm, dd] = dateStr.split("T")[0].split("-");
  if (!yyyy || !mm || !dd) return "";
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  const weekday = WEEKDAYS[d.getDay()];
  const day = d.getDate();
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${weekday} d. ${day}.${month} ${year}`;
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

  function findDayObj(markedDays, normDate) {
    if (markedDays[normDate]) return markedDays[normDate];
    const key = Object.keys(markedDays).find(k => k.startsWith(normDate));
    return key ? markedDays[key] : {};
  }

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

      const resGet = await fetch(
        `${API_BASE}/api/calendar/marked-days?client_id=${encodeURIComponent(clientId)}&season=${season}`,
        token ? { headers: { Authorization: "Bearer " + token } } : undefined
      );
      let serverData = {};
      if (resGet.ok) {
        const data = await resGet.json();
        serverData = data.markedDays || {};
      }
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
      sx={{ position: "relative" }}
    >
      <DialogTitle sx={{ pb: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", position: "relative" }}>
          <span style={{ margin: "0 auto" }}>
            {date ? `Rediger tid for ${formatFullDate(date)}` : "Rediger tid"}
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
      {/* FEEDBACK nederst til venstre */}
      <Box
        sx={{
          position: "absolute",
          left: 16,
          bottom: 8,
          zIndex: 2,
          minWidth: 180,
          pointerEvents: "none"
        }}
      >
        {status === "error" && (
          <Alert severity="error" sx={{ mb: 1, py: 0.5, px: 2, fontSize: "1rem" }}>
            Fejl ved gemning eller hentning!
          </Alert>
        )}
        {status === "success" && (
          <Typography sx={{ color: "#388e3c", fontWeight: "normal", fontSize: "1rem", mb: 1 }}>
            Gemt
          </Typography>
        )}
        {saving && (
          <Typography sx={{ color: "#1976d2", fontWeight: "normal", fontSize: "1rem", mb: 1 }}>
            Gemmer...
          </Typography>
        )}
      </Box>
    </Dialog>
  );
}
