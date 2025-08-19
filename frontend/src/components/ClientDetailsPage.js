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
  getClientStream,
} from "../api";

// Tilføj denne import for live status
import { getClient } from "../api";

// Dansk tid, robust, inklusive sekunder for "Sidst set"/"Tilføjet"
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
  let days = 0, hours = 0, mins = 0;
  if (uptimeStr.includes('-')) {
    const [d, hms] = uptimeStr.split('-');
    days = parseInt(d, 10);
    const [h, m] = hms.split(':');
    hours = parseInt(h, 10);
    mins = parseInt(m, 10);
  } else if (uptimeStr.includes(':')) {
    const [h, m] = uptimeStr.split(':');
    hours = parseInt(h, 10);
    mins = parseInt(m, 10);
  } else {
    const totalSeconds = parseInt(uptimeStr, 10);
    days = Math.floor(totalSeconds / 86400);
    hours = Math.floor((totalSeconds % 86400) / 3600);
    mins = Math.floor((totalSeconds % 3600) / 60);
  }
  if (hours >= 24) {
    days += Math.floor(hours / 24);
    hours = hours % 24;
  }
  return `${days} dage, ${hours} timer, ${mins} minutter`;
}

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

function ChromeStatusIcon({ status }) {
  let color = "grey.400";
  let text = "Ukendt";
  if (status === "running") {
    color = "success.main";
    text = "Åben";
  } else if (status === "stopped") {
    color = "error.main";
    text = "Lukket";
  }
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Box
        sx={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          bgcolor: color,
          boxShadow: "0 0 2px rgba(0,0,0,0.12)",
          border: "1px solid #ddd",
        }}
      />
      <Typography variant="body2" sx={{ fontWeight: 700 }}>{text}</Typography>
    </Stack>
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
          sx={{ ml: 1, p: 0.5 }}
          disabled={disabled}
        >
          <ContentCopyIcon sx={{ fontSize: iconSize }} color={copied ? "success" : "inherit"} />
        </IconButton>
      </span>
    </Tooltip>
  );
}

