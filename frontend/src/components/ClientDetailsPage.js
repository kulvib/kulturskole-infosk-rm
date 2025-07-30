import React, { useEffect, useState } from "react";
import {
  Typography, Table, TableBody, TableRow, TableCell, TextField,
  Button, Chip, Stack, Divider, Box, Paper
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import TerminalIcon from "@mui/icons-material/Terminal";
import VideocamIcon from "@mui/icons-material/Videocam";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import InfoIcon from "@mui/icons-material/Info";

const apiUrl = process.env.REACT_APP_API_URL;

function getToken() {
  return localStorage.getItem("token");
}

export default function ClientDetailsPage({ clients }) {
  const { clientId } = useParams();
  const [client, setClient] = useState(null);
  const [kioskWebAddress, setKioskWebAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const localClient =
      clients &&
      clients.find(
        (c) => String(c.id) === String(clientId) || String(c.unique_id) === String(clientId)
      );
    if (localClient) {
      setClient(localClient);
      setKioskWebAddress(localClient.kioskWebAddress || "");
    } else {
      fetchClient();
    }
    async function fetchClient() {
      try {
        const res = await fetch(`${apiUrl}/api/clients/${clientId}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.ok) {
          const data = await res.json();
          setClient(data);
          setKioskWebAddress(data.kioskWebAddress || "");
        }
      } catch (e) {
        setClient(null);
      }
    }
  }, [clientId, clients]);

  // Gem ny kiosk webadresse
  const handleSaveKioskAddress = async () => {
    setSaving(true);
    await fetch(`${apiUrl}/api/clients/${clientId}/update`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ kioskWebAddress }),
    });
    setSaving(false);
  };

  // Actions (placeholder)
  const handleChromeShutdown = () => alert("Chrome shutdown trigget!");
  const handleClientAction = (action) => alert(`Client ${action} trigget!`);
  const handleOpenTerminal = () => alert("Åbner terminal (WebSocket proxy)");
  const handleOpenLiveStream = () => alert("Live stream åbnes (MJPEG/WebRTC)");

  if (!client) return <Typography sx={{ mt: 3 }}>Indlæser...</Typography>;

  return (
    <Paper sx={{ p: 3, maxWidth: 700, mx: "auto", mt: 5, boxShadow: 3 }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: "bold" }}>
        Klientinfo: {client.name || client.unique_id}
      </Typography>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Chip
          label={client.isOnline ? "Online" : "Offline"}
          color={client.isOnline ? "success" : "error"}
          sx={{ fontWeight: "bold" }}
        />
        <Chip
          label={client.status === "approved" ? "Godkendt" : "Ikke godkendt"}
          color={client.status === "approved" ? "success" : "warning"}
          sx={{ fontWeight: "bold" }}
        />
      </Stack>
      <Table sx={{ mb: 3 }}>
        <TableBody>
          <TableRow>
            <TableCell variant="head">Navn</TableCell>
            <TableCell>{client.name || client.unique_id}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell variant="head">Lokalitet</TableCell>
            <TableCell>{client.locality}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell variant="head">IP-adresse</TableCell>
            <TableCell>{client.ip || client.ip_address}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell variant="head">MAC-adresse</TableCell>
            <TableCell>{client.macAddress || client.mac_address}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell variant="head">Software version</TableCell>
            <TableCell>{client.softwareVersion || client.sw_version}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell variant="head">Sidst set</TableCell>
            <TableCell>{client.lastSeen || client.last_seen}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell variant="head">Oppetid</TableCell>
            <TableCell>{client.uptime}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <Divider sx={{ my: 3 }} />
      <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: "bold" }}>Kiosk webadresse</Typography>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <TextField
          label="Kiosk webadresse"
          value={kioskWebAddress}
          onChange={e => setKioskWebAddress(e.target.value)}
          size="small"
          sx={{ minWidth: 300 }}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={handleSaveKioskAddress}
          disabled={saving}
        >
          Gem ny webadresse
        </Button>
      </Stack>
      <Divider sx={{ my: 3 }} />
      <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>Handlinger</Typography>
      <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
        <Button
          onClick={handleChromeShutdown}
          variant="outlined"
          color="error"
          startIcon={<PowerSettingsNewIcon />}
        >
          Chrome shutdown
        </Button>
        <Button
          onClick={() => handleClientAction("start")}
          variant="outlined"
          color="primary"
          startIcon={<InfoIcon />}
        >
          Start klient
        </Button>
        <Button
          onClick={() => handleClientAction("restart")}
          variant="outlined"
          color="warning"
          startIcon={<RestartAltIcon />}
        >
          Genstart klient
        </Button>
        <Button
          onClick={() => handleClientAction("shutdown")}
          variant="outlined"
          color="error"
          startIcon={<PowerSettingsNewIcon />}
        >
          Shutdown klient
        </Button>
        <Button
          onClick={handleOpenTerminal}
          variant="contained"
          startIcon={<TerminalIcon />}
        >
          Åbn terminal
        </Button>
        <Button
          onClick={handleOpenLiveStream}
          variant="contained"
          color="success"
          startIcon={<VideocamIcon />}
        >
          Live stream
        </Button>
      </Stack>
      <Button sx={{ mt: 4 }} variant="text" onClick={() => navigate("/clients")}>
        Tilbage til klientliste
      </Button>
    </Paper>
  );
}
