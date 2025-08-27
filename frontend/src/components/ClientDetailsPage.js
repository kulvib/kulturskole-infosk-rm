import React, { useState, useEffect } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  CircularProgress,
  Tooltip,
  IconButton,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert as MuiAlert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import TerminalIcon from "@mui/icons-material/Terminal";
import DesktopWindowsIcon from "@mui/icons-material/DesktopWindows";
import VideocamIcon from "@mui/icons-material/Videocam";
import ChromeReaderModeIcon from "@mui/icons-material/ChromeReaderMode";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import LanIcon from "@mui/icons-material/Lan";
import MemoryIcon from "@mui/icons-material/Memory";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import RefreshIcon from "@mui/icons-material/Refresh";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import { useNavigate } from "react-router-dom";
import {
  updateClient,
  pushKioskUrl,
  clientAction,
  openTerminal,
  openRemoteDesktop,
  getClient,
} from "../api";
import ClientCalendarDialog from "./ClientCalendarDialog";

// ---------- Hjælpefunktioner ----------
function formatDateTime(dateStr, withSeconds = false) {
  if (!dateStr) return "ukendt";
  let d;
  if (dateStr.endsWith("Z") || dateStr.match(/[\+\-]\d{2}:?\d{2}$/)) {
    d = new Date(dateStr);
  } else {
    d = new Date(dateStr + "Z");
  }
  const formatter = new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
    hour12: false
  });
  const parts = formatter.formatToParts(d);
  const day = parts.find(p => p.type === "day")?.value || "";
  const month = parts.find(p => p.type === "month")?.value || "";
  const year = parts.find(p => p.type === "year")?.value || "";
  const hour = parts.find(p => p.type === "hour")?.value || "";
  const minute = parts.find(p => p.type === "minute")?.value || "";
  const second = withSeconds ? (parts.find(p => p.type === "second")?.value || "00") : undefined;
  return withSeconds
    ? `${day}.${month} ${year}, kl. ${hour}:${minute}:${second}`
    : `${day}.${month} ${year}, kl. ${hour}:${minute}`;
}

function formatUptime(uptimeStr) {
  if (!uptimeStr) return "ukendt";
  let totalSeconds = 0;
  if (uptimeStr.includes('-')) {
    const [d, hms] = uptimeStr.split('-');
    const [h = "0", m = "0", s = "0"] = hms.split(':');
    totalSeconds =
      parseInt(d, 10) * 86400 +
      parseInt(h, 10) * 3600 +
      parseInt(m, 10) * 60 +
      parseInt(s, 10);
  } else if (uptimeStr.includes(':')) {
    const parts = uptimeStr.split(':').map(Number);
    if (parts.length === 3) {
      totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      totalSeconds = parts[0] * 60 + parts[1];
    } else if (parts.length === 1) {
      totalSeconds = parts[0];
    }
  } else {
    totalSeconds = parseInt(uptimeStr, 10);
  }
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  return `${days} d., ${hours} t., ${mins} min., ${secs} sek.`;
}

function formatDateShort(dt) {
  const ukedage = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"];
  const dayName = ukedage[dt.getDay()];
  const day = dt.getDate().toString().padStart(2, "0");
  const month = (dt.getMonth() + 1).toString().padStart(2, "0");
  const year = dt.getFullYear();
  return `${dayName} ${day}.${month} ${year}`;
}

function getStatusAndTimesFromRaw(markedDays, dt) {
  const dateKey = `${dt.getFullYear()}-${(dt.getMonth()+1).toString().padStart(2,"0")}-${dt.getDate().toString().padStart(2,"0")}T00:00:00`;
  const data = markedDays[dateKey];
  if (!data || !data.status || data.status === "off") {
    return { status: "off", powerOn: "", powerOff: "" };
  }
  return {
    status: "on",
    powerOn: data.onTime || "",
    powerOff: data.offTime || ""
  };
}

