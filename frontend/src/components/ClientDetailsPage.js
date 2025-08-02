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
        fontWeight: 600,
        minWidth: 90,
        fontSize: '1rem',
        letterSpacing: 0.5,
        boxShadow: color === "success" ? "0 1px 5px #43a04733" : color === "warning" ? "0 1px 5px #ff704333" : "0 1px 5px #e5737333"
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
    <Box sx={{ maxWidth: 1000, mx: "auto", mt: 4 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Paper
          elevation={3}
          sx={{
            p: 4,
            bgcolor: "linear-gradient(90deg,#e3f2fd 0%,#f8bbd0 100%)",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 2px 12px #e3f2fd55"
          }}
        >
          <Stack direction="row" alignItems="center" spacing={3}>
            <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: 1 }}>
              {client.name}
            </Typography>
            <ClientStatusChip status={client.status} isOnline={client.isOnline} />
          </Stack>
          <Typography sx={{ color: "#888", fontSize: 18 }}>
            ID: {client.id}
          </Typography>
        </Paper>

        <Grid container spacing={3}>
          {/* Informationskort */}
          <Grid item xs={12} md={5}>
            <Card elevation={2} sx={{ borderRadius: 3, bgcolor: "#fff" }}>
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <LocationOnIcon color="primary" />
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      Lokalitet:
                    </Typography>
                    <Typography variant="body1">
                      {client.locality || <span style={{ color: "#888" }}>Ingen lokalitet</span>}
                    </Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <LanIcon color="primary" />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>IP-adresse:</Typography>
                    <Typography variant="body2">{client.ip_address || "ukendt"}</Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <LanIcon color="primary" />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>MAC-adresse:</Typography>
                    <Typography variant="body2">{client.mac_address || "ukendt"}</Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <MemoryIcon color="primary" />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>Ubuntu version:</Typography>
                    <Typography variant="body2">{client.ubuntu_version || "ukendt"}</Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <AccessTimeIcon color="primary" />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>Sidst set:</Typography>
                    <Typography variant="body2">{client.last_seen || "ukendt"}</Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <AccessTimeIcon color="primary" />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>Oppetid:</Typography>
                    <Typography variant="body2">{client.uptime || "ukendt"}</Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Kiosk webadresse */}
          <Grid item xs={12} md={7}>
            <Card elevation={2} sx={{
              borderRadius: 3,
              bgcolor: "linear-gradient(90deg,#f8bbd033,#e3f2fd33)",
              boxShadow: "0 2px 12px #f8bbd055"
            }}>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                  <ChromeReaderModeIcon color="primary" fontSize="large" />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Kiosk webadresse
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={2} alignItems="center">
                  <TextField
                    size="small"
                    value={kioskUrl}
                    onChange={e => setKioskUrl(e.target.value)}
                    sx={{
                      width: 300,
                      '& .MuiInputBase-input': { fontSize: '1rem' },
                      '& .MuiInputBase-root': { height: 37 },
                    }}
                    disabled={savingKioskUrl}
                  />
                  <Button
                    size="medium"
                    variant="contained"
                    color="primary"
                    onClick={handleKioskUrlSave}
                    disabled={savingKioskUrl}
                    sx={{ minWidth: 68, px: 2, height: 37, fontWeight: 700 }}
                  >
                    {savingKioskUrl ? <CircularProgress size={20} /> : "Gem"}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          {/* Handlinger */}
          <Grid item xs={12} md={6}>
            <Card elevation={2} sx={{
              borderRadius: 3,
              bgcolor: "linear-gradient(90deg,#fffde7,#ffe0b2)",
              boxShadow: "0 2px 8px #ffe0b255"
            }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
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
                        sx={{ fontWeight: 600 }}
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
                        sx={{ fontWeight: 600 }}
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
                        sx={{ fontWeight: 600 }}
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
                        sx={{ fontWeight: 600 }}
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
            <Card elevation={2} sx={{
              borderRadius: 3,
              bgcolor: "linear-gradient(90deg,#e3f2fd,#f8bbd0)",
              boxShadow: "0 2px 8px #e3f2fd55"
            }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
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
                        sx={{ fontWeight: 600 }}
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
                        sx={{ fontWeight: 600 }}
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
        <Card elevation={2} sx={{
          borderRadius: 3,
          bgcolor: "linear-gradient(90deg,#e1bee7,#bbdefb)",
          boxShadow: "0 2px 8px #bbdefb55"
        }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
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
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
