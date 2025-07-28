import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Button,
  IconButton,
  Chip,
} from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";
import DeleteIcon from "@mui/icons-material/Delete";
import CircleIcon from "@mui/icons-material/Circle";

// Dummy data – erstattes med API-kald
const initialClients = [
  {
    id: 1,
    name: "Klient A",
    locality: "Lokale 1",
    status: "online", // eller "offline"
    apiStatus: "approved", // eller fx "pending"
  },
  {
    id: 2,
    name: "Klient B",
    locality: "Lokale 2",
    status: "offline",
    apiStatus: "approved",
  },
  {
    id: 3,
    name: "Klient C",
    locality: "Lokale 3",
    status: "online",
    apiStatus: "pending",
  },
];

export default function ClientInfoPage() {
  const [clients, setClients] = useState(initialClients);

  // Heartbeat-opdatering (dummy: toggler status hver 30. sek)
  useEffect(() => {
    const interval = setInterval(() => {
      setClients(prev =>
        prev.map(c =>
          c.id === 1
            ? { ...c, status: c.status === "online" ? "offline" : "online" }
            : c
        )
      );
    }, 30000); // 30 sekunder
    return () => clearInterval(interval);
  }, []);

  // Rediger lokalitet
  const handleLocalityChange = (id, value) => {
    setClients(prev =>
      prev.map(c => (c.id === id ? { ...c, locality: value } : c))
    );
  };

  // Fjern klient
  const handleRemoveClient = id => {
    setClients(prev => prev.filter(c => c.id !== id));
  };

  // Info-knap (dummy: alert)
  const handleInfoClick = id => {
    alert(`Viser info for klient med ID: ${id}`);
    // navigate(`/clients/${id}`) hvis du har en infounderside
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Klienter
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Navn</TableCell>
              <TableCell>Lokalitet</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Info</TableCell>
              <TableCell>Fjern</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {clients.map(client => (
              <TableRow key={client.id}>
                <TableCell>{client.name}</TableCell>
                <TableCell>
                  <TextField
                    value={client.locality}
                    onChange={e => handleLocalityChange(client.id, e.target.value)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    icon={
                      <CircleIcon
                        sx={{
                          color: client.status === "online" ? "green" : "red",
                          fontSize: 16,
                        }}
                      />
                    }
                    label={client.status === "online" ? "Online" : "Offline"}
                    color={client.status === "online" ? "success" : "error"}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <IconButton
                    color="primary"
                    onClick={() => handleInfoClick(client.id)}
                  >
                    <InfoIcon />
                  </IconButton>
                </TableCell>
                <TableCell>
                  {client.apiStatus === "approved" ? (
                    <IconButton
                      color="error"
                      onClick={() => handleRemoveClient(client.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  ) : (
                    <Button variant="outlined" color="inherit" disabled>
                      Ikke godkendt
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
