import React, { useState, useEffect } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
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
  Chip,
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
import { useNavigate } from "react-router-dom";
import {
  updateClient,
  pushKioskUrl,
  clientAction,
  openTerminal,
  openRemoteDesktop,
  getClient,
  getMarkedDays,
  getCurrentSeason,
} from "../api";

// ---------- Utility Functions ----------
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
    ? `${day}-${month}-${year}, Kl. ${hour}:${minute}:${second}`
    : `${day}-${month}-${year}, Kl. ${hour}:${minute}`;
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
          sx={{ ml: 1, p: 0.5 }}
          disabled={disabled}
        >
          <ContentCopyIcon sx={{ fontSize: iconSize }} color={copied ? "success" : "inherit"} />
        </IconButton>
      </span>
    </Tooltip>
  );
}

// ---------- Status Icons ----------
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

// ---------- Kalender Table ----------
function formatDateLong(dt) {
  return dt.toLocaleDateString("da-DK", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

// Matcher backend-format: "YYYY-MM-DDT00:00:00"
function getStatusAndTimesFromRaw(markedDays, dt) {
  const dateKey = `${dt.getFullYear()}-${(dt.getMonth()+1).toString().padStart(2,"0")}-${dt.getDate().toString().padStart(2,"0")}T00:00:00`;
  const data = markedDays[dateKey];
  if (!data || !data.status || data.status === "off") {
    return { status: "Slukket", color: "error", powerOn: "", powerOff: "" };
  }
  return {
    status: "Tændt",
    color: "success",
    powerOn: data.onTime || "",
    powerOff: data.offTime || ""
  };
}

function ClientPowerWeekTable({ markedDays }) {
  const days = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    days.push(d);
  }

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Dato</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Tænd</TableCell>
            <TableCell>Sluk</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {days.map((dt) => {
            const { status, color, powerOn, powerOff } = getStatusAndTimesFromRaw(markedDays, dt);
            return (
              <TableRow key={dt.toISOString().slice(0, 10)}>
                <TableCell>{formatDateLong(dt)}</TableCell>
                <TableCell>
                  <Chip label={status} color={color} size="small" sx={{ fontWeight: 600 }} />
                </TableCell>
                <TableCell>{powerOn}</TableCell>
                <TableCell>{powerOff}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ---------- Main Component ----------
export default function ClientDetailsPage({ client, refreshing, handleRefresh }) {
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

  const [markedDays, setMarkedDays] = useState({});
  const [calendarLoading, setCalendarLoading] = useState(false);

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
    }, 4130);
    return () => clearInterval(pollerStatus);
  }, [client?.id]);

  // Tænd/sluk kalender: Hent for aktuel sæson og klient
  useEffect(() => {
    async function fetchCalendar() {
      if (!client?.id) return;
      setCalendarLoading(true);
      try {
        const season = await getCurrentSeason();
        const res = await getMarkedDays(season.id, client.id);
        setMarkedDays(res?.markedDays || {});
      } catch {
        setMarkedDays({});
      }
      setCalendarLoading(false);
    }
    fetchCalendar();
  }, [client?.id]);

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ open: false, message: "", severity: "success" });
  };

  const actionBtnStyle = {
    minWidth: 180,
    maxWidth: 180,
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

        {/* ----------- Info-rækken med tre kolonner ----------- */}
        <Grid item xs={12} md={4}>
          <Card elevation={2} sx={{ borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Kalender</Typography>
              {calendarLoading ? (
                <Box sx={{ textAlign: "center", py: 3 }}>
                  <CircularProgress size={32} />
                  <Typography sx={{ mt: 2 }}>Indlæser Tænd/Sluk kalender...</Typography>
                </Box>
              ) : (
                <ClientPowerWeekTable markedDays={markedDays} />
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card elevation={2} sx={{ borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Systeminfo</Typography>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <MemoryIcon color="primary" />
                  <Typography sx={{ fontWeight: 600, minWidth: 90 }} variant="body2">
                    Ubuntu version:
                  </Typography>
                  <Typography variant="body2">{client.ubuntu_version || "ukendt"}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <AccessTimeIcon color="primary" />
                  <Typography sx={{ fontWeight: 600, minWidth: 90 }} variant="body2">
                    Oppetid:
                  </Typography>
                  <Typography variant="body2">{formatUptime(uptime)}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <AccessTimeIcon color="primary" />
                  <Typography sx={{ fontWeight: 600, minWidth: 90 }} variant="body2">
                    Sidst set:
                  </Typography>
                  <Typography variant="body2">
                    {formatDateTime(lastSeen, true)}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <AccessTimeIcon color="primary" />
                  <Typography sx={{ fontWeight: 600, minWidth: 90 }} variant="body2">
                    Tilføjet:
                  </Typography>
                  <Typography variant="body2">
                    {formatDateTime(client.created_at, true)}
                  </Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card elevation={2} sx={{ borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Netværksinfo</Typography>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <LanIcon color="primary" />
                  <Typography sx={{ fontWeight: 600, minWidth: 170 }} variant="body2">
                    IP-adresse WLAN:
                  </Typography>
                  <Typography variant="body2">{client.wifi_ip_address || "ukendt"}</Typography>
                  <CopyIconButton value={client.wifi_ip_address || "ukendt"} disabled={!client.wifi_ip_address} iconSize={14} />
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <LanIcon color="primary" />
                  <Typography sx={{ fontWeight: 600, minWidth: 170 }} variant="body2">
                    MAC-adresse WLAN:
                  </Typography>
                  <Typography variant="body2">{client.wifi_mac_address || "ukendt"}</Typography>
                  <CopyIconButton value={client.wifi_mac_address || "ukendt"} disabled={!client.wifi_mac_address} iconSize={14} />
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <LanIcon color="primary" />
                  <Typography sx={{ fontWeight: 600, minWidth: 170 }} variant="body2">
                    IP-adresse LAN:
                  </Typography>
                  <Typography variant="body2">{client.lan_ip_address || "ukendt"}</Typography>
                  <CopyIconButton value={client.lan_ip_address || "ukendt"} disabled={!client.lan_ip_address} iconSize={14} />
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <LanIcon color="primary" />
                  <Typography sx={{ fontWeight: 600, minWidth: 170 }} variant="body2">
                    MAC-adresse LAN:
                  </Typography>
                  <Typography variant="body2">{client.lan_mac_address || "ukendt"}</Typography>
                  <CopyIconButton value={client.lan_mac_address || "ukendt"} disabled={!client.lan_mac_address} iconSize={14} />
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* ----------- Action-knapper: Én række ----------- */}
        <Grid item xs={12}>
          <Card elevation={2} sx={{ borderRadius: 2 }}>
            <CardContent>
              <Stack direction="row" spacing={2} justifyContent="center" alignItems="center">
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
              </Stack>
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

        {/* ----------- Lokalitet og Kiosk-URL ----------- */}
        <Grid item xs={12} md={6}>
          <Card elevation={2} sx={{ borderRadius: 2 }}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <LocationOnIcon color="primary" />
                <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 90 }}>
                  Lokation:
                </Typography>
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
                  sx={{ minWidth: 44, maxWidth: 44 }}
                >
                  {savingLocality ? <CircularProgress size={16} /> : "Gem"}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card elevation={2} sx={{ borderRadius: 2 }}>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <ChromeReaderModeIcon color="primary" />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Kiosk URL:
                </Typography>
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
                  sx={{ minWidth: 44, maxWidth: 44 }}
                >
                  {savingKioskUrl ? <CircularProgress size={16} /> : "Gem"}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* ----------- Livestream Placeholder ----------- */}
        <Grid item xs={12}>
          <Card elevation={2} sx={{ borderRadius: 2 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                <VideocamIcon color="action" fontSize="large" />
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  Livestream fra klient
                </Typography>
              </Stack>
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
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
