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
  useTheme,
  Snackbar,
  Alert as MuiAlert,
} from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { Link } from "react-router-dom";
import { getClients, approveClient, removeClient, updateClient } from "../api";
import { useAuth } from "../auth/authcontext";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

// Hjælpefunktion til at formatere dato/tid med sekunder og dansk tid
function formatTimestamp(isoDate) {
  if (!isoDate) return { date: "", time: "" };
  const dateObj = new Date(isoDate.endsWith("Z") ? isoDate : isoDate + "Z");
  const formatter = new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(dateObj);
  const day = parts.find(p => p.type === "day")?.value || "";
  const month = parts.find(p => p.type === "month")?.value || "";
  const year = parts.find(p => p.type === "year")?.value || "";
  const hour = parts.find(p => p.type === "hour")?.value || "";
  const minute = parts.find(p => p.type === "minute")?.value || "";
  const second = parts.find(p => p.type === "second")?.value || "";
  return {
    date: `${day}-${month}-${year}`,
    time: `Kl. ${hour}:${minute}:${second}`
  };
}

function CopyIconButton({ value, disabled, iconSize = 16 }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (err) {}
  };
  return (
    <Tooltip title={copied ? "Kopieret!" : "Kopiér"}>
      <span>
        <IconButton
          size="small"
          onClick={handleCopy}
          sx={{ ml: 0.5, p: 0.2 }}
          disabled={disabled}
        >
          <ContentCopyIcon sx={{ fontSize: iconSize * 0.96 }} color={copied ? "success" : "inherit"} />
        </IconButton>
      </span>
    </Tooltip>
  );
}

function isClientListEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ca = a[i], cb = b[i];
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

function ClientStatusCell({ isOnline }) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 48,
        height: 20,
        borderRadius: "12px",
        bgcolor: isOnline ? theme.palette.success.main : theme.palette.error.main,
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

export default function ClientInfoPage() {
  const { token } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dragClients, setDragClients] = useState([]);
  const lastFetchedClients = useRef([]);

  // Snackbar state
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ open: false, message: "", severity: "success" });
  };

  // Hent klienter fra API, kun opdatér hvis der er ændringer
  // Brug showLoading=true for første load og manuel refresh, false for polling
  const fetchClients = async (forceUpdate = false, showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const data = await getClients(token);
      if (forceUpdate || !isClientListEqual(data, lastFetchedClients.current)) {
        setClients(data);
        lastFetchedClients.current = data;
      }
    } catch (err) {
      showSnackbar("Fejl: " + err.message, "error");
    }
    if (showLoading) setLoading(false);
  };

  // Første load med overlay, derefter polling uden overlay
  useEffect(() => {
    fetchClients(false, true); // Første load med overlay!
    let timer = setInterval(() => {
      fetchClients(false, false); // Polling uden overlay!
    }, 5000); // 5 sekunder
    return () => clearInterval(timer);
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
      showSnackbar("Klient fjernet!", "success");
      fetchClients(true, true); // force update med overlay
    } catch (err) {
      showSnackbar("Kunne ikke fjerne klient: " + err.message, "error");
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
      showSnackbar("Sortering opdateret!", "success");
      fetchClients(true, true); // force update med overlay
    } catch (err) {
      showSnackbar("Kunne ikke opdatere sortering: " + err.message, "error");
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchClients(true, true); // force update med overlay
    setRefreshing(false);
  };

  const handleApproveClient = async (clientId) => {
    try {
      await approveClient(clientId, token);
      showSnackbar("Klient godkendt!", "success");
      fetchClients(true, true); // force update med overlay
    } catch (err) {
      showSnackbar("Kunne ikke godkende klient: " + err.message, "error");
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", mt: 4, position: "relative", minHeight: "60vh" }}>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3400}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <MuiAlert elevation={6} variant="filled" onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </MuiAlert>
      </Snackbar>
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
        <TableContainer style={{ position: "relative" }}>
          {/* Spinner overlay for loading */}
          {loading && (
            <Box sx={{
              position: "absolute",
              left: 0, top: 0, right: 0, bottom: 0,
              background: "rgba(255,255,255,0.7)",
              display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10
            }}>
              <CircularProgress />
            </Box>
          )}
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
                      <TableCell sx={{ fontWeight: 700 }}>Klient ID</TableCell>
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
                        <TableCell colSpan={7} align="center">
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
                              <TableCell>{client.id}</TableCell>
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
                <TableCell sx={{ fontWeight: 700, width: "14.28%" }}>Klient ID</TableCell>
                <TableCell sx={{ fontWeight: 700, width: "14.28%" }}>Klientnavn</TableCell>
                <TableCell sx={{ fontWeight: 700, width: "14.28%" }}>IP-adresser</TableCell>
                <TableCell sx={{ fontWeight: 700, width: "14.28%" }}>MAC-adresser</TableCell>
                <TableCell sx={{ fontWeight: 700, width: "14.28%" }}>Tilføjet</TableCell>
                <TableCell sx={{ fontWeight: 700, width: "14.28%", textAlign: "center" }}>Godkend</TableCell>
                <TableCell sx={{ fontWeight: 700, width: "14.28%", textAlign: "center" }}>Fjern</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {unapprovedClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    Ingen ikke-godkendte klienter.
                  </TableCell>
                </TableRow>
              ) : (
                unapprovedClients.map((client) => (
                  <TableRow key={client.id} hover>
                    <TableCell sx={{ width: "14.28%" }}>
                      {client.id}
                    </TableCell>
                    <TableCell sx={{ width: "14.28%" }}>
                      {client.name || "Ukendt navn"}
                    </TableCell>
                    <TableCell sx={{ width: "14.28%" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <div style={{ display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
                          <b>WiFi:</b>&nbsp;
                          <span style={{ whiteSpace: "nowrap" }}>{client.wifi_ip_address || "ukendt"}</span>
                          <CopyIconButton value={client.wifi_ip_address || ""} disabled={!client.wifi_ip_address} iconSize={14.4} />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
                          <b>LAN:</b>&nbsp;
                          <span style={{ whiteSpace: "nowrap" }}>{client.lan_ip_address || "ukendt"}</span>
                          <CopyIconButton value={client.lan_ip_address || ""} disabled={!client.lan_ip_address} iconSize={14.4} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell sx={{ width: "14.28%" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <div style={{ display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
                          <b>WiFi:</b>&nbsp;
                          <span style={{ whiteSpace: "nowrap" }}>{client.wifi_mac_address || "ukendt"}</span>
                          <CopyIconButton value={client.wifi_mac_address || ""} disabled={!client.wifi_mac_address} iconSize={14.4} />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
                          <b>LAN:</b>&nbsp;
                          <span style={{ whiteSpace: "nowrap" }}>{client.lan_mac_address || "ukendt"}</span>
                          <CopyIconButton value={client.lan_mac_address || ""} disabled={!client.lan_mac_address} iconSize={14.4} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell sx={{ width: "14.28%" }}>
                      {(() => {
                        const ts = formatTimestamp(client.created_at);
                        return (
                          <span style={{ whiteSpace: "pre-line" }}>
                            {ts.date}
                            {"\n"}
                            {ts.time}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell sx={{ width: "14.28%", textAlign: "center" }}>
                      <Button
                        variant="contained"
                        color="success"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => handleApproveClient(client.id)}
                        sx={{ minWidth: 44 }}
                      >
                        Godkend
                      </Button>
                    </TableCell>
                    <TableCell sx={{ width: "14.28%", textAlign: "center" }}>
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
