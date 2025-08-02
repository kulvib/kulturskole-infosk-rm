import React, { useState } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  TextField,
  Chip,
  CircularProgress,
  Tooltip,
  IconButton,
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
import RefreshIcon from "@mui/icons-material/Refresh";

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
  const [locality, setLocality] = useState(client?.locality || "");
  const [savingLocality, setSavingLocality] = useState(false);

  const [kioskUrl, setKioskUrl] = useState(client?.kiosk_url || "");
  const [savingKioskUrl, setSavingKioskUrl] = useState(false);

  const [actionLoading, setActionLoading] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  if (!client) {
    return (
      <Box sx={{ maxWidth: 800, mx: "auto", mt: 4 }}>
        <Card sx={{ p: 3 }}>
          <Typography variant="h6">Klientdata indlæses...</Typography>
        </Card>
      </Box>
    );
  }

  // Save locality
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

  const handleOpenTerminal = () => openTerminal(client.id);
  const handleOpenRemoteDesktop = () => openRemoteDesktop(client.id);

  // Opdater klient
  const handleRefreshClient = async () => {
    setRefreshing(true);
    try {
      await fetchClient?.();
    } catch (err) {
      alert("Kunne ikke opdatere klienten: " + err.message);
    }
    setRefreshing(false);
  };

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", mt: 4 }}>
      {/* Refresh icon aligned to right */}
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
        <Tooltip title="Opdater klient">
          <span>
            <IconButton
              onClick={handleRefreshClient}
              disabled={refreshing}
              size="large"
              color="primary"
            >
              {refreshing ? <CircularProgress size={24} /> : <RefreshIcon />}
            </IconButton>
          </span>
        </Tooltip>
      </Box>
      <Grid container spacing={4}>
        {/* Samlet afsnit 1 & 2 */}
        <Grid item xs={12}>
          <Card elevation={3} sx={{ borderRadius: 3, mb: 3 }}>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {client.name}
                  </Typography>
                  <ClientStatusChip status={client.status} isOnline={client.isOnline} />
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <LocationOnIcon color="primary" />
                  <Typography variant="body1" sx={{ fontWeight: 600, minWidth: 90 }}>
                    Lokalitet:
                  </Typography>
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
                <Stack direction="row" spacing={1} alignItems="center">
                  <AccessTimeIcon color="primary" />
                  <Typography sx={{ fontWeight: 600, minWidth: 90 }}>Sidst set:</Typography>
                  <Typography>{client.last_seen || "ukendt"}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <AccessTimeIcon color="primary" />
                  <Typography sx={{ fontWeight: 600, minWidth: 90 }}>Oppetid:</Typography>
                  <Typography>{client.uptime || "ukendt"}</Typography>
                </Stack>
                {/* Klient ID placeres her, efter Oppetid */}
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography sx={{ fontWeight: 600, minWidth: 90 }}>Klient ID:</Typography>
                  <Typography sx={{ color: "#888" }}>{client.id}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <LanIcon color="primary" />
                  <Typography sx={{ fontWeight: 600, minWidth: 90 }}>IP-adresse:</Typography>
                  <Typography>{client.ip_address || "ukendt"}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <LanIcon color="primary" />
                  <Typography sx={{ fontWeight: 600, minWidth: 90 }}>MAC-adresse:</Typography>
                  <Typography>{client.mac_address || "ukendt"}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <MemoryIcon color="primary" />
                  <Typography sx={{ fontWeight: 600, minWidth: 90 }}>Ubuntu version:</Typography>
                  <Typography>{client.ubuntu_version || "ukendt"}</Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Afsnit 3: Kiosk webadresse + Luk Chrome Browser */}
        <Grid item xs={12}>
          <Card elevation={3} sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1 }}>
                <ChromeReaderModeIcon color="primary" />
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  Kiosk webadresse:
                </Typography>
                <TextField
                  size="small"
                  value={kioskUrl}
                  onChange={e => setKioskUrl(e.target.value)}
                  sx={{
                    width: 440, // Dobbelt så langt som før
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
                <Tooltip title="Luk Chrome Browser på klient">
                  <span>
                    <Button
                      variant="outlined"
                      color="secondary"
                      startIcon={<PowerSettingsNewIcon />}
                      onClick={() => handleClientAction("chrome-shutdown")}
                      disabled={actionLoading["chrome-shutdown"]}
                      sx={{ ml: 2 }}
                    >
                      Luk Chrome Browser
                    </Button>
                  </span>
                </Tooltip>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Afsnit 4: Fjernadgang */}
        <Grid item xs={12}>
          <Card elevation={3} sx={{ borderRadius: 3 }}>
            <CardContent>
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
            </CardContent>
          </Card>
        </Grid>

        {/* Afsnit 5: Handlinger */}
        <Grid item xs={12}>
          <Card elevation={3} sx={{ borderRadius: 3 }}>
            <CardContent>
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
            </CardContent>
          </Card>
        </Grid>

        {/* Afsnit 6: Livestream */}
        <Grid item xs={12}>
          <Card elevation={3} sx={{ borderRadius: 3 }}>
            <CardContent>
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
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
