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
  useTheme,
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
import { useNavigate } from "react-router-dom";
import {
  updateClient,
  pushKioskUrl,
  clientAction,
  openTerminal,
  getClientStream,
} from "../api";

function formatDateTime(dateStr) {
  if (!dateStr) return "ukendt";
  const d = new Date(dateStr);
  return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}.${d.getFullYear()}, Kl. ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
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
          bgcolor: isOnline ? theme.palette.success.main : "#CC3300",
          boxShadow: "0 0 2px rgba(0,0,0,0.12)",
          border: "1px solid #ddd",
        }}
      />
      <span style={{ marginLeft: 6 }}>{isOnline ? "online" : "offline"}</span>
    </Box>
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

  const navigate = useNavigate();

  useEffect(() => {
    if (client) {
      if (!localityDirty) setLocality(client.locality || "");
      if (!kioskUrlDirty) setKioskUrl(client.kiosk_url || "");
    }
    // eslint-disable-next-line
  }, [client]);

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
  const handleOpenRemoteDesktop = () => {
    window.open(`/remote-desktop/${client.id}`, "_blank", "noopener,noreferrer");
  };

  const sectionSpacing = 2;
  const cardMinHeight = 210;

  // Stil til knapper i felt 4
  const actionBtnStyle = {
    minWidth: 160,
    maxWidth: 160,
    height: 34,
    textTransform: "none",
    fontWeight: 500,
    fontSize: "0.95rem",
    lineHeight: 1.1,
    py: 0,
    px: 1,
    m: 0,
    whiteSpace: "nowrap",
  };

  // Stil til små input-felter
  const inputStyle = {
    width: 300,
    height: 34,
    "& .MuiInputBase-input": { fontSize: "0.95rem", height: "34px", boxSizing: "border-box", padding: "8px 14px" },
    "& .MuiInputBase-root": { height: "34px" },
  };
  const kioskInputStyle = {
    width: 480,
    height: 34,
    "& .MuiInputBase-input": { fontSize: "0.95rem", height: "34px", boxSizing: "border-box", padding: "8px 14px" },
    "& .MuiInputBase-root": { height: "34px" },
  };

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
      {/* Topbar med tilbage og opdater */}
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
                  <Typography variant="body2" sx={{ color: "#888" }}>{client.id}</Typography>
                </Stack>
                {/* Lokation */}
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
                {/* Kiosk webadresse */}
                <Stack direction="row" spacing={2} alignItems="center">
                  <ChromeReaderModeIcon color="primary" />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Kiosk webadresse:
                  </Typography>
                  <TextField
                    size="small"
                    value={kioskUrl}
                    onChange={handleKioskUrlChange}
                    sx={kioskInputStyle}
                    disabled={savingKioskUrl}
                  />
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
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          {/* Felt 2: Oppetid, Sidst set, Tilføjet */}
          <Card elevation={2} sx={{ borderRadius: 2, height: "100%" }}>
            <CardContent sx={{ minHeight: cardMinHeight }}>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <AccessTimeIcon color="primary" />
                  <Typography sx={{ fontWeight: 600, minWidth: 90 }} variant="body2">
                    Oppetid:
                  </Typography>
                  <Typography variant="body2">{client.uptime || "ukendt"}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <AccessTimeIcon color="primary" />
                  <Typography sx={{ fontWeight: 600, minWidth: 90 }} variant="body2">
                    Sidst set:
                  </Typography>
                  <Typography variant="body2">
                    {formatDateTime(client.last_seen)}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <AccessTimeIcon color="primary" />
                  <Typography sx={{ fontWeight: 600, minWidth: 90 }} variant="body2">
                    Tilføjet:
                  </Typography>
                  <Typography variant="body2">
                    {formatDateTime(client.created_at)}
                  </Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          {/* Felt 3: Ubuntu version + IP/MAC */}
          <Card elevation={2} sx={{ borderRadius: 2, height: "100%" }}>
            <CardContent sx={{ minHeight: cardMinHeight }}>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <MemoryIcon color="primary" />
                  <Typography sx={{ fontWeight: 600, minWidth: 90 }} variant="body2">
                    Ubuntu version:
                  </Typography>
                  <Typography variant="body2">{client.ubuntu_version || "ukendt"}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <LanIcon color="primary" />
                  <Typography sx={{ fontWeight: 600, minWidth: 170 }} variant="body2">
                    IP-adresse WLAN:
                  </Typography>
                  <Typography variant="body2">{client.wifi_ip_address || "ukendt"}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <LanIcon color="primary" />
                  <Typography sx={{ fontWeight: 600, minWidth: 170 }} variant="body2">
                    MAC-adresse WLAN:
                  </Typography>
                  <Typography variant="body2">{client.wifi_mac_address || "ukendt"}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <LanIcon color="primary" />
                  <Typography sx={{ fontWeight: 600, minWidth: 170 }} variant="body2">
                    IP-adresse LAN:
                  </Typography>
                  <Typography variant="body2">{client.lan_ip_address || "ukendt"}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <LanIcon color="primary" />
                  <Typography sx={{ fontWeight: 600, minWidth: 170 }} variant="body2">
                    MAC-adresse LAN:
                  </Typography>
                  <Typography variant="body2">{client.lan_mac_address || "ukendt"}</Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        {/* Felt 4: Knapper/handlinger med ens dimensioner og på linje */}
        <Grid item xs={12}>
          <Card elevation={2} sx={{ borderRadius: 2 }}>
            <CardContent sx={{ px: 2 }}>
              <Stack direction="row" spacing={2} alignItems="center" justifyContent="center" sx={{ width: "100%" }}>
                <Tooltip title="Luk Chrome Browser på klient">
                  <span>
                    <Button
                      variant="outlined"
                      color="secondary"
                      startIcon={<PowerSettingsNewIcon />}
                      onClick={() => handleClientAction("chrome-shutdown")}
                      disabled={actionLoading["chrome-shutdown"]}
                      sx={actionBtnStyle}
                    >
                      Luk Chrome Browser
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
                      onClick={() => handleClientAction("restart")}
                      disabled={actionLoading["restart"]}
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
                      onClick={() => handleClientAction("shutdown")}
                      disabled={actionLoading["shutdown"]}
                      sx={actionBtnStyle}
                    >
                      Sluk klient
                    </Button>
                  </span>
                </Tooltip>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        {/* Felt 5: Livestream */}
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