// ---------- Komponenter ----------
function ClientStatusIcon({ isOnline }) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: "Roboto, Helvetica, Arial, sans-serif",
        fontSize: 13,
        fontWeight: 400,
        ml: 1,
      }}
    >
      <Box
        sx={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          bgcolor: isOnline ? theme.palette.success.main : theme.palette.error.main,
          boxShadow: "0 0 2px rgba(0,0,0,0.12)",
          border: "1px solid #ddd",
        }}
      />
      <span style={{ marginLeft: 6 }}>{isOnline ? "online" : "offline"}</span>
    </Box>
  );
}

function ChromeStatusIcon({ status, color }) {
  let fallbackColor = "grey.400";
  let text = status || "Ukendt";
  let dotColor = color || fallbackColor;

  if (!color && typeof status === "string") {
    const s = status.toLowerCase();
    if (s === "running") {
      dotColor = "#43a047";
      text = "Åben";
    } else if (s === "stopped" || s === "closed") {
      dotColor = "#e53935";
      text = "Lukket";
    } else if (s === "unknown") {
      dotColor = "grey.400";
      text = "Ukendt";
    } else if (s.includes("kører")) {
      dotColor = "#43a047";
      text = status;
    } else if (s.includes("lukket")) {
      dotColor = "#e53935";
      text = status;
    }
  }

  return (
    <Box sx={{ display: "inline-flex", alignItems: "center" }}>
      <Box
        sx={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          bgcolor: dotColor,
          boxShadow: "0 0 2px rgba(0,0,0,0.12)",
          border: "1px solid #ddd",
          mr: 1,
        }}
      />
      <Typography variant="body2" sx={{ fontWeight: 700 }}>{text}</Typography>
    </Box>
  );
}

function CopyIconButton({ value, disabled, iconSize = 16 }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {}
  };

  return (
    <Tooltip title={copied ? "Kopieret!" : "Kopiér"}>
      <span>
        <IconButton
          size="small"
          onClick={handleCopy}
          sx={{
            width: 24,
            height: 24,
            minWidth: 24,
            minHeight: 24,
            maxWidth: 24,
            maxHeight: 24,
            p: 0,
            m: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            verticalAlign: "middle",
          }}
          disabled={disabled}
        >
          <ContentCopyIcon sx={{ fontSize: iconSize }} color={copied ? "success" : "inherit"} />
        </IconButton>
      </span>
    </Tooltip>
  );
}

function StatusText({ status }) {
  return (
    <Typography
      variant="body2"
      sx={{
        fontWeight: 600,
        color: status === "on" ? "#43a047" : "#e53935",
        textTransform: "lowercase"
      }}
    >
      {status}
    </Typography>
  );
}

