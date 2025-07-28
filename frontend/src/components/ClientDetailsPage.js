import React, { useState } from "react";
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
} from "@mui/material";
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import TerminalIcon from '@mui/icons-material/Terminal';
import VisibilityIcon from '@mui/icons-material/Visibility';
import BrowserUpdatedIcon from '@mui/icons-material/BrowserUpdated';

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
  },
];

export default function ClientDetailsPage({ clientId }) {
  const client = CLIENTS.find((c) => String(c.id) === String(clientId));
  const [kioskUrl, setKioskUrl] = useState(client?.kioskWebAddress ?? "");
  const [isPushing, setIsPushing] = useState(false);

  const handlePushKioskUrl = () => {
    setIsPushing(true);
    setTimeout(() => {
      setIsPushing(false);
      alert("Ny kiosk webadresse sendt til klienten!");
    }, 1000);
  };

  const handleChromeShutdown = () => alert("Chrome shutdown sendt til klienten.");
  const handleClientStart = () => alert("Start sendt til klienten.");
  const handleClientRestart = () => alert("Genstart sendt til klienten.");
  const handleClientShutdown = () => alert("Shutdown sendt til klienten.");
  const handleTerminalOpen = () => alert("Åbner terminal (WebSocket shell proxy).");
  const handleLiveStream = () => alert("Åbner live stream fra klienten.");

  if (!client) {
    return <Typography>Klient ikke fundet.</Typography>;
  }

  return (
    <Box sx={{ maxWidth: 650, mx: "auto", mt: 4 }}>
      <Paper sx={{ p: 3 }}>
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
            <Chip
              label={client.status === "online" ? "Online" : "Offline"}
              color={client.status === "online" ? "success" : "error"}
              sx={{ mr: 1 }}
            />
            <Chip
              label={client.chromeRunning ? "Chrome kører" : "Chrome lukket"}
              color={client.chromeRunning ? "primary" : "default"}
            />
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>Handlinger:</Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6} md={4}>
                <Tooltip title="Sluk Chrome-browseren">
                  <Button
                    fullWidth
                    variant="outlined"
                    color="error"
                    startIcon={<BrowserUpdatedIcon />}
                    onClick={handleChromeShutdown}
                  >
                    Chrome: Shutdown
                  </Button>
                </Tooltip>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Tooltip title="Start klienten">
                  <Button
                    fullWidth
                    variant="outlined"
                    color="success"
                    startIcon={<PlayArrowIcon />}
                    onClick={handleClientStart}
                  >
                    Start
                  </Button>
                </Tooltip>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Tooltip title="Genstart klienten">
                  <Button
                    fullWidth
                    variant="outlined"
                    color="warning"
                    startIcon={<RestartAltIcon />}
                    onClick={handleClientRestart}
                  >
                    Genstart
                  </Button>
                </Tooltip>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Tooltip title="Sluk klienten">
                  <Button
                    fullWidth
                    variant="outlined"
                    color="error"
                    startIcon={<PowerSettingsNewIcon />}
                    onClick={handleClientShutdown}
                  >
                    Shutdown
                  </Button>
                </Tooltip>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Tooltip title="Åbn terminal (WebSocket shell)">
                  <Button
                    fullWidth
                    variant="contained"
                    color="secondary"
                    startIcon={<TerminalIcon />}
                    onClick={handleTerminalOpen}
                  >
                    Terminal
                  </Button>
                </Tooltip>
              </Grid>
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
            </Grid>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
