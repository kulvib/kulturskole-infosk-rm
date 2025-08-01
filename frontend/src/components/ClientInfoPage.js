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
import { useAuth } from "../auth/authcontext"; // <-- Korrekt sti!

const API_BASE = "https://kulturskole-infosk-rm.onrender.com";

export default function ClientInfoPage({
  clients,
  loading,
  onApproveClient,
  onRemoveClient,
  fetchClients,
}) {
  const { token } = useAuth();

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
      const res = await fetch(`${API_BASE}/api/clients/${clientId}/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ locality: editableLocations[clientId] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || data.message || "Ukendt fejl");
      }
      fetchClients();
    } catch (err) {
      alert("Kunne ikke gemme lokalitet: " + err.message);
    }
    setSavingLocation((prev) => ({ ...prev, [clientId]: false }));
  };

  function ClientStatusCell({ isOnline }) {
    return (
      <Chip
        icon={
          <FiberManualRecordIcon
            sx={{
              color: isOnline ? "green" : "red",
              fontSize: 14,
              ml: "4px",
            }}
          />
        }
        label={isOnline ? "online" : "offline"}
        sx={{
          bgcolor: isOnline ? "rgba(76, 175, 80, 0.1)" : "rgba(244, 67, 54, 0.1)",
          color: isOnline ? "green" : "red",
          fontWeight: 700,
          textTransform: "lowercase",
          minWidth: 100,
          pl: "8px",
          ".MuiChip-icon": {
            marginLeft: "4px",
            marginRight: "6px",
          },
        }}
        size="small"
      />
    );
  }

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
                    <TableCell>
                      {client.name}
                    </TableCell>
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
                    <TableCell align="center">
                      <ClientStatusCell isOnline={client.isOnline} />
                    </TableCell>
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
                      <span>{client.ip_address || "ukendt"}</span>
                    </TableCell>
                    <TableCell>
                      <span>{client.mac_address || "ukendt"}</span>
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
