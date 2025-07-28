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

// Udvidet dummydata
const CLIENTS = [
  { id: 1, name: "Klient A", locality: "Lokale 1", status: "online", ip: "192.168.1.101", macAddress: "00:1A:2B:3C:4D:5E", apiStatus: "approved" },
  { id: 2, name: "Klient B", locality: "Lokale 2", status: "offline", ip: "192.168.1.102", macAddress: "00:1A:2B:3C:4D:5F", apiStatus: "approved" },
  { id: 3, name: "Klient C", locality: "Lokale 3", status: "online", ip: "192.168.1.103", macAddress: "00:1A:2B:3C:4D:60", apiStatus: "pending" },
  { id: 4, name: "Klient D", locality: "Lokale 4", status: "offline", ip: "192.168.1.104", macAddress: "00:1A:2B:3C:4D:61", apiStatus: "pending" },
  { id: 5, name: "Klient E", locality: "Lokale 5", status: "online", ip: "192.168.1.105", macAddress: "00:1A:2B:3C:4D:62", apiStatus: "approved" },
  { id: 6, name: "Klient F", locality: "Lokale 6", status: "offline", ip: "192.168.1.106", macAddress: "00:1A:2B:3C:4D:63", apiStatus: "pending" },
  { id: 7, name: "Klient G", locality: "Lokale 7", status: "online", ip: "192.168.1.107", macAddress: "00:1A:2B:3C:4D:64", apiStatus: "approved" },
  { id: 8, name: "Klient H", locality: "Lokale 8", status: "offline", ip: "192.168.1.108", macAddress: "00:1A:2B:3C:4D:65", apiStatus: "pending" },
];

// Funktion til at simulere opdatering af heartbeat/status
function getRefreshedClientsData(clients) {
  return clients.map(client => ({
    ...client,
    status: Math.random() > 0.5 ? "online" : "offline"
  }));
}

export default function ClientInfoPage({ clients = CLIENTS, onRemoveClient, setClients }) {
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [localities, setLocalities] = useState(() => {
    const obj = {};
    clients.forEach(c => { obj[c.id] = c.locality; });
    return obj;
  });

  // Heartbeat: opdater status hvert 30. sekund
  useEffect(() => {
    const interval = setInterval(() => {
      setClients(prevClients => getRefreshedClientsData(prevClients));
    }, 30000);
    return () => clearInterval(interval);
  }, [setClients]);

  // Refresh-knap: manuel opdatering
  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setClients(prevClients => getRefreshedClientsData(prevClients));
      setIsRefreshing(false);
    }, 1200);
  };

  // Lokalitet redigeres inline
  const handleLocalityChange = (id, value) => {
    setLocalities(prev => ({
      ...prev,
      [id]: value
    }));
    setClients(prevClients =>
      prevClients.map(c =>
        c.id === id ? { ...c, locality: value } : c
      )
    );
  };

  // Split klienter op
  const approvedClients = clients.filter(c => c.apiStatus === "approved");
  const pendingClients = clients.filter(c => c.apiStatus === "pending");

  return (
    <Paper sx={{ p: 3, mt: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Godkendte klienter
        </Typography>
        <Tooltip title="Opdater data for alle klienter">
          <span>
            <IconButton color="primary" onClick={handleRefresh} disabled={isRefreshing}>
              {isRefreshing ? <CircularProgress size={24} /> : <RefreshIcon />}
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
                <TableCell>{client.name}</TableCell>
                <TableCell>
                  <TextField
                    value={localities[client.id]}
                    onChange={e => handleLocalityChange(client.id, e.target.value)}
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
                          color: client.status === "online" ? "green" : "red"
                        }}
                      />
                    }
                    sx={{
                      fontWeight: "bold",
                      bgcolor: client.status === "online" ? "#d4edda" : "#f8d7da",
                      color: client.status === "online" ? "green" : "red"
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Tooltip title="Vis klient-info">
                    <IconButton
                      color="primary"
                      onClick={() => navigate(`/clients/${client.id}`)}
                    >
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
                <TableCell>{client.name}</TableCell>
                <TableCell>{client.ip}</TableCell>
                <TableCell>{client.macAddress}</TableCell>
                <TableCell align="center">
                  <Button
                    variant="contained"
                    color="success"
                    onClick={() => setClients(prev =>
                      prev.map(c =>
                        c.id === client.id ? { ...c, apiStatus: "approved" } : c
                      )
                    )}
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
