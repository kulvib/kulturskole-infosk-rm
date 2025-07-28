import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Chip,
  Divider,
  Paper,
  Grid,
  Tooltip,
  IconButton,
  CircularProgress,
} from "@mui/material";
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import TerminalIcon from '@mui/icons-material/Terminal';
import VisibilityIcon from '@mui/icons-material/Visibility';
import BrowserUpdatedIcon from '@mui/icons-material/BrowserUpdated';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useNavigate, useParams } from "react-router-dom";

// Udvidet dummydata med flere klienter
const CLIENTS = [
  {
    id: 1,
    name: "Klient A",
    locality: "Lokale 1",
    ip: "192.168.1.101",
    softwareVersion: "1.4.2",
    macAddress: "00:1A:2B:3C:4D:5E",
    lastSeen: "2025-07-28 13:35:00",
    uptime: "4 dage, 2 timer",
    kioskWebAddress: "https://kulturskolen-viborg.dk/info",
    status: "online",
    chromeRunning: true,
    chromeUrl: "https://kulturskolen-viborg.dk/info"
  },
  {
    id: 2,
    name: "Klient B",
    locality: "Lokale 2",
    ip: "192.168.1.102",
    softwareVersion: "1.4.2",
    macAddress: "00:1A:2B:3C:4D:5F",
    lastSeen: "2025-07-28 13:39:10",
    uptime: "2 dage, 7 timer",
    kioskWebAddress: "https://kulturskolen-viborg.dk/plan",
    status: "offline",
    chromeRunning: false,
    chromeUrl: ""
  },
  {
    id: 3,
    name: "Klient C",
    locality: "Lokale 3",
    ip: "192.168.1.103",
    softwareVersion: "1.4.2",
    macAddress: "00:1A:2B:3C:4D:60",
    lastSeen: "2025-07-28 12:15:00",
    uptime: "1 dag, 9 timer",
    kioskWebAddress: "https://kulturskolen-viborg.dk/sal",
    status: "online",
    chromeRunning: true,
    chromeUrl: "https://kulturskolen-viborg.dk/sal"
  },
  {
    id: 4,
    name: "Klient D",
    locality: "Lokale 4",
    ip: "192.168.1.104",
    softwareVersion: "1.4.2",
    macAddress: "00:1A:2B:3C:4D:61",
    lastSeen: "2025-07-28 11:48:10",
    uptime: "3 timer",
    kioskWebAddress: "https://kulturskolen-viborg.dk/undervisning",
    status: "offline",
    chromeRunning: false,
    chromeUrl: ""
  },
  {
    id: 5,
    name: "Klient E",
    locality: "Lokale 5",
    ip: "192.168.1.105",
    softwareVersion: "1.4.2",
    macAddress: "00:1A:2B:3C:4D:62",
    lastSeen: "2025-07-28 13:25:00",
    uptime: "3 dage, 4 timer",
    kioskWebAddress: "https://kulturskolen-viborg.dk/elev",
    status: "online",
    chromeRunning: true,
    chromeUrl: "https://kulturskolen-viborg.dk/elev"
  },
  {
    id: 6,
    name: "Klient F",
    locality: "Lokale 6",
    ip: "192.168.1.106",
    softwareVersion: "1.4.2",
    macAddress: "00:1A:2B:3C:4D:63",
    lastSeen: "2025-07-28 09:41:00",
    uptime: "6 timer",
    kioskWebAddress: "https://kulturskolen-viborg.dk/kalender",
    status: "offline",
    chromeRunning: false,
    chromeUrl: ""
  },
  {
    id: 7,
    name: "Klient G",
    locality: "Lokale 7",
    ip: "192.168.1.107",
    softwareVersion: "1.4.2",
    macAddress: "00:1A:2B:3C:4D:64",
    lastSeen: "2025-07-28 08:55:00",
    uptime: "2 dage, 12 timer",
    kioskWebAddress: "https://kulturskolen-viborg.dk/info2",
    status: "online",
    chromeRunning: true,
    chromeUrl: "https://kulturskolen-viborg.dk/info2"
  },
  {
    id: 8,
    name: "Klient H",
    locality: "Lokale 8",
    ip: "192.168.1.108",
    softwareVersion: "1.4.2",
    macAddress: "00:1A:2B:3C:4D:65",
    lastSeen: "2025-07-28 07:32:00",
    uptime: "8 timer",
    kioskWebAddress: "https://kulturskolen-viborg.dk/oversigt",
    status: "offline",
    chromeRunning: false,
    chromeUrl: ""
  },
];

