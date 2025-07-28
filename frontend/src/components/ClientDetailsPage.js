import React, { useEffect, useState } from "react";
import {
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Paper,
  Divider,
  Stack,
  Box,
  Button,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";

// Backend integration
const API_URL = "https://kulturskole-infosk-rm.onrender.com";
const token = "PASTE_YOUR_JWT_TOKEN_HERE"; // Indsæt din gyldige admin JWT-token her

export default function ClientDetailsPage({ clients }) {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch klient-data fra backend
  useEffect(() => {
    const fetchClient = async () => {
      setLoading(true);
      try {
        // Hvis clients prop er givet og matcher, brug den
        const localClient =
          clients &&
          clients.find(
            (c) => String(c.id) === String(clientId) || String(c.unique_id) === String(clientId)
          );
        if (localClient) {
          setClient(localClient);
        } else {
          // Ellers hent fra backend
          const res = await fetch(`${API_URL}/api/clients/`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            const found =
              data.find(
                (c) => String(c.id) === String(clientId) || String(c.unique_id) === String(clientId)
              ) || null;
            setClient(found);
          } else {
            setClient(null);
          }
        }
      } catch {
        setClient(null);
      }
      setLoading(false);
    };
    fetchClient();
  }, [clientId, clients]);

  if (loading) {
    return (
      <Box sx={{ p: 3, mt: 2 }}>
        <Typography>Indlæser klientdata...</Typography>
      </Box>
    );
  }

  if (!client) {
    return (
      <Box sx={{ p: 3, mt: 2 }}>
        <Typography>Klient ikke fundet.</Typography>
        <Button variant="contained" sx={{ mt: 2 }} onClick={() => navigate("/clients")}>
          Tilbage til klienter
        </Button>
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 3, mt: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Klient: {client.name || client.unique_id}
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Chip
          label={client.status === "online" ? "Online" : "Offline"}
          color={client.status === "online" ? "success" : "error"}
        />
        <Chip
          label={client.apiStatus === "approved" || client.status === "approved" ? "Godkendt" : "Ikke godkendt"}
          color={client.apiStatus === "approved" || client.status === "approved" ? "success" : "warning"}
        />
      </Stack>
      <Table>
        <TableBody>
          <TableRow>
            <TableCell variant="head">Navn</TableCell>
            <TableCell>{client.name || client.unique_id}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell variant="head">Lokalitet</TableCell>
            <TableCell>{client.locality || ""}</TableCell>
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
            <TableCell variant="head">Software Version</TableCell>
            <TableCell>{client.softwareVersion || client.sw_version || ""}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell variant="head">Sidst set</TableCell>
            <TableCell>{client.lastSeen || client.last_seen || ""}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell variant="head">Uptime</TableCell>
            <TableCell>{client.uptime || ""}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell variant="head">Kiosk Webadresse</TableCell>
            <TableCell>{client.kioskWebAddress || client.kiosk_url || ""}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell variant="head">Chrome kører</TableCell>
            <TableCell>
              {typeof client.chromeRunning === "boolean"
                ? client.chromeRunning
                  ? "Ja"
                  : "Nej"
                : ""}
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell variant="head">Chrome URL</TableCell>
            <TableCell>{client.chromeUrl || ""}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <Button variant="contained" sx={{ mt: 3 }} onClick={() => navigate("/clients")}>
        Tilbage til klienter
      </Button>
    </Paper>
  );
}
