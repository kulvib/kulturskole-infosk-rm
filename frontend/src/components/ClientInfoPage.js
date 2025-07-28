import React, { useEffect, useState } from "react";
import {
  Typography, Table, TableBody, TableCell, TableHead, TableRow, TextField,
  IconButton, Chip, Button, CircularProgress, Tooltip, Paper, Stack
} from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useNavigate } from "react-router-dom";

export default function ClientInfoPage({
  clients,
  setClients,
  loading,
  onApproveClient,
  onRemoveClient,
  fetchClients,
  navigate: navProp,
}) {
  const navigate = useNavigate();
  // Heartbeat opdatering
  useEffect(() => {
    const interval = setInterval(() => {
      fetchClients && fetchClients();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchClients]);

  // Lokalitet redigering
  const handleLocalityChange = async (id, value) => {
    await fetch(`/api/clients/${id}/update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ locality: value }),
    });
    setClients &&
      setClients((prev) =>
        prev.map((c) => (c.id === id ? { ...c, locality: value } : c))
      );
  };

  return (
    <Paper sx={{ p: 3, boxShadow: 3 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold" }}>Klientliste</Typography>
      {loading ? (
        <Stack alignItems="center" sx={{ py: 4 }}>
          <CircularProgress />
        </Stack>
      ) : (
        <Table>
          <TableHead>
            <TableRow sx={{ background: "#f0f5f9" }}>
              <TableCell sx={{ fontWeight: "bold" }}>Navn</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Lokalitet</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Status</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Info</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Godkend</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Fjern</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {clients.map(client => (
              <TableRow key={client.id} sx={{ transition: "background 0.3s", ":hover": { background: "#f5f7fa" } }}>
                <TableCell>{client.name || client.unique_id}</TableCell>
                <TableCell>
                  <TextField
                    value={client.locality || ""}
                    onChange={e => handleLocalityChange(client.id, e.target.value)}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    icon={<CheckCircleIcon />}
                    label={client.status === "online" ? "Online" : "Offline"}
                    color={client.status === "online" ? "success" : "error"}
                    sx={{
                      fontWeight: "bold",
                      bgcolor: client.status === "online" ? "#d4edda" : "#f8d7da",
                      color: client.status === "online" ? "#388e3c" : "#d32f2f",
                      px: 2
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Tooltip title="Info">
                    <IconButton
                      color="primary"
                      onClick={() => (navProp ? navProp(`/clients/${client.id}`) : navigate(`/clients/${client.id}`))}
                    >
                      <InfoIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  {client.apiStatus === "pending" && (
                    <Button
                      variant="contained"
                      color="success"
                      sx={{ fontWeight: "bold", borderRadius: 2 }}
                      onClick={() => onApproveClient(client.id)}
                    >
                      Godkend
                    </Button>
                  )}
                </TableCell>
                <TableCell>
                  {client.apiStatus === "approved" && (
                    <IconButton
                      color="error"
                      onClick={() => onRemoveClient(client.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Paper>
  );
}