function getRefreshedClientData(client) {
  // Simulerer API kald og returnerer opdaterede data
  const now = new Date();
  if (!client) return null;
  return {
    ...client,
    lastSeen: now.toISOString().replace("T", " ").slice(0, 16),
    uptime: client.uptime.endsWith("timer")
      ? client.uptime
      : "5 dage, 3 timer",
    chromeRunning: client.chromeRunning,
    chromeUrl: client.chromeRunning ? client.chromeUrl : "",
  };
}

export default function ClientDetailsPage({ clients }) {
  const { clientId } = useParams();
  const navigate = useNavigate();

  // Brug dummydata som fallback hvis clients mangler eller er tom
  const clientList = clients && clients.length > 0 ? clients : CLIENTS;
  const clientObj = clientList.find((c) => String(c.id) === String(clientId));

  const [client, setClient] = useState(clientObj);
  const [kioskUrl, setKioskUrl] = useState(clientObj?.kioskWebAddress ?? "");
  const [isPushing, setIsPushing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Opdater client, hvis clients-listen eller clientId ændrer sig
    const updatedClients = clients && clients.length > 0 ? clients : CLIENTS;
    const updatedClient = updatedClients.find((c) => String(c.id) === String(clientId));
    setClient(updatedClient);
    setKioskUrl(updatedClient?.kioskWebAddress ?? "");
  }, [clients, clientId]);

  const handlePushKioskUrl = () => {
    setIsPushing(true);
    setTimeout(() => {
      setIsPushing(false);
      alert("Ny kiosk webadresse sendt til klienten!");
    }, 1000);
  };

  const handleChromeStart = () => alert("Chrome start sendt til klienten.");
  const handleChromeShutdown = () => alert("Chrome luk sendt til klienten.");
  const handleClientStart = () => alert("Start sendt til klienten.");
  const handleClientRestart = () => alert("Genstart sendt til klienten.");
  const handleClientShutdown = () => alert("Shutdown sendt til klienten.");
  const handleTerminalOpen = () => alert("Åbner terminal (WebSocket shell proxy).");
  const handleLiveStream = () => alert("Åbner live stream fra klienten.");

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      const updatedClient = getRefreshedClientData(client);
      setClient(updatedClient);
      setIsRefreshing(false);
    }, 1200);
  };

  if (!client) {
    return <Typography color="error" variant="h6">Klient ikke fundet.</Typography>;
  }

  return (
    <Box sx={{ maxWidth: 650, mx: "auto", mt: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/clients")}
            variant="text"
          >
            Tilbage til klientoversigt
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          <Tooltip title="Opdater data fra klienten">
            <span>
              <IconButton color="primary" onClick={handleRefresh} disabled={isRefreshing}>
                {isRefreshing ? <CircularProgress size={24} /> : <RefreshIcon />}
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
        <Typography variant="h5" gutterBottom>
          {client.name}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>Lokalitet:</Typography>
            <Typography>{client.locality}</Typography>
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>Klientdata:</Typography>
            <Stack spacing={0.5}>
              <Typography>IP: {client.ip}</Typography>
              <Typography>Software version: {client.softwareVersion}</Typography>
              <Typography>MAC adresse: {client.macAddress}</Typography>
              <Typography>Sidst set: {client.lastSeen}</Typography>
              <Typography>Oppetid: {client.uptime}</Typography>
            </Stack>
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>Kiosk webadresse:</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                value={kioskUrl}
                onChange={(e) => setKioskUrl(e.target.value)}
                size="small"
                fullWidth
              />
              <Button
                variant="contained"
                color="primary"
                onClick={handlePushKioskUrl}
                disabled={isPushing}
              >
                {isPushing ? "Sender..." : "Push"}
              </Button>
            </Stack>
            <Typography variant="caption">
              Chrome starter automatisk på denne adresse ved opstart.
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>Status:</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                label={client.status === "online" ? "Online" : "Offline"}
                color={client.status === "online" ? "success" : "error"}
              />
              {client.chromeRunning ? (
                <Chip
                  label={
                    <>
                      Chrome kører
                      <span style={{ marginLeft: 6, fontWeight: 400, fontSize: "0.9em" }}>
                        {client.chromeUrl}
                      </span>
                    </>
                  }
                  color="primary"
                  sx={{ ml: 1, maxWidth: 320 }}
                />
              ) : (
                <Chip
                  label="Chrome lukket"
                  color="default"
                  sx={{ ml: 1 }}
                />
              )}
            </Stack>
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>Handlinger:</Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              {/* Chrome start */}
              <Grid item xs={12} sm={6} md={4}>
                <Tooltip title="Start Chrome-browseren">
                  <Button
                    fullWidth
                    variant="outlined"
                    color="success"
                    startIcon={<PlayArrowIcon />}
                    onClick={handleChromeStart}
                  >
                    Chrome: Start
                  </Button>
                </Tooltip>
              </Grid>
              {/* Chrome luk */}
              <Grid item xs={12} sm={6} md={4}>
                <Tooltip title="Luk Chrome-browseren">
                  <Button
                    fullWidth
                    variant="outlined"
                    color="error"
                    startIcon={<BrowserUpdatedIcon />}
                    onClick={handleChromeShutdown}
                  >
                    Chrome: Luk
                  </Button>
                </Tooltip>
              </Grid>
              {/* Divider */}
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
              </Grid>
              {/* Live Stream */}
              <Grid item xs={12} sm={6} md={4}>
                <Tooltip title="Live stream fra klienten">
                  <Button
                    fullWidth
                    variant="contained"
                    color="primary"
                    startIcon={<VisibilityIcon />}
                    onClick={handleLiveStream}
                  >
                    Live stream
                  </Button>
                </Tooltip>
              </Grid>
              {/* Start klient terminal */}
              <Grid item xs={12} sm={6} md={4}>
                <Tooltip title="Start klient terminal">
                  <Button
                    fullWidth
                    variant="contained"
                    color="secondary"
                    startIcon={<TerminalIcon />}
                    onClick={handleTerminalOpen}
                  >
                    Start Klient Terminal
                  </Button>
                </Tooltip>
              </Grid>
              {/* Divider */}
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
              </Grid>
              {/* Start klient */}
              <Grid item xs={12} sm={4} md={4}>
                <Tooltip title="Start klienten">
                  <Button
                    fullWidth
                    variant="outlined"
                    color="success"
                    startIcon={<PlayArrowIcon />}
                    onClick={handleClientStart}
                  >
                    Start klient
                  </Button>
                </Tooltip>
              </Grid>
              {/* Luk klient */}
              <Grid item xs={12} sm={4} md={4}>
                <Tooltip title="Luk klienten">
                  <Button
                    fullWidth
                    variant="outlined"
                    color="error"
                    startIcon={<PowerSettingsNewIcon />}
                    onClick={handleClientShutdown}
                  >
                    Luk klient
                  </Button>
                </Tooltip>
              </Grid>
              {/* Genstart klient */}
              <Grid item xs={12} sm={4} md={4}>
                <Tooltip title="Genstart klienten">
                  <Button
                    fullWidth
                    variant="outlined"
                    color="warning"
                    startIcon={<RestartAltIcon />}
                    onClick={handleClientRestart}
                  >
                    Genstart klient
                  </Button>
                </Tooltip>
              </Grid>
            </Grid>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
