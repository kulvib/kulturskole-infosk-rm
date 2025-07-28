import React, { useEffect, useState } from "react";
import {
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  CircularProgress,
  Button,
  Stack,
  Chip,
  Paper,
  TextField,
  Divider,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import DeleteIcon from "@mui/icons-material/Delete";
import InfoIcon from "@mui/icons-material/Info";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useNavigate } from "react-router-dom";

const API_URL = "https://kulturskole-infosk-rm.onrender.com";
const token = "PASTE_YOUR_JWT_TOKEN_HERE"; // Indsæt din gyldige admin JWT-token her

export default function ClientInfoPage({
  clients,
  onRemoveClient,
  onApproveClient,
  setClients,
  loading = false,
}) {
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [localities, setLocalities] = useState(() => {
    const obj = {};
    clients.forEach((c) => {
      obj[c.id] = c.locality || "";
    });
    return obj;
  });

  // Heartbeat: opdater status hvert 30. sekund (fra backend)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchClients();
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line
  }, []);

  // Fetch clients fra backend
  const fetchClients = async () => {
    try {
      const res = await fetch(`${API_URL}/api/clients/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setClients(data);
        // Opdater lokaliteter hvis ændring
        const obj = {};
        data.forEach((c) => {
          obj[c.id] = c.locality || "";
        });
        setLocalities(obj);
      }
    } catch {
      // Håndter evt. fejl
    }
  };

  // Refresh-knap: manuel opdatering
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchClients();
    setIsRefreshing(false);
  };

  // Lokalitet redigeres inline
  const handleLocalityChange = async (id, value) => {
    setLocalities((prev) => ({
      ...prev,
      [id]: value,
    }));
    // Opdater backend
    try {
      await fetch(`${API_URL}/api/clients/${id}/update`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ locality: value }),
      });
      // Opdater lokal klientliste
      setClients((prevClients) =>
        prevClients.map((c) => (c.id === id ? { ...c, locality: value } : c))
      );
    } catch {
      // Håndter evt. fejl
    }
  };

  // Split klienter op
  const approvedClients = clients.filter((c) => c.status === "approved" || c.apiStatus === "approved");
  const pendingClients = clients.filter((c) => c.status === "pending" || c.apiStatus === "pending");

  return (
    <Paper sx={{ p: 3, mt: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Godkendte klienter
        </Typography>
        <Tooltip title="Opdater data for alle klienter">
          <span>
            <IconButton color="primary" onClick={handleRefresh} disabled={isRefreshing || loading}>
              {isRefreshing || loading ? <CircularProgress size={24} /> : <RefreshIcon />}
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Navn</TableCell>
            <TableCell>Lokalitet</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Info</TableCell>
            <TableCell align="center">Fjern</TableCell>
            <TableCell align="center">Godkendt</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {approvedClients.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6}>Ingen godkendte klienter.</TableCell>
            </TableRow>
          ) : (
            approvedClients.map((client) => (
              <TableRow key={client.id} hover>
                <TableCell>{client.name || client.unique_id}</TableCell>
                <TableCell>
                  <TextField
                    value={localities[client.id]}
                    onChange={(e) => handleLocalityChange(client.id, e.target.value)}
                    size="small"
                    variant="outlined"
                    sx={{ minWidth: 120 }}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={client.status === "online" ? "Online" : "Offline"}
                    color={client.status === "online" ? "success" : "error"}
                    size="small"
                    icon={
                      <CheckCircleIcon
                        sx={{
                          color: client.status === "online" ? "green" : "red",
                        }}
                      />
                    }
                    sx={{
                      fontWeight: "bold",
                      bgcolor: client.status === "online" ? "#d4edda" : "#f8d7da",
                      color: client.status === "online" ? "green" : "red",
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Tooltip title="Vis klient-info">
                    <IconButton color="primary" onClick={() => navigate(`/clients/${client.id}`)}>
                      <InfoIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="Fjern klient">
                    <IconButton
                      color="error"
                      onClick={() => onRemoveClient && onRemoveClient(client.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
                <TableCell align="center">
                  <Chip label="Godkendt" color="success" size="small" />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Divider og ikke-godkendte klienter */}
      <Divider sx={{ my: 4 }} />

      <Typography variant="h6" sx={{ mb: 2 }}>
        Ikke godkendte klienter
      </Typography>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Navn</TableCell>
            <TableCell>IP</TableCell>
            <TableCell>MAC adresse</TableCell>
            <TableCell align="center">Godkend</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pendingClients.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4}>Ingen ikke-godkendte klienter.</TableCell>
            </TableRow>
          ) : (
            pendingClients.map((client) => (
              <TableRow key={client.id} hover>
                <TableCell>{client.name || client.unique_id}</TableCell>
                <TableCell>{client.ip || client.ip_address}</TableCell>
                <TableCell>{client.macAddress || client.mac_address}</TableCell>
                <TableCell align="center">
                  <Button
                    variant="contained"
                    color="success"
                    onClick={() => onApproveClient && onApproveClient(client.id)}
                    disabled={loading}
                  >
                    Godkend
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Paper>
  );
}
