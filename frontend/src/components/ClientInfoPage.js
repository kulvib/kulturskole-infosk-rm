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
  IconButton,
  Chip,
} from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";
import DeleteIcon from "@mui/icons-material/Delete";
import CircleIcon from "@mui/icons-material/Circle";

export default function ClientInfoPage({ clients, onRemoveClient, setClients }) {
  // Heartbeat-opdatering (dummy: toggler status på første klient hver 30. sek)
  useEffect(() => {
    const interval = setInterval(() => {
      setClients(prev =>
        prev.map(c =>
          c.id === 1
            ? { ...c, status: c.status === "online" ? "offline" : "online" }
            : c
        )
      );
    }, 30000);
    return () => clearInterval(interval);
  }, [setClients]);

  // Rediger lokalitet
  const handleLocalityChange = (id, value) => {
    setClients(prev =>
      prev.map(c => (c.id === id ? { ...c, locality: value } : c))
    );
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
                  <IconButton
                    color="error"
                    onClick={() => onRemoveClient(client.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>Ingen godkendte klienter endnu.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
