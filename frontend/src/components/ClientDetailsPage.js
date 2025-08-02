import React, { useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Divider,
  CircularProgress,
  Tooltip,
  Chip,
  TextField,
  Card,
  CardContent,
  Grid,
} from "@mui/material";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import TerminalIcon from "@mui/icons-material/Terminal";
import DesktopWindowsIcon from "@mui/icons-material/DesktopWindows";
import VideocamIcon from "@mui/icons-material/Videocam";
import ChromeReaderModeIcon from "@mui/icons-material/ChromeReaderMode";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import LanIcon from "@mui/icons-material/Lan";
import MemoryIcon from "@mui/icons-material/Memory";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PublicIcon from "@mui/icons-material/Public";

import {
  updateClient,
  pushKioskUrl,
  clientAction,
  openTerminal,
  openRemoteDesktop,
  getClientStream,
} from "../api";

// Status-chip helper
function ClientStatusChip({ status, isOnline }) {
  let color = "default";
  let label = status;
  if (status === "approved") {
    color = isOnline ? "success" : "warning";
    label = isOnline ? "Online" : "Offline";
  } else if (status === "pending") {
    color = "default";
    label = "Afventer godkendelse";
  } else if (status === "removed") {
    color = "error";
    label = "Fjernet";
  }
  return (
    <Chip
      label={label}
      color={color}
      variant={color === "default" ? "outlined" : "filled"}
      sx={{
        fontWeight: 600,
        minWidth: 90,
        fontSize: "1rem",
        letterSpacing: 0.5,
      }}
    />
  );
}

