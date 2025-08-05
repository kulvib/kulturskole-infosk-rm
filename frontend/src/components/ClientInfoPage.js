import React, { useState, useEffect, useRef } from "react";
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
import { getClients, approveClient, removeClient, updateClient } from "../api";
import { useAuth } from "../auth/authcontext";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

// Hjælpefunktion til at formatere dato/tid
function formatTimestamp(isoDate) {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year}, Kl. ${hour}:${minute}`;
}

// Sammenlign arrays af klienter (id+relevante felter)
function isClientListEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ca = a[i], cb = b[i];
    // Sammenlign relevante felter - fx id, name, locality, status, sort_order, isOnline
    if (
      ca.id !== cb.id ||
      ca.name !== cb.name ||
      ca.locality !== cb.locality ||
      ca.status !== cb.status ||
      ca.sort_order !== cb.sort_order ||
      ca.isOnline !== cb.isOnline
    ) {
      return false;
    }
  }
  return true;
}

export default function ClientInfoPage() {
  const { token } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dragClients, setDragClients] = useState([]);
  const [error, setError] = useState("");
  const lastFetchedClients = useRef([]);

  // Hent klienter fra API, men kun opdatér hvis der er ændringer
  const fetchClients = async (forceUpdate = false) => {
    setLoading(true);
    setError("");
    try {
      const data = await getClients(token);
      if (forceUpdate || !isClientListEqual(data, lastFetchedClients.current)) {
        setClients(data);
        lastFetchedClients.current = data;
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  // Polling: hent data hvert 30. sekund, men kun opdatér hvis ændringer
  useEffect(() => {
    fetchClients();
    let timer = setInterval(() => {
      fetchClients(false);
    }, 30000);
    return () => clearInterval(timer);
    // eslint-disable-next-line
  }, [token]);

  useEffect(() => {
    // Sortering: laveste sort_order først, derefter id
    const approved = (clients?.filter((c) => c.status === "approved") || []).slice();
    approved.sort((a, b) => {
      if (
        a.sort_order !== null &&
        a.sort_order !== undefined &&
        b.sort_order !== null &&
        b.sort_order !== undefined
      ) {
        return a.sort_order - b.sort_order;
      }
      if (a.sort_order !== null && a.sort_order !== undefined) return -1;
      if (b.sort_order !== null && b.sort_order !== undefined) return 1;
      return a.id - b.id;
    });
    setDragClients(approved);
  }, [clients]);

  const unapprovedClients = (clients?.filter((c) => c.status !== "approved") || [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleRemoveClient = async (clientId) => {
    try {
      await removeClient(clientId, token);
      fetchClients(true); // force update
    } catch (err) {
      alert("Kunne ikke fjerne klient: " + err.message);
    }
  };

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const reordered = Array.from(dragClients);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);

    setDragClients(reordered);
    try {
      for (let i = 0; i < reordered.length; i++) {
        await updateClient(reordered[i].id, { sort_order: i + 1 }, token);
      }
      fetchClients(true); // force update
    } catch (err) {
      alert("Kunne ikke opdatere sortering: " + err.message);
    }
  };

  function ClientStatusCell({ isOnline }) {
    return (
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 48,
          height: 20,
          borderRadius: "12px",
          bgcolor: isOnline ? "#66FF33" : "#CC3300",
          color: "#fff",
          fontWeight: 400,
          fontSize: 13,
          boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
        }}
      >
        {isOnline ? "online" : "offline"}
      </Box>
    );
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchClients(true); // force update
    setRefreshing(false);
  };

  const handleApproveClient = async (clientId) => {
    try {
      await approveClient(clientId, token);
      fetchClients(true); // force update
    } catch (err) {
      alert("Kunne ikke godkende klient: " + err.message);
    }
  };

  if (loading) {
    return (
      <Box sx={{ maxWidth: 900, mx: "auto", mt: 4 }}>
        <Typography
          variant="h5"
          sx={{
            color: "#444",
            fontWeight: 700,
            textTransform: "none",
            fontFamily: "inherit",
          }}
        >
          vent venligst...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", mt: 4, position: "relative", minHeight: "60vh" }}>
      {error && (
        <Typography sx={{ color: "red", mb: 2, fontWeight: 600 }}>
          {error}
        </Typography>
      )}
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
              {refreshing ? "Opdaterer..." : "Opdater"}
            </Button>
          </span>
        </Tooltip>
      </Stack>
      <Paper sx={{ mb: 4 }}>
        <TableContainer>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="clients-droppable">
              {(provided) => (
                <Table
                  size="small"
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Klientnavn</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Lokalitet</TableCell>
                      <TableCell sx={{ fontWeight: 700, textAlign: "center" }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 700, textAlign: "center" }}>Info</TableCell>
                      <TableCell sx={{ fontWeight: 700, textAlign: "center" }}>Fjern</TableCell>
                      <TableCell sx={{ fontWeight: 700, width: 60, textAlign: "right" }}>Sortering</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dragClients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          Ingen godkendte klienter.
                        </TableCell>
                      </TableRow>
                    ) : (
                      dragClients.map((client, idx) => (
                        <Draggable
                          key={client.id}
                          draggableId={client.id.toString()}
                          index={idx}
                        >
                          {(provided, snapshot) => (
                            <TableRow
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              style={{
                                ...provided.draggableProps.style,
                                background: snapshot.isDragging
                                  ? "#e3f2fd"
                                  : undefined,
                              }}
                              hover
                            >
                              <TableCell>{client.name}</TableCell>
                              <TableCell>
                                {client.locality || <span style={{ color: "#888" }}>Ingen lokalitet</span>}
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
                                    onClick={() => handleRemoveClient(client.id)}
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                              <TableCell align="right" {...provided.dragHandleProps} sx={{ cursor: "grab", width: 60 }}>
                                <span style={{ fontSize: 20 }}>☰</span>
                              </TableCell>
                            </TableRow>
                          )}
                        </Draggable>
                      ))
                    )}
                    {provided.placeholder}
                  </TableBody>
                </Table>
              )}
            </Droppable>
          </DragDropContext>
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
                <TableCell sx={{ fontWeight: 700 }}>Tilføjet</TableCell>
                <TableCell sx={{ fontWeight: 700, textAlign: "center" }}>Tilføj</TableCell>
                <TableCell sx={{ fontWeight: 700, textAlign: "center" }}>Fjern</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {unapprovedClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
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
                    <TableCell>
                      <span>{formatTimestamp(client.created_at)}</span>
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        variant="contained"
                        color="success"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => handleApproveClient(client.id)}
                        sx={{ minWidth: 44 }}
                      >
                        Tilføj
                      </Button>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Fjern klient">
                        <IconButton
                          color="error"
                          onClick={() => handleRemoveClient(client.id)}
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
    </Box>
  );
}
