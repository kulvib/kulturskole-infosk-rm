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
import { updateClient } from "../api";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

export default function ClientInfoPage({
  clients,
  loading,
  onApproveClient,
  onRemoveClient,
  fetchClients,
}) {
  // Lokalitet state
  const [editableLocations, setEditableLocations] = useState({});
  const [savingLocation, setSavingLocation] = useState({});
  const [sortOrderEditing, setSortOrderEditing] = useState({});
  const [savingSortOrder, setSavingSortOrder] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [dragClients, setDragClients] = useState([]);

  // Initialiser dragClients og edit states, når klientlisten ændres
  useEffect(() => {
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
      return a.name.localeCompare(b.name);
    });
    setDragClients(approved);

    const initialLocations = {};
    const initialSortOrders = {};
    approved.forEach((client) => {
      initialLocations[client.id] = client.locality || "";
      initialSortOrders[client.id] =
        client.sort_order !== undefined && client.sort_order !== null
          ? client.sort_order
          : "";
    });
    setEditableLocations(initialLocations);
    setSortOrderEditing(initialSortOrders);
  }, [clients]);

  // Ikke-godkendte klienter
  const unapprovedClients = (clients?.filter((c) => c.status !== "approved") || [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  // Gem lokalitet
  const handleLocationSave = async (clientId) => {
    setSavingLocation((prev) => ({ ...prev, [clientId]: true }));
    try {
      await updateClient(clientId, { locality: editableLocations[clientId] });
      fetchClients();
    } catch (err) {
      alert("Kunne ikke gemme lokalitet: " + err.message);
    }
    setSavingLocation((prev) => ({ ...prev, [clientId]: false }));
  };

  // Gem sort_order
  const handleSortOrderSave = async (clientId) => {
    setSavingSortOrder((prev) => ({ ...prev, [clientId]: true }));
    try {
      const val = sortOrderEditing[clientId];
      const sort_order = val === "" ? null : Number(val);
      await updateClient(clientId, { sort_order });
      fetchClients();
    } catch (err) {
      alert("Kunne ikke gemme sortering: " + err.message);
    }
    setSavingSortOrder((prev) => ({ ...prev, [clientId]: false }));
  };

  // Slet klient
  const handleRemoveClient = async (clientId) => {
    try {
      await onRemoveClient(clientId);
      fetchClients();
    } catch (err) {
      alert("Kunne ikke fjerne klient: " + err.message);
    }
  };

  // Drag & drop handler
  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const reordered = Array.from(dragClients);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);

    setDragClients(reordered); // UI opdateres straks
    try {
      // sort_order starter fra 1
      for (let i = 0; i < reordered.length; i++) {
        await updateClient(reordered[i].id, { sort_order: i + 1 });
      }
      fetchClients();
    } catch (err) {
      alert("Kunne ikke opdatere sortering: " + err.message);
    }
  };

  // Statusfelt (mindre tekst)
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
          bgcolor: isOnline ? "#43a047" : "#FF8A80",
          color: "#111",
          fontWeight: 400,
          fontSize: 13, // mindre tekst
          boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
        }}
      >
        {isOnline ? "online" : "offline"}
      </Box>
    );
  }

  // Refresh-knap
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchClients();
    setRefreshing(false);
  };

  // Loading kun hvis loading er true
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
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <TextField
                                    size="small"
                                    value={editableLocations[client.id]}
                                    onChange={(e) =>
                                      setEditableLocations((prev) => ({
                                        ...prev,
                                        [client.id]: e.target.value,
                                      }))
                                    }
                                    disabled={savingLocation[client.id]}
                                    sx={{
                                      width: 120,
                                      '& .MuiInputBase-root': {
                                        height: 30,
                                      }
                                    }}
                                  />
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => handleLocationSave(client.id)}
                                    disabled={savingLocation[client.id]}
                                    sx={{ minWidth: 44, px: 1, height: 30 }}
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