export default function ClientDetailsPage({ client, fetchClient }) {
  // Redigerbar locality
  const [locality, setLocality] = useState(client?.locality || "");
  const [savingLocality, setSavingLocality] = useState(false);

  // Kiosk webadresse
  const [kioskUrl, setKioskUrl] = useState(client?.kiosk_url || "");
  const [savingKioskUrl, setSavingKioskUrl] = useState(false);

  // Action feedback
  const [actionLoading, setActionLoading] = useState({});

  if (!client) {
    return (
      <Box sx={{ maxWidth: 800, mx: "auto", mt: 4 }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6">Klientdata indlæses...</Typography>
        </Paper>
      </Box>
    );
  }

  // Gem lokalitet
  const handleLocalitySave = async () => {
    setSavingLocality(true);
    try {
      await updateClient(client.id, { locality });
      fetchClient?.();
    } catch (err) {
      alert("Kunne ikke gemme lokalitet: " + err.message);
    }
    setSavingLocality(false);
  };

  // Gem Kiosk URL
  const handleKioskUrlSave = async () => {
    setSavingKioskUrl(true);
    try {
      await pushKioskUrl(client.id, kioskUrl);
      fetchClient?.();
    } catch (err) {
      alert("Kunne ikke opdatere kiosk webadresse: " + err.message);
    }
    setSavingKioskUrl(false);
  };

  // Generic client action
  const handleClientAction = async (action) => {
    setActionLoading((prev) => ({ ...prev, [action]: true }));
    try {
      await clientAction(client.id, action);
      fetchClient?.();
    } catch (err) {
      alert("Handlingen mislykkedes: " + err.message);
    }
    setActionLoading((prev) => ({ ...prev, [action]: false }));
  };

  // Terminal & Remote Desktop
  const handleOpenTerminal = () => openTerminal(client.id);
  const handleOpenRemoteDesktop = () => openRemoteDesktop(client.id);

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", mt: 4 }}>
      <Stack spacing={4}>
        {/* Afsnit 1: ID, Navn, Status */}
        <Card elevation={2} sx={{ p: 3, borderRadius: 3 }}>
          <Stack direction="row" alignItems="center" spacing={4} justifyContent="space-between">
            <Stack direction="row" spacing={4} alignItems="center">
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {client.name}
              </Typography>
              <Typography sx={{ color: "#888", fontSize: 18 }}>
                ID: {client.id}
              </Typography>
            </Stack>
            <ClientStatusChip status={client.status} isOnline={client.isOnline} />
          </Stack>
        </Card>

        {/* Afsnit 2: Klientdata */}
        <Card elevation={2} sx={{ p: 3, borderRadius: 3 }}>
          <Grid container spacing={2} alignItems="center">
            {/* Lokalitet - redigerbar */}
            <Grid item xs={12} sm={6} md={4}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <LocationOnIcon color="primary" />
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  Lokalitet:
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                <TextField
                  size="small"
                  value={locality}
                  onChange={e => setLocality(e.target.value)}
                  sx={{
                    width: 140,
                    "& .MuiInputBase-input": { fontSize: "1rem" },
                    "& .MuiInputBase-root": { height: 30 },
                  }}
                  disabled={savingLocality}
                />
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleLocalitySave}
                  disabled={savingLocality}
                  sx={{ minWidth: 44, px: 1, height: 30 }}
                >
                  {savingLocality ? <CircularProgress size={18} /> : "Gem"}
                </Button>
              </Stack>
            </Grid>
            {/* Sidst set */}
            <Grid item xs={12} sm={6} md={4}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <AccessTimeIcon color="primary" />
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  Sidst set:
                </Typography>
                <Typography variant="body1" sx={{ ml: 1 }}>
                  {client.last_seen || "ukendt"}
                </Typography>
              </Stack>
            </Grid>
            {/* Oppetid */}
            <Grid item xs={12} sm={6} md={4}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <AccessTimeIcon color="primary" />
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  Oppetid:
                </Typography>
                <Typography variant="body1" sx={{ ml: 1 }}>
                  {client.uptime || "ukendt"}
                </Typography>
              </Stack>
            </Grid>
            {/* IP-adresse */}
            <Grid item xs={12} sm={6} md={4}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <LanIcon color="primary" />
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  IP-adresse:
                </Typography>
                <Typography variant="body1" sx={{ ml: 1 }}>
                  {client.ip_address || "ukendt"}
                </Typography>
              </Stack>
            </Grid>
            {/* MAC-adresse */}
            <Grid item xs={12} sm={6} md={4}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <LanIcon color="primary" />
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  MAC-adresse:
                </Typography>
                <Typography variant="body1" sx={{ ml: 1 }}>
                  {client.mac_address || "ukendt"}
                </Typography>
              </Stack>
            </Grid>
            {/* Ubuntu version */}
            <Grid item xs={12} sm={6} md={4}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <MemoryIcon color="primary" />
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  Ubuntu version:
                </Typography>
                <Typography variant="body1" sx={{ ml: 1 }}>
                  {client.ubuntu_version || "ukendt"}
                </Typography>
              </Stack>
            </Grid>
          </Grid>
        </Card>

        {/* Afsnit 3: Kiosk webadresse + Chrome Shutdown */}
        <Card elevation={2} sx={{ p: 3, borderRadius: 3 }}>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <ChromeReaderModeIcon color="primary" />
              <Typography variant="body1" sx={{ fontWeight: 700 }}>
                Kiosk webadresse:
              </Typography>
              <TextField
                size="small"
                value={kioskUrl}
                onChange={e => setKioskUrl(e.target.value)}
                sx={{
                  width: 220,
                  "& .MuiInputBase-input": { fontSize: "1rem" },
                  "& .MuiInputBase-root": { height: 30 },
                }}
                disabled={savingKioskUrl}
              />
              <Button
                size="small"
                variant="outlined"
                color="primary"
                onClick={handleKioskUrlSave}
                disabled={savingKioskUrl}
                sx={{ minWidth: 44, px: 1, height: 30 }}
              >
                {savingKioskUrl ? <CircularProgress size={18} /> : "Gem"}
              </Button>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Tooltip title="Luk Chrome Browser på klient">
                <span>
                  <Button
                    variant="outlined"
                    color="secondary"
                    startIcon={<PowerSettingsNewIcon />}
                    onClick={() => handleClientAction("chrome-shutdown")}
                    disabled={actionLoading["chrome-shutdown"]}
                  >
                    Luk Chrome Browser
                  </Button>
                </span>
              </Tooltip>
            </Stack>
          </Stack>
        </Card>

        {/* Afsnit 4: Fjernadgang */}
        <Card elevation={2} sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            Fjernadgang
          </Typography>
          <Stack direction="row" spacing={2}>
            <Tooltip title="Åbn fjernskrivebord på klient">
              <span>
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<DesktopWindowsIcon />}
                  onClick={handleOpenRemoteDesktop}
                >
                  Fjernskrivebord
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Åbn terminal på klient">
              <span>
                <Button
                  variant="outlined"
                  color="inherit"
                  startIcon={<TerminalIcon />}
                  onClick={handleOpenTerminal}
                >
                  Terminal på klient
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </Card>

        {/* Afsnit 5: Handlinger */}
        <Card elevation={2} sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            Handlinger
          </Typography>
          <Stack direction="row" spacing={2}>
            <Tooltip title="Genstart klient">
              <span>
                <Button
                  variant="contained"
                  color="warning"
                  startIcon={<RestartAltIcon />}
                  onClick={() => handleClientAction("restart")}
                  disabled={actionLoading["restart"]}
                >
                  Genstart klient
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Start klient">
              <span>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<PlayArrowIcon />}
                  onClick={() => handleClientAction("start")}
                  disabled={actionLoading["start"]}
                >
                  Start klient
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
                >
                  Sluk klient
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </Card>

        {/* Afsnit 6: Livestream */}
        <Card elevation={2} sx={{ p: 3, borderRadius: 3 }}>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
            <VideocamIcon color="action" fontSize="large" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Livestream fra klient
            </Typography>
          </Stack>
          {/* Til MJPEG: */}
          {/* <img src={getClientStream(client.id)} alt="Livestream" style={{ maxWidth: 500 }} /> */}
          {/* Til WebRTC: */}
          {/* <video src={getClientStream(client.id)} controls autoPlay style={{ maxWidth: 500 }} /> */}
          <Box sx={{
            p: 3,
            border: "1px solid #eee",
            borderRadius: 2,
            background: "#fafafa",
            textAlign: "center",
            color: "#888",
            fontStyle: "italic"
          }}>
            Livestream placeholder (MJPEG/WebRTC)
          </Box>
        </Card>
      </Stack>
    </Box>
  );
}
