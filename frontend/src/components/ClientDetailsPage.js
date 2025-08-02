import React, { useState } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  Divider,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import TerminalIcon from "@mui/icons-material/Terminal";
import DesktopWindowsIcon from "@mui/icons-material/DesktopWindows";
import VideocamIcon from "@mui/icons-material/Videocam";
import ChromeReaderModeIcon from "@mui/icons-material/ChromeReaderMode";

import {
  updateClient,
  pushKioskUrl,
  clientAction,
  openTerminal,
  openRemoteDesktop,
  getClientStream,
} from "../api";

export default function ClientDetailsPage({ client, fetchClient }) {
  // Loader hvis client mangler
  if (!client) {
    return (
      <Box sx={{ maxWidth: 800, mx: "auto", mt: 4 }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6">Klientdata indlæses...</Typography>
        </Paper>
      </Box>
    );
  }

  // Local state for editable fields
  const [locality, setLocality] = useState(client.locality || "");
  const [savingLocality, setSavingLocality] = useState(false);

  const [kioskUrl, setKioskUrl] = useState(client.kiosk_url || "");
  const [savingKioskUrl, setSavingKioskUrl] = useState(false);

  // Action feedback
  const [actionLoading, setActionLoading] = useState({});

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

  // Terminal
  const handleOpenTerminal = () => {
    openTerminal(client.id);
  };

  // Remote Desktop
  const handleOpenRemoteDesktop = () => {
    openRemoteDesktop(client.id);
  };

  // Stream (MJPEG/WebRTC)
  // <img src={getClientStream(client.id)} alt="Livestream" style={{ maxWidth: 500 }} />
  // <video src={getClientStream(client.id)} controls autoPlay style={{ maxWidth: 500 }} />

  return (
    <Box sx={{ maxWidth: 800, mx: "auto", mt: 4 }}>
      <Paper sx={{ p: 3 }}>
        {/* Klientnavn */}
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
          {client.name}
        </Typography>

        {/* Lokalitet */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="body1" sx={{ minWidth: 110 }}>
            Lokalitet:
          </Typography>
          <TextField
            size="small"
            value={locality}
            onChange={e => setLocality(e.target.value)}
            sx={{
              width: 140,
              '& .MuiInputBase-input': { fontSize: '1rem' },
              '& .MuiInputBase-root': { height: 30 },
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

        <Divider sx={{ mb: 2 }} />

        {/* Klientdata */}
        <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
          Klientdata
        </Typography>
        <Stack spacing={0.5} sx={{ mb: 2 }}>
          <Typography variant="body2">IP-adresse: <b>{client.ip_address || "ukendt"}</b></Typography>
          <Typography variant="body2">MAC-adresse: <b>{client.mac_address || "ukendt"}</b></Typography>
          <Typography variant="body2">Ubuntu version: <b>{client.ubuntu_version || "ukendt"}</b></Typography>
          <Typography variant="body2">Sidst set: <b>{client.last_seen || "ukendt"}</b></Typography>
          <Typography variant="body2">Oppetid: <b>{client.uptime || "ukendt"}</b></Typography>
        </Stack>

        <Divider sx={{ mb: 2 }} />

        {/* Kiosk webadresse */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <ChromeReaderModeIcon color="primary" />
          <Typography variant="body1" sx={{ minWidth: 110 }}>
            Kiosk webadresse:
          </Typography>
          <TextField
            size="small"
            value={kioskUrl}
            onChange={e => setKioskUrl(e.target.value)}
            sx={{
              width: 250,
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

        <Divider sx={{ mb: 2 }} />

        {/* Handlingsknapper */}
        <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
          Handlinger
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
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

        <Divider sx={{ mb: 2 }} />

        {/* Terminal og remote desktop */}
        <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
          Fjernadgang
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
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

        <Divider sx={{ mb: 2 }} />

        {/* Livestream */}
        <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
          Livestream fra klient
        </Typography>
        <Box sx={{ mb: 1 }}>
          {/* Til MJPEG: */}
          {/* <img src={getClientStream(client.id)} alt="Livestream" style={{ maxWidth: 500 }} /> */}
          {/* Til WebRTC: */}
          {/* <video src={getClientStream(client.id)} controls autoPlay style={{ maxWidth: 500 }} /> */}
          <Box sx={{ p: 2, border: "1px solid #ccc", borderRadius: 2, background: "#fafafa" }}>
            <VideocamIcon color="action" sx={{ mr: 1 }} />
            Livestream placeholder (MJPEG/WebRTC)
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
