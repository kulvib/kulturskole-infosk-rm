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
} from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/authcontext";

const API_BASE = "https://kulturskole-infosk-rm.onrender.com";

export default function ClientInfoPage({
  clients,
  loading,
  onApproveClient,
  fetchClients,
}) {
  const { token } = useAuth();

  const [editableLocations, setEditableLocations] = useState({});
  const [savingLocation, setSavingLocation] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  // Sortér klienter alfabetisk efter navn
  const approvedClients = (clients?.filter((c) => c.status === "approved") || [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const unapprovedClients = (clients?.filter((c) => c.status !== "approved") || [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    const initialLocations = {};
    approvedClients.forEach(
      (client) => (initialLocations[client.id] = client.locality || "")
    );
    setEditableLocations(initialLocations);
  }, [clients]);

  // Polling: check for new data every 15s, only update if data changed
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/clients`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const newClients = await res.json();
          // Compare old and new data
          const oldStr = JSON.stringify(clients);
          const newStr = JSON.stringify(newClients);
          if (oldStr !== newStr) {
            fetchClients();
          }
        }
      } catch (e) {
        // Optionally handle fetch error
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [clients, token, fetchClients]);

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

  // Slet klient og opdater listen
  const onRemoveClient = async (clientId) => {
    try {
      await fetch(`${API_BASE}/api/clients/${clientId}/remove`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchClients();
    } catch (err) {
      alert("Kunne ikke fjerne klient: " + err.message);
    }
  };

  // Statusfelt med lys rød/grøn og sort, ikke fed tekst
  function ClientStatusCell({ isOnline }) {
    return (
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 80,
          height: 32,
          borderRadius: "16px",
          bgcolor: isOnline ? "#43a047" : "#FF8A80", // Lys grøn / lys rød
          color: "#111", // Sort tekst
          fontWeight: 400, // Ikke fed
          fontSize: 15,
          boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
        }}
      >
        {isOnline ? "online" : "offline"}
      </Box>
    );
  }

  // Håndter opdater-knap
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchClients();
    setRefreshing(false);
  };

  // Fade tekst, vises mens der loades klienter
  const showLoadingText = loading || !clients || clients.length === 0;

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", mt: 4, position: "relative", minHeight: "60vh" }}>
      {/* Kun loading-fade besked, intet andet synligt */}
      {showLoadingText ? (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            width: "100%",
            position: "absolute",
            top: 0,
            left: 0,
            zIndex: 10,
            bgcolor: "background.default",
          }}
        >
          <Typography
            variant="h5"
            sx={{
              color: "#444",
              animation: "fade 1.5s infinite alternate",
              fontWeight: 700,
              textTransform: "none",
              fontFamily: "inherit",
              '@keyframes fade': {
                from: { opacity: 0.2 },
                to: { opacity: 1 },
              },
            }}
          >
            vent venligst...
          </Typography>
        </Box>
      ) : (
        <>
          {/* Top row med titel og opdater-knap */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Godkendte klienter
            </Typography>
            <Tooltip title="Opdater klientdata">
              <span>
                <Button
                  startIcon={
                    refreshing ? (
                      <CircularProgress size={20} />
                    ) : (
                      <RefreshIcon />
                    )
                  }
                  onClick={handleRefresh}
                  disabled={refreshing}
                  sx={{ minWidth: 0, fontWeight: 500, textTransform: "none" }}
                >
                  Opdater
                </Button>
              </span>
            </Tooltip>
          </Stack>
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
        </>
      )}
    </Box>
  );
}
