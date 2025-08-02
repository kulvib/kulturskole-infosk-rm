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
  getClient,
} from "../api";
import { useParams } from "react-router-dom";
import { useClientWebSocket } from "../hooks/useClientWebSocket";

// Offline/Online status: meget lille, kun grøn/rød cirkel + tekst med Roboto font
function ClientStatusIcon({ isOnline }) {
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
          bgcolor: isOnline ? "#66FF33" : "#CC3300",
          boxShadow: "0 0 2px rgba(0,0,0,0.12)",
          border: "1px solid #ddd",
        }}
      />
      <span style={{ marginLeft: 6 }}>{isOnline ? "online" : "offline"}</span>
    </Box>
  );
}

export default function ClientDetailsPage() {
  const { clientId } = useParams();
  const [client, setClient] = useState(null);
  const [locality, setLocality] = useState("");
  const [savingLocality, setSavingLocality] = useState(false);

  const [kioskUrl, setKioskUrl] = useState("");
  const [savingKioskUrl, setSavingKioskUrl] = useState(false);

  const [actionLoading, setActionLoading] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  // Fetch client by id
  const fetchClient = async () => {
    try {
      const data = await getClient(clientId);
      setClient(data);
      setLocality(data.locality || "");
      setKioskUrl(data.kiosk_url || "");
    } catch (err) {
      setClient(null);
    }
  };

  useEffect(() => {
    if (clientId) fetchClient();
    // eslint-disable-next-line
  }, [clientId]);

  useClientWebSocket(fetchClient);

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
      fetchClient();
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
      fetchClient();
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
      fetchClient();
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
      await fetchClient();
    } catch (err) {
      alert("Kunne ikke opdatere klienten: " + err.message);
    }
    setRefreshing(false);
  };

  // Mindre afstand og ens afstand mellem afsnit
  const sectionSpacing = 2;

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", mt: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", mb: 1 }}>
        <Tooltip title="Opdater klient">
          <span>
            <Button
              startIcon={
                refreshing ? (
                  <CircularProgress size={22} />
                ) : (
                  <RefreshIcon fontSize="medium" />
                )
              }
              onClick={handleRefreshClient}
              disabled={refreshing}
              color="primary"
              sx={{
                fontWeight: 500,
                textTransform: "none",
                minWidth: 0,
                mr: 1,
                px: 2,
              }}
            >
              Opdater
            </Button>
          </span>
        </Tooltip>
      </Box>
      <Grid container spacing={sectionSpacing}>
        {/* Afsnit 1: Klient-info */}
        <Grid item xs={12}>
          <Card elevation={2} sx={{ borderRadius: 2 }}>
            <CardContent>
              <Stack spacing={1.2}>
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
                <Stack direction="row" spacing={1} alignItems="center">
                  <LocationOnIcon color="primary" />
                  <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 90 }}>
                    Lokalitet:
                  </Typography>
                  <TextField
                    size="small"
                    value={locality}
                    onChange={e => setLocality(e.target.value)}
                    sx={{
                      width: 140,
                      "& .MuiInputBase-input": { fontSize: "0.95rem" },
                      "& .MuiInputBase-root": { height: 28 },
                    }}
                    disabled={savingLocality}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleLocalitySave}
                    disabled={savingLocality}
                    sx={{ minWidth: 44, px: 1, height: 28 }}
                  >
                    {savingLocality ? <CircularProgress size={16} /> : "Gem"}
                  </Button>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <AccessTimeIcon color="primary" />
                  <Typography sx={{ fontWeight: 600, minWidth: 90 }} variant="body2">Sidst set:</Typography>
                  <Typography variant="body2">{client.last_seen || "ukendt"}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <AccessTimeIcon color="primary" />
                  <Typography sx={{ fontWeight: 600, minWidth: 90 }} variant="body2">Oppetid:</Typography>
                  <Typography variant="body2">{client.uptime || "ukendt"}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <LanIcon color="primary" />
                  <Typography sx={{ fontWeight: 600, minWidth: 90 }} variant="body2">Klient ID:</Typography>
                  <Typography variant="body2" sx={{ color: "#888" }}>{client.id}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <LanIcon color="primary" />
                  <Typography sx={{ fontWeight: 600, minWidth: 90 }} variant="body2">IP-adresse:</Typography>
                  <Typography variant="body2">{client.ip_address || "ukendt"}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <LanIcon color="primary" />
                  <Typography sx={{ fontWeight: 600, minWidth: 90 }} variant="body2">MAC-adresse:</Typography>
                  <Typography variant="body2">{client.mac_address || "ukendt"}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <MemoryIcon color="primary" />
                  <Typography sx={{ fontWeight: 600, minWidth: 90 }} variant="body2">Ubuntu version:</Typography>
                  <Typography variant="body2">{client.ubuntu_version || "ukendt"}</Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Afsnit 2: Kiosk webadresse + Luk Chrome Browser */}
        <Grid item xs={12}>
          <Card elevation={2} sx={{ borderRadius: 2 }}>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1 }}>
                <ChromeReaderModeIcon color="primary" />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Kiosk webadresse:
                </Typography>
                <TextField
                  size="small"
                  value={kioskUrl}
                  onChange={e => setKioskUrl(e.target.value)}
                  sx={{
                    width: 440,
                    "& .MuiInputBase-input": { fontSize: "0.95rem" },
                    "& .MuiInputBase-root": { height: 28 },
                  }}
                  disabled={savingKioskUrl}
                />
                <Button
                  size="small"
                  variant="outlined"
                  color="primary"
                  onClick={handleKioskUrlSave}
                  disabled={savingKioskUrl}
                  sx={{ minWidth: 44, px: 1, height: 28 }}
                >
                  {savingKioskUrl ? <CircularProgress size={16} /> : "Gem"}
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

        {/* Afsnit 3: Fjernadgang */}
        <Grid item xs={12}>
          <Card elevation={2} sx={{ borderRadius: 2 }}>
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

        {/* Afsnit 4: Handlinger */}
        <Grid item xs={12}>
          <Card elevation={2} sx={{ borderRadius: 2 }}>
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

        {/* Afsnit 5: Livestream */}
        <Grid item xs={12}>
          <Card elevation={2} sx={{ borderRadius: 2 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                <VideocamIcon color="action" fontSize="large" />
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  Livestream fra klient
                </Typography>
              </Stack>
              {/* Til MJPEG: */}
              {/* <img src={getClientStream(client.id)} alt="Livestream" style={{ maxWidth: 500 }} /> */}
              {/* Til WebRTC: */}
              {/* <video src={getClientStream(client.id)} controls autoPlay style={{ maxWidth: 500 }} /> */}
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