export default function ClientDetailsPage({ client, refreshing, handleRefresh }) {
  const [locality, setLocality] = useState("");
  const [localityDirty, setLocalityDirty] = useState(false);
  const [savingLocality, setSavingLocality] = useState(false);
  const [localitySaved, setLocalitySaved] = useState(false);

  const [kioskUrl, setKioskUrl] = useState("");
  const [kioskUrlDirty, setKioskUrlDirty] = useState(false);
  const [savingKioskUrl, setSavingKioskUrl] = useState(false);
  const [kioskUrlSaved, setKioskUrlSaved] = useState(false);

  const [actionLoading, setActionLoading] = useState({});
  const [shutdownDialogOpen, setShutdownDialogOpen] = useState(false);

  // NYT: Live opdatering af chrome_status
  const [liveChromeStatus, setLiveChromeStatus] = useState(client?.chrome_status || "unknown");

  const navigate = useNavigate();

  useEffect(() => {
    if (client) {
      if (!localityDirty) setLocality(client.locality || "");
      if (!kioskUrlDirty) setKioskUrl(client.kiosk_url || "");
      setLiveChromeStatus(client.chrome_status || "unknown");
    }
    // eslint-disable-next-line
  }, [client]);

  // NYT: Poll chrome_status hvert 5 sekund
  useEffect(() => {
    if (!client?.id) return;
    const poller = setInterval(async () => {
      try {
        const updated = await getClient(client.id);
        setLiveChromeStatus(updated.chrome_status || "unknown");
      } catch {}
    }, 5000);
    return () => clearInterval(poller);
  }, [client?.id]);

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
      setLocalitySaved(true);
      setLocalityDirty(false);
      setTimeout(() => setLocalitySaved(false), 3000);
    } catch (err) {
      alert("Kunne ikke gemme lokation: " + err.message);
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
      setKioskUrlSaved(true);
      setKioskUrlDirty(false);
      setTimeout(() => setKioskUrlSaved(false), 3000);
    } catch (err) {
      alert("Kunne ikke opdatere kiosk webadresse: " + err.message);
    }
    setSavingKioskUrl(false);
  };

  const handleClientAction = async (action) => {
    setActionLoading((prev) => ({ ...prev, [action]: true }));
    try {
      await clientAction(client.id, action);
    } catch (err) {
      alert("Handlingen mislykkedes: " + err.message);
    }
    setActionLoading((prev) => ({ ...prev, [action]: false }));
  };

  const handleOpenTerminal = () => openTerminal(client.id);
  const handleOpenRemoteDesktop = () => openRemoteDesktop(client.id);

  const sectionSpacing = 2;

  if (!client) {
    return (
      <Box sx={{ maxWidth: 800, mx: "auto", mt: 4 }}>
        <Card sx={{ p: 3 }}>
          <Typography variant="h6">Klientdata indlæses...</Typography>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", mt: 3 }}>
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
      <Grid container spacing={sectionSpacing}>
        <Grid item xs={12}>
          <Card elevation={2} sx={{ borderRadius: 2, mb: 2 }}>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" alignItems="center" spacing={1}>
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
                  <ClientStatusIcon isOnline={client.isOnline} />
                </Stack>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <LanIcon color="primary" />
                  <Typography sx={{ fontWeight: 600, minWidth: 90 }} variant="body2">
                    Klient ID:
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ color: "text.primary", fontWeight: 700, fontSize: "0.9rem" }}
                  >
                    {client.id}
                  </Typography>
                </Stack>
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
                    sx={{ ...actionBtnStyle, minWidth: 44, maxWidth: 44 }}
                  >
                    {savingLocality ? <CircularProgress size={16} /> : "Gem"}
                  </Button>
                  {localitySaved && (
                    <Typography variant="body2" color="success.main" sx={{ ml: 2 }}>
                      Gemt
                    </Typography>
                  )}
                </Stack>
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
                    sx={{ ...actionBtnStyle, minWidth: 44, maxWidth: 44 }}
                  >
                    {savingKioskUrl ? <CircularProgress size={16} /> : "Gem"}
                  </Button>
                  {kioskUrlSaved && (
                    <Typography variant="body2" color="success.main" sx={{ ml: 2 }}>
                      Gemt
                    </Typography>
                  )}
                </Stack>

                {/* NY LINJE: Kiosk browser status, farvet og live */}
                <Stack direction="row" spacing={2} alignItems="center">
                  <ChromeReaderModeIcon color="primary" />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Kiosk browser status:
                  </Typography>
                  <ChromeStatusIcon status={liveChromeStatus} />
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card elevation={2} sx={{ borderRadius: 2, height: "100%" }}>
            <CardContent sx={{
              height: "100%",
              p: 3
            }}>
              <Stack spacing={2} sx={{ width: "100%" }} alignItems="flex-start">
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
                  <Typography variant="body2">{formatUptime(client.uptime)}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <AccessTimeIcon color="primary" />
                  <Typography sx={{ fontWeight: 600, minWidth: 90 }} variant="body2">
                    Sidst set:
                  </Typography>
                  <Typography variant="body2">
                    {formatDateTime(client.last_seen, true)}
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
        <Grid item xs={12} md={6}>
          <Card elevation={2} sx={{ borderRadius: 2, height: "100%" }}>
            <CardContent sx={{
              height: "100%",
              p: 3
            }}>
              <Stack spacing={2} sx={{ width: "100%" }} alignItems="flex-start">
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
        <Grid item xs={12}>
          <Card elevation={2} sx={{ borderRadius: 2, mb: 2 }}>
            <CardContent sx={{ px: 2 }}>
              <Stack direction="row" spacing={2} alignItems="center" justifyContent="center" sx={{ width: "100%", mb: 2 }}>
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
              </Stack>
              <Stack direction="row" spacing={2} alignItems="center" justifyContent="center" sx={{ width: "100%" }}>
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