// --------- ÆNDRET: Netop denne komponent ---------
function ClientPowerShortTable({ markedDays }) {
  const days = [];
  const now = new Date();
  for (let i = 0; i < 3; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    days.push(d);
  }

  // 13px = 1.625 spacing units (8px per unit)
  const cellStyle = { whiteSpace: "nowrap", py: 0, px: 1.625 };

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ height: 30, minHeight: 30, maxHeight: 30 }}>
            <TableCell sx={cellStyle}>Dato</TableCell>
            <TableCell sx={cellStyle}>Status</TableCell>
            <TableCell sx={cellStyle}>Tænd</TableCell>
            <TableCell sx={cellStyle}>Sluk</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {days.map((dt) => {
            const { status, powerOn, powerOff } = getStatusAndTimesFromRaw(markedDays, dt);
            return (
              <TableRow key={dt.toISOString().slice(0, 10)} sx={{ height: 30, minHeight: 30, maxHeight: 30 }}>
                <TableCell sx={cellStyle}>{formatDateShort(dt)}</TableCell>
                <TableCell sx={cellStyle}><StatusText status={status} /></TableCell>
                <TableCell sx={cellStyle}>
                  {status === "on" && powerOn ? powerOn : ""}
                </TableCell>
                <TableCell sx={cellStyle}>
                  {status === "on" && powerOff ? powerOff : ""}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// --------- Systeminfo med ens rækkeafstand ---------
function SystemInfoTable({ client, uptime, lastSeen }) {
  const cellStyle = {
    border: 0,
    fontWeight: 600,
    whiteSpace: "nowrap",
    pr: 0.5,
    py: 0,
    verticalAlign: "middle",
    height: 30,
    minHeight: 30,
    maxHeight: 30,
  };
  const valueCellStyle = {
    border: 0,
    pl: 0.5,
    py: 0,
    verticalAlign: "middle",
    height: 30,
    minHeight: 30,
    maxHeight: 30,
  };
  return (
    <TableContainer>
      <Table size="small" aria-label="systeminfo">
        <TableBody>
          <TableRow sx={{ height: 30, minHeight: 30, maxHeight: 30 }}>
            <TableCell sx={cellStyle}>Ubuntu version:</TableCell>
            <TableCell sx={valueCellStyle}>
              <Box sx={{ display: "flex", alignItems: "center", lineHeight: "30px" }}>
                {client.ubuntu_version || "ukendt"}
              </Box>
            </TableCell>
          </TableRow>
          <TableRow sx={{ height: 30, minHeight: 30, maxHeight: 30 }}>
            <TableCell sx={cellStyle}>Oppetid:</TableCell>
            <TableCell sx={valueCellStyle}>
              <Box sx={{ display: "flex", alignItems: "center", lineHeight: "30px" }}>
                {formatUptime(uptime)}
              </Box>
            </TableCell>
          </TableRow>
          <TableRow sx={{ height: 30, minHeight: 30, maxHeight: 30 }}>
            <TableCell sx={cellStyle}>Sidst set:</TableCell>
            <TableCell sx={valueCellStyle}>
              <Box sx={{ display: "flex", alignItems: "center", lineHeight: "30px" }}>
                {formatDateTime(lastSeen, true)}
              </Box>
            </TableCell>
          </TableRow>
          <TableRow sx={{ height: 30, minHeight: 30, maxHeight: 30 }}>
            <TableCell sx={cellStyle}>Tilføjet:</TableCell>
            <TableCell sx={valueCellStyle}>
              <Box sx={{ display: "flex", alignItems: "center", lineHeight: "30px" }}>
                {formatDateTime(client.created_at, true)}
              </Box>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// --------- Netværksinfo med ens rækkeafstand ---------
function NetworkInfoTable({ client }) {
  const cellStyle = {
    border: 0,
    fontWeight: 600,
    whiteSpace: "nowrap",
    pr: 0.5,
    py: 0,
    verticalAlign: "middle",
    height: 30,
    minHeight: 30,
    maxHeight: 30,
  };
  const valueCellStyle = {
    border: 0,
    pl: 0.5,
    py: 0,
    verticalAlign: "middle",
    height: 30,
    minHeight: 30,
    maxHeight: 30,
  };
  return (
    <TableContainer>
      <Table size="small" aria-label="netværksinfo">
        <TableBody>
          <TableRow sx={{ height: 30, minHeight: 30, maxHeight: 30 }}>
            <TableCell sx={cellStyle}>IP-adresse WLAN:</TableCell>
            <TableCell sx={valueCellStyle}>
              <Box sx={{ display: "flex", alignItems: "center", lineHeight: "30px" }}>
                {client.wifi_ip_address || "ukendt"}
                <CopyIconButton value={client.wifi_ip_address || "ukendt"} disabled={!client.wifi_ip_address} iconSize={14} />
              </Box>
            </TableCell>
          </TableRow>
          <TableRow sx={{ height: 30, minHeight: 30, maxHeight: 30 }}>
            <TableCell sx={cellStyle}>MAC-adresse WLAN:</TableCell>
            <TableCell sx={valueCellStyle}>
              <Box sx={{ display: "flex", alignItems: "center", lineHeight: "30px" }}>
                {client.wifi_mac_address || "ukendt"}
                <CopyIconButton value={client.wifi_mac_address || "ukendt"} disabled={!client.wifi_mac_address} iconSize={14} />
              </Box>
            </TableCell>
          </TableRow>
          <TableRow sx={{ height: 30, minHeight: 30, maxHeight: 30 }}>
            <TableCell sx={cellStyle}>IP-adresse LAN:</TableCell>
            <TableCell sx={valueCellStyle}>
              <Box sx={{ display: "flex", alignItems: "center", lineHeight: "30px" }}>
                {client.lan_ip_address || "ukendt"}
                <CopyIconButton value={client.lan_ip_address || "ukendt"} disabled={!client.lan_ip_address} iconSize={14} />
              </Box>
            </TableCell>
          </TableRow>
          <TableRow sx={{ height: 30, minHeight: 30, maxHeight: 30 }}>
            <TableCell sx={cellStyle}>MAC-adresse LAN:</TableCell>
            <TableCell sx={valueCellStyle}>
              <Box sx={{ display: "flex", alignItems: "center", lineHeight: "30px" }}>
                {client.lan_mac_address || "ukendt"}
                <CopyIconButton value={client.lan_mac_address || "ukendt"} disabled={!client.lan_mac_address} iconSize={14} />
              </Box>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ---------- Hovedkomponent ----------
export default function ClientDetailsPage({
  client,
  refreshing,
  handleRefresh,
  markedDays,
}) {
  const [locality, setLocality] = useState("");
  const [localityDirty, setLocalityDirty] = useState(false);
  const [savingLocality, setSavingLocality] = useState(false);

  const [kioskUrl, setKioskUrl] = useState("");
  const [kioskUrlDirty, setKioskUrlDirty] = useState(false);
  const [savingKioskUrl, setSavingKioskUrl] = useState(false);

  const [actionLoading, setActionLoading] = useState({});
  const [shutdownDialogOpen, setShutdownDialogOpen] = useState(false);

  const [liveChromeStatus, setLiveChromeStatus] = useState(client?.chrome_status || "unknown");
  const [liveChromeColor, setLiveChromeColor] = useState(client?.chrome_color || null);
  const [lastSeen, setLastSeen] = useState(client?.last_seen || null);
  const [uptime, setUptime] = useState(client?.uptime || null);

  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  // NYT! State til kalender-dialogen
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (client) {
      if (!localityDirty) setLocality(client.locality || "");
      if (!kioskUrlDirty) setKioskUrl(client.kiosk_url || "");
      setLiveChromeStatus(client.chrome_status || "unknown");
      setLiveChromeColor(client.chrome_color || null);
      setLastSeen(client.last_seen || null);
      setUptime(client.uptime || null);
    }
    // eslint-disable-next-line
  }, [client]);

  useEffect(() => {
    if (!client?.id) return;
    const pollerStatus = setInterval(async () => {
      try {
        const updated = await getClient(client.id);
        setLiveChromeStatus(updated.chrome_status || "unknown");
        setLiveChromeColor(updated.chrome_color || null);
        setLastSeen(updated.last_seen || null);
        setUptime(updated.uptime || null);
      } catch {}
    }, 1000);
    return () => clearInterval(pollerStatus);
  }, [client?.id]);

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ open: false, message: "", severity: "success" });
  };

  const actionBtnStyle = {
    minWidth: 200,
    maxWidth: 200,
    height: 36,
    textTransform: "none",
    fontWeight: 500,
    fontSize: "0.95rem",
    lineHeight: 1.1,
    py: 0,
    px: 1,
    m: 0,
    whiteSpace: "nowrap",
    display: "inline-flex",
    justifyContent: "center"
  };
  const inputStyle = {
    width: 300,
    height: 32,
    "& .MuiInputBase-input": { fontSize: "0.95rem", height: "32px", boxSizing: "border-box", padding: "8px 14px" },
    "& .MuiInputBase-root": { height: "32px" },
  };
  const kioskInputStyle = {
    width: 550,
    height: 32,
    "& .MuiInputBase-input": { fontSize: "0.95rem", height: "32px", boxSizing: "border-box", padding: "8px 14px" },
    "& .MuiInputBase-root": { height: "32px" },
  };

  const handleLocalityChange = (e) => {
    setLocality(e.target.value);
    setLocalityDirty(true);
  };
  const handleLocalitySave = async () => {
    setSavingLocality(true);
    try {
      await updateClient(client.id, { locality });
      setLocalityDirty(false);
      showSnackbar("Lokation gemt!", "success");
    } catch (err) {
      showSnackbar("Kunne ikke gemme lokation: " + err.message, "error");
    }
    setSavingLocality(false);
  };

  const handleKioskUrlChange = (e) => {
    setKioskUrl(e.target.value);
    setKioskUrlDirty(true);
  };
  const handleKioskUrlSave = async () => {
    setSavingKioskUrl(true);
    try {
      await pushKioskUrl(client.id, kioskUrl);
      setKioskUrlDirty(false);
      showSnackbar("Kiosk webadresse opdateret!", "success");
    } catch (err) {
      showSnackbar("Kunne ikke opdatere kiosk webadresse: " + err.message, "error");
    }
    setSavingKioskUrl(false);
  };

  const handleClientAction = async (action) => {
    setActionLoading((prev) => ({ ...prev, [action]: true }));
    try {
      await clientAction(client.id, action);
      showSnackbar("Handlingen blev udført!", "success");
      const updated = await getClient(client.id);
      setLiveChromeStatus(updated.chrome_status || "unknown");
      setLiveChromeColor(updated.chrome_color || null);
      setLastSeen(updated.last_seen || null);
      setUptime(updated.uptime || null);
    } catch (err) {
      showSnackbar("Fejl: " + err.message, "error");
    }
    setActionLoading((prev) => ({ ...prev, [action]: false }));
  };

  const handleOpenTerminal = () => openTerminal(client.id);
  const handleOpenRemoteDesktop = () => openRemoteDesktop(client.id);

  if (!client) {
    return (
      <Box sx={{ maxWidth: 1200, mx: "auto", mt: 4 }}>
        <Card sx={{ p: 3 }}>
          <Typography variant="h6">Klientdata indlæses...</Typography>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", mt: 3 }}>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <MuiAlert elevation={6} variant="filled" onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </MuiAlert>
      </Snackbar>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/clients")}
          sx={{
            textTransform: "none",
            fontWeight: 500,
            minWidth: 0,
            px: 2,
          }}
        >
          Tilbage til klientoversigt
        </Button>
        <Tooltip title="Opdater klient">
          <span>
            <Button
              startIcon={refreshing ? <CircularProgress size={18} /> : <RefreshIcon fontSize="medium" />}
              disabled={refreshing}
              color="primary"
              onClick={handleRefresh}
              sx={{ fontWeight: 500, textTransform: "none", minWidth: 0, mr: 1, px: 2 }}
            >
              {refreshing ? "Opdaterer..." : "Opdater"}
            </Button>
          </span>
        </Tooltip>
      </Box>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Card elevation={2} sx={{ borderRadius: 2, mb: 2 }}>
            <CardContent>
              <Box>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    lineHeight: 1.2,
                    letterSpacing: 0.5,
                    fontSize: { xs: "1rem", sm: "1.15rem", md: "1.25rem" },
                  }}
                >
                  {client.name}
                </Typography>
              </Box>
              <Box mt={2}>
                <TableContainer>
                  <Table size="small" aria-label="client-details">
                    <TableBody>
                      <TableRow sx={{ height: 30, minHeight: 30, maxHeight: 30 }}>
                        <TableCell sx={{ border: 0, fontWeight: 600, whiteSpace: "nowrap", pr: 0.5, py: 0, verticalAlign: "middle", height: 30, minHeight: 30, maxHeight: 30 }}>
                          Klient ID:
                        </TableCell>
                        <TableCell sx={{ border: 0, pl: 0.5, py: 0, verticalAlign: "middle", height: 30, minHeight: 30, maxHeight: 30 }}>
                          <Box sx={{ display: "flex", alignItems: "center", lineHeight: "30px" }}>
                            <Typography 
                              variant="body2" 
                              sx={{ color: "text.primary", fontWeight: 700, fontSize: "0.9rem", display: "inline" }}
                            >
                              {client.id}
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                      <TableRow sx={{ height: 30, minHeight: 30, maxHeight: 30 }}>
                        <TableCell sx={{ border: 0, fontWeight: 600, whiteSpace: "nowrap", pr: 0.5, py: 0, verticalAlign: "middle", height: 30, minHeight: 30, maxHeight: 30 }}>
                          Lokation:
                        </TableCell>
                        <TableCell sx={{ border: 0, pl: 0.5, py: 0, verticalAlign: "middle", height: 30, minHeight: 30, maxHeight: 30 }}>
                          <Box sx={{ display: "flex", alignItems: "center", lineHeight: "30px" }}>
                            <TextField
                              size="small"
                              value={locality}
                              onChange={handleLocalityChange}
                              sx={inputStyle}
                              disabled={savingLocality}
                            />
                            <CopyIconButton value={locality} disabled={!locality} iconSize={15} />
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={handleLocalitySave}
                              disabled={savingLocality}
                              sx={{ minWidth: 44, maxWidth: 44, ml: 1 }}
                            >
                              {savingLocality ? <CircularProgress size={16} /> : "Gem"}
                            </Button>
                          </Box>
                        </TableCell>
                      </TableRow>
                      <TableRow sx={{ height: 30, minHeight: 30, maxHeight: 30 }}>
                        <TableCell sx={{ border: 0, fontWeight: 600, whiteSpace: "nowrap", pr: 0.5, py: 0, verticalAlign: "middle", height: 30, minHeight: 30, maxHeight: 30 }}>
                          Kiosk URL:
                        </TableCell>
                        <TableCell sx={{ border: 0, pl: 0.5, py: 0, verticalAlign: "middle", height: 30, minHeight: 30, maxHeight: 30 }}>
                          <Box sx={{ display: "flex", alignItems: "center", lineHeight: "30px" }}>
                            <TextField
                              size="small"
                              value={kioskUrl}
                              onChange={handleKioskUrlChange}
                              sx={kioskInputStyle}
                              disabled={savingKioskUrl}
                            />
                            <CopyIconButton value={kioskUrl} disabled={!kioskUrl} iconSize={15} />
                            <Button
                              size="small"
                              variant="outlined"
                              color="primary"
                              onClick={handleKioskUrlSave}
                              disabled={savingKioskUrl}
                              sx={{ minWidth: 44, maxWidth: 44, ml: 1 }}
                            >
                              {savingKioskUrl ? <CircularProgress size={16} /> : "Gem"}
                            </Button>
                          </Box>
                        </TableCell>
                      </TableRow>
                      <TableRow sx={{ height: 30, minHeight: 30, maxHeight: 30 }}>
                        <TableCell sx={{ border: 0, fontWeight: 600, whiteSpace: "nowrap", pr: 0.5, py: 0, verticalAlign: "middle", height: 30, minHeight: 30, maxHeight: 30 }}>
                          Kiosk browser status:
                        </TableCell>
                        <TableCell sx={{ border: 0, pl: 0.5, py: 0, verticalAlign: "middle", height: 30, minHeight: 30, maxHeight: 30 }}>
                          <Box sx={{ display: "inline-flex", alignItems: "center", verticalAlign: "middle", lineHeight: "30px" }}>
                            <ClientStatusIcon isOnline={client.isOnline} />
                            <ChromeStatusIcon status={liveChromeStatus} color={liveChromeColor} />
                          </Box>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        {/* ----------- NY TRE-KOLONNE SEKTION ----------- */}
        <Grid item xs={12}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Card elevation={2} sx={{ borderRadius: 2, height: "100%" }}>
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
                      Kalender
                    </Typography>
                    <Tooltip title="Vis kalender">
                      <span>
                        <Button
                          size="small"
                          variant="text"
                          sx={{
                            minWidth: 0,
                            color: "text.secondary",
                            fontSize: "0.85rem",
                            textTransform: "none",
                            px: 1,
                            verticalAlign: "middle",
                            borderRadius: 8
                          }}
                          onClick={() => setCalendarDialogOpen(true)}
                        >
                          <ArrowForwardIosIcon sx={{ fontSize: 16 }} />
                        </Button>
                      </span>
                    </Tooltip>
                  </Box>
                  <ClientPowerShortTable markedDays={markedDays} />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card elevation={2} sx={{ borderRadius: 2, height: "100%" }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                    Systeminfo
                  </Typography>
                  <SystemInfoTable client={client} uptime={uptime} lastSeen={lastSeen} />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card elevation={2} sx={{ borderRadius: 2, height: "100%" }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                    Netværksinfo
                  </Typography>
                  <NetworkInfoTable client={client} />
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>
        {/* ----------- SLUT NY TRE-KOLONNE SEKTION ----------- */}
        <Grid item xs={12}>
          <Card elevation={2} sx={{ borderRadius: 2, mb: 2 }}>
            <CardContent sx={{ px: 2 }}>
              <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", width: "100%", mb: 2, columnGap: "20px" }}>
                <Tooltip title="Start kiosk browser">
                  <span>
                    <Button
                      variant="outlined"
                      color="primary"
                      startIcon={<ChromeReaderModeIcon />}
                      disabled={actionLoading["chrome-start"]}
                      onClick={() => handleClientAction("chrome-start")}
                      sx={actionBtnStyle}
                    >
                      {actionLoading["chrome-start"] ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                      Start kiosk browser
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip title="Luk kiosk browser">
                  <span>
                    <Button
                      variant="outlined"
                      color="secondary"
                      startIcon={<PowerSettingsNewIcon />}
                      disabled={actionLoading["chrome-shutdown"]}
                      onClick={() => handleClientAction("chrome-shutdown")}
                      sx={actionBtnStyle}
                    >
                      {actionLoading["chrome-shutdown"] ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                      Luk kiosk browser
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip title="Fjernskrivebord på klient">
                  <span>
                    <Button
                      variant="outlined"
                      color="primary"
                      startIcon={<DesktopWindowsIcon />}
                      onClick={handleOpenRemoteDesktop}
                      sx={actionBtnStyle}
                    >
                      Fjernskrivebord
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip title="Terminal på klient">
                  <span>
                    <Button
                      variant="outlined"
                      color="inherit"
                      startIcon={<TerminalIcon />}
                      onClick={handleOpenTerminal}
                      sx={actionBtnStyle}
                    >
                      Terminal på klient
                    </Button>
                  </span>
                </Tooltip>
              </Box>
              <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", width: "100%", columnGap: "20px" }}>
                <Tooltip title="Genstart klient">
                  <span>
                    <Button
                      variant="contained"
                      color="warning"
                      startIcon={<RestartAltIcon />}
                      disabled={actionLoading["restart"]}
                      onClick={() => handleClientAction("restart")}
                      sx={actionBtnStyle}
                    >
                      {actionLoading["restart"] ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                      Genstart klient
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip title="Sluk klient">
                  <span>
                    <Button
                      variant="contained"
                      color="error"
                      startIcon={<PowerSettingsNewIcon />}
                      disabled={actionLoading["shutdown"]}
                      onClick={() => setShutdownDialogOpen(true)}
                      sx={actionBtnStyle}
                    >
                      {actionLoading["shutdown"] ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                      Sluk klient
                    </Button>
                  </span>
                </Tooltip>
              </Box>
              <Dialog open={shutdownDialogOpen} onClose={() => setShutdownDialogOpen(false)}>
                <DialogTitle>Bekræft slukning af klient</DialogTitle>
                <DialogContent>
                  <Typography>
                    <strong>Ved dette valg skal klienten startes manuelt lokalt.</strong>
                    <br />
                    Er du sikker på, at du vil slukke klienten?
                  </Typography>
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setShutdownDialogOpen(false)} color="primary">
                    Annuller
                  </Button>
                  <Button
                    onClick={async () => {
                      setShutdownDialogOpen(false);
                      await handleClientAction("shutdown");
                    }}
                    color="error"
                    variant="contained"
                  >
                    Ja, sluk klienten
                  </Button>
                </DialogActions>
              </Dialog>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12}>
          <Card elevation={2} sx={{ borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", mb: 2 }}>
                <VideocamIcon color="action" fontSize="large" />
                <Typography variant="body2" sx={{ fontWeight: 700, ml: 1 }}>
                  Livestream fra klient
                </Typography>
              </Box>
              <Box sx={{
                p: 2,
                border: "1px solid #eee",
                borderRadius: 2,
                background: "#fafafa",
                textAlign: "center",
                color: "#888",
                fontStyle: "italic",
                fontSize: "0.95rem"
              }}>
                Livestream placeholder (MJPEG/WebRTC)
              </Box>
            </Card>
