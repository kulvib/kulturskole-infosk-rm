import React, { useState } from "react";
import {
  Box,
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
  Paper
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import DeleteIcon from "@mui/icons-material/Delete";
import { useNavigate } from "react-router-dom";

const CLIENTS = [
  { id: 1, name: "Klient A", locality: "Lokale 1", status: "online", ip: "192.168.1.101" },
  { id: 2, name: "Klient B", locality: "Lokale 2", status: "offline", ip: "192.168.1.102" },
  { id: 3, name: "Klient C", locality: "Lokale 3", status: "online", ip: "192.168.1.103" },
  { id: 4, name: "Klient D", locality: "Lokale 4", status: "offline", ip: "192.168.1.104" },
];

function getRefreshedClientsData() {
  // Simulerer et API kald og returnerer opdaterede data
  // Du kan udvide med mere dynamik eller et rigtigt API-kald.
  return CLIENTS.map(client => ({
    ...client,
    status: Math.random() > 0.5 ? "online" : "offline"
  }));
}

export default function ClientInfoPage({ clients, onRemoveClient, setClients }) {
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      // Hent nye data fra klienterne (simuleret)
      const updatedClients = getRefreshedClientsData();
      setClients(updatedClients);
      setIsRefreshing(false);
    }, 1200); // simuleret netværksforsinkelse
  };

  return (
    <Paper sx={{ p: 3, mt: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Klienter
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
            <TableCell>IP</TableCell>
            <TableCell align="right">Handling</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {clients.map((client) => (
            <TableRow
              key={client.id}
              hover
              sx={{ cursor: "pointer" }}
              onClick={() => navigate(`/clients/${client.id}`)}
            >
              <TableCell>{client.name}</TableCell>
              <TableCell>{client.locality}</TableCell>
              <TableCell>
                <Chip
                  label={client.status === "online" ? "Online" : "Offline"}
                  color={client.status === "online" ? "success" : "error"}
                  size="small"
                />
              </TableCell>
              <TableCell>{client.ip}</TableCell>
              <TableCell align="right" onClick={e => e.stopPropagation()}>
                <Tooltip title="Fjern klient">
                  <IconButton color="error" onClick={() => onRemoveClient(client.id)}>
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}
