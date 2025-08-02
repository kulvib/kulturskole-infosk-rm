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
  Card,
  CardContent,
  CardActions,
  Grid,
  TextField,
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

import {
  pushKioskUrl,
  clientAction,
  openTerminal,
  openRemoteDesktop,
  getClientStream,
} from "../api";

// Hjælper til status-chip
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
        fontWeight: 500,
        minWidth: 80,
        fontSize: '1rem'
      }}
    />
  );
}

export default function ClientDetailsPage({ client, fetchClient }) {
  const [kioskUrl, setKioskUrl] = useState(client?.kiosk_url || "");
  const [savingKioskUrl, setSavingKioskUrl] = useState(false);
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

  // Save Kiosk URL
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
      <Stack spacing={3}>
        {/* Header */}
        <Paper
          elevation={2}
          sx={{
            p: 3,
            bgcolor: "#f5f8ff",
            borderRadius: 3,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Stack direction="row" alignItems="center" spacing={2}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {client.name}
            </Typography>
            <ClientStatusChip status={client.status} isOnline={client.isOnline} />
          </Stack>
          <Typography sx={{ color: "#888" }}>
            ID: {client.id}
          </Typography>
        </Paper>

        {/* Informationskort */}
        <Grid container spacing={2}>
          <Grid item xs={12} md={7}>
            <Card elevation={0} sx={{ bgcolor: "#fff", borderRadius: 3 }}>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <LocationOnIcon color="primary" />
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      Lokalitet:
                    </Typography>
                    <Typography variant="body1">
                      {client.locality || <span style={{ color: "#888" }}>Ingen lokalitet</span>}
                    </Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <LanIcon color="primary" />
                    <Typography variant="body2">IP-adresse:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{client.ip_address || "ukendt"}</Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <LanIcon color="primary" />
                    <Typography variant="body2">MAC-adresse:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{client.mac_address || "ukendt"}</Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <MemoryIcon color="primary" />
                    <Typography variant="body2">Ubuntu version:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{client.ubuntu_version || "ukendt"}</Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <AccessTimeIcon color="primary" />
                    <Typography variant="body2">Sidst set:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{client.last_seen || "ukendt"}</Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <AccessTimeIcon color="primary" />
                    <Typography variant="body2">Oppetid:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{client.uptime || "ukendt"}</Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          {/* Kiosk webadresse */}
          <Grid item xs={12} md={5}>
            <Card elevation={0} sx={{ bgcolor: "#fff", borderRadius: 3 }}>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                  <ChromeReaderModeIcon color="primary" />
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    Kiosk webadresse:
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={2} alignItems="center">
                  <TextField
                    size="small"
                    value={kioskUrl}
                    onChange={e => setKioskUrl(e.target.value)}
                    sx={{
                      width: 200,
                      '& .MuiInputBase-input': { fontSize: '1rem' },
                      '& .MuiInputBase-root': { height: 30 },
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
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Action cards */}
        <Grid container spacing={2}>
          {/* Handlinger */}
          <Grid item xs={12} md={6}>
            <Card elevation={0} sx={{ bgcolor: "#f8fafc", borderRadius: 3 }}>
              <CardContent>
                <Typography variant="body1" sx={{ fontWeight: 600, mb: 2 }}>
                  Handlinger
                </Typography>
                <Stack direction="row" spacing={2}>
                  <Tooltip title="Sluk Chrome browser på klient">
                    <span>
                      <Button
                        variant="outlined"
                        color="secondary"
                        startIcon={<PowerSettingsNewIcon />}
                        onClick={() => handleClientAction("chrome-shutdown")}
                        disabled={actionLoading["chrome-shutdown"]}
                      >
                        Chrome shutdown
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
                        Start
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
                      >
                        Genstart
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
                        Sluk
                      </Button>
                    </span>
                  </Tooltip>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          {/* Fjernadgang */}
          <Grid item xs={12} md={6}>
            <Card elevation={0} sx={{ bgcolor: "#f8fafc", borderRadius: 3 }}>
              <CardContent>
                <Typography variant="body1" sx={{ fontWeight: 600, mb: 2 }}>
                  Fjernadgang
                </Typography>
                <Stack direction="row" spacing={2}>
                  <Tooltip title="Åbn terminal på klient">
                    <span>
                      <Button
                        variant="outlined"
                        color="inherit"
                        startIcon={<TerminalIcon />}
                        onClick={handleOpenTerminal}
                      >
                        Terminal
                      </Button>
                    </span>
                  </Tooltip>
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
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Livestream */}
        <Card elevation={0} sx={{ bgcolor: "#fff", borderRadius: 3 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <VideocamIcon color="action" />
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                Livestream fra klient
              </Typography>
            </Stack>
            {/* Til MJPEG: */}
            {/* <img src={getClientStream(client.id)} alt="Livestream" style={{ maxWidth: 500 }} /> */}
            {/* Til WebRTC: */}
            {/* <video src={getClientStream(client.id)} controls autoPlay style={{ maxWidth: 500 }} /> */}
            <Box sx={{ p: 2, border: "1px solid #eee", borderRadius: 2, background: "#fafafa" }}>
              Livestream placeholder (MJPEG/WebRTC)
            </Box>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
