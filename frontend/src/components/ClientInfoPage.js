import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  TextField,
  Button,
  Tooltip,
  CircularProgress,
  Stack,
  Chip,
} from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { Link } from "react-router-dom";

export default function ClientInfoPage({
  clients,
  loading,
  onApproveClient,
  onRemoveClient,
  fetchClients,
}) {
  const [editableLocations, setEditableLocations] = useState({});
  const [savingLocation, setSavingLocation] = useState({});

  const approvedClients = clients?.filter((c) => c.status === "approved") || [];
  const unapprovedClients = clients?.filter((c) => c.status !== "approved") || [];

  useEffect(() => {
    const initialLocations = {};
    approvedClients.forEach(
      (client) => (initialLocations[client.id] = client.locality || "")
    );
    setEditableLocations(initialLocations);
  }, [clients]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchClients();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchClients]);

  const handleLocationSave = async (clientId) => {
    setSavingLocation((prev) => ({ ...prev, [clientId]: true }));
    try {
      await fetch(`/api/clients/${clientId}/update`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locality: editableLocations[clientId] }),
      });
      fetchClients();
    } catch (err) {
      alert("Kunne ikke gemme lokalitet");
    }
    setSavingLocation((prev) => ({ ...prev, [clientId]: false }));
  };

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", mt: 4 }}>
      {/* Godkendte klienter */}
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>
        Godkendte klienter
      </Typography>
      <Paper sx={{ mb: 4 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Klientnavn</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Lokalitet</TableCell>
                <TableCell sx={{ fontWeight: 700, textAlign: "center" }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700, textAlign: "center" }}>Info</TableCell>
                <TableCell sx={{ fontWeight: 700, textAlign: "center" }}>Fjern</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {approvedClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    Ingen godkendte klienter.
                  </TableCell>
                </TableRow>
              ) : (
                approvedClients.map((client) => (
                  <TableRow key={client.id} hover>
                    {/* Klientnavn */}
                    <TableCell>
                      {client.name}
                    </TableCell>
                    {/* Lokalitet */}
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TextField
                          size="small"
                          value={editableLocations[client.id] || ""}
                          onChange={(e) =>
                            setEditableLocations((prev) => ({
                              ...prev,
                              [client.id]: e.target.value,
                            }))
                          }
                          disabled={savingLocation[client.id]}
                          sx={{ width: 150 }}
                        />
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleLocationSave(client.id)}
                          disabled={savingLocation[client.id]}
                          sx={{ minWidth: 44, px: 1 }}
                        >
                          {savingLocation[client.id] ? (
                            <CircularProgress size={18} />
                          ) : (
                            "Gem"
                          )}
                        </Button>
                      </Stack>
                    </TableCell>
                    {/* Status */}
                    <TableCell align="center">
                      <Tooltip title={client.isOnline ? "Online" : "Offline"}>
                        <FiberManualRecordIcon
                          sx={{
                            color: client.isOnline ? "green" : "red",
                            fontSize: 22,
                          }}
                        />
                      </Tooltip>
                    </TableCell>
                    {/* Info */}
                    <TableCell align="center">
                      <Tooltip title="Info">
                        <IconButton
                          component={Link}
                          to={`/clients/${client.id}`}
                          color="primary"
                        >
                          <InfoIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                    {/* Fjern */}
                    <TableCell align="center">
                      <Tooltip title="Fjern klient">
                        <IconButton
                          color="error"
                          onClick={() => onRemoveClient(client.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Ikke godkendte klienter */}
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>
        Ikke godkendte klienter
      </Typography>
      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Klientnavn</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>IP-adresse</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>MAC-adresse</TableCell>
                <TableCell sx={{ fontWeight: 700, textAlign: "center" }}>Tilføj</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {unapprovedClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    Ingen ikke-godkendte klienter.
                  </TableCell>
                </TableRow>
              ) : (
                unapprovedClients.map((client) => (
                  <TableRow key={client.id} hover>
                    <TableCell>
                      {client.name || "Ukendt navn"}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={client.ip_address || "ukendt"}
                        size="small"
                        sx={{ bgcolor: "#e3f2fd" }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={client.mac_address || "ukendt"}
                        size="small"
                        sx={{ bgcolor: "#f3e5f5" }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        variant="contained"
                        color="success"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => onApproveClient(client.id)}
                        sx={{ minWidth: 44 }}
                      >
                        Tilføj
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
