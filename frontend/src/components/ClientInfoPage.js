import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  IconButton,
  TextField,
  Button,
  Divider,
  Chip,
  Tooltip,
  Stack,
  CircularProgress,
} from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { Link } from "react-router-dom";

export default function ClientInfoPage({
  clients,
  setClients,
  loading,
  onApproveClient,
  onRemoveClient,
  fetchClients,
}) {
  // Midlertidig lagring af lokalitetsfelt
  const [editableLocations, setEditableLocations] = useState({});
  const [savingLocation, setSavingLocation] = useState({}); // id: bool

  // Opdel klienter
  const approvedClients = clients.filter((c) => c.status === "approved");
  const unapprovedClients = clients.filter((c) => c.status !== "approved");

  // Initialiser lokalitetsfelter for godkendte klienter
  useEffect(() => {
    const initialLocations = {};
    approvedClients.forEach(
      (client) => (initialLocations[client.id] = client.locality || "")
    );
    setEditableLocations(initialLocations);
  }, [clients]);

  // Opdater klienter hvert 15. sekund for frisk online-status
  useEffect(() => {
    const interval = setInterval(() => {
      fetchClients();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchClients]);

  // Gem lokalitet i backend
  const handleLocationSave = async (clientId) => {
    setSavingLocation((prev) => ({ ...prev, [clientId]: true }));
    try {
      await fetch(`/api/clients/${clientId}/update`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locality: editableLocations[clientId] }),
      });
      // Opdatér klientlisten
      fetchClients();
    } catch (err) {
      alert("Kunne ikke gemme lokalitet");
    }
    setSavingLocation((prev) => ({ ...prev, [clientId]: false }));
  };

  const handleLocationChange = (clientId, value) => {
    setEditableLocations((prev) => ({
      ...prev,
      [clientId]: value,
    }));
  };

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", mt: 4 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Godkendte klienter
      </Typography>
      <Paper sx={{ mb: 4 }}>
        <List>
          {approvedClients.length === 0 && (
            <ListItem>
              <ListItemText primary="Ingen godkendte klienter." />
            </ListItem>
          )}
          {approvedClients.map((client) => (
            <React.Fragment key={client.id}>
              <ListItem
                secondaryAction={
                  <Stack direction="row" spacing={1} alignItems="center">
                    {/* Info-knap */}
                    <Tooltip title="Info">
                      <IconButton
                        component={Link}
                        to={`/clients/${client.id}`}
                        color="primary"
                      >
                        <InfoIcon />
                      </IconButton>
                    </Tooltip>
                    {/* Fjern klient */}
                    <Tooltip title="Fjern klient">
                      <IconButton
                        edge="end"
                        color="error"
                        onClick={() => onRemoveClient(client.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                }
              >
                {/* Online/offline prik */}
                <Tooltip
                  title={client.isOnline ? "Online" : "Offline"}
                >
                  <FiberManualRecordIcon
                    sx={{
                      color: client.isOnline ? "green" : "red",
                      mr: 1,
                    }}
                  />
                </Tooltip>
                {/* Klientnavn */}
                <ListItemText
                  primary={
                    <Typography sx={{ fontWeight: 600 }}>
                      {client.name}
                    </Typography>
                  }
                  secondary={
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="caption" sx={{ color: "gray" }}>
                        Lokalitet:
                      </Typography>
                      <TextField
                        size="small"
                        value={editableLocations[client.id] || ""}
                        onChange={(e) =>
                          handleLocationChange(client.id, e.target.value)
                        }
                        disabled={savingLocation[client.id]}
                        sx={{ width: 180 }}
                      />
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleLocationSave(client.id)}
                        disabled={savingLocation[client.id]}
                        sx={{ ml: 1 }}
                      >
                        {savingLocation[client.id] ? (
                          <CircularProgress size={18} />
                        ) : (
                          "Gem"
                        )}
                      </Button>
                    </Stack>
                  }
                />
              </ListItem>
              <Divider />
            </React.Fragment>
          ))}
        </List>
      </Paper>

      <Typography variant="h5" sx={{ mb: 2 }}>
        Ikke godkendte klienter
      </Typography>
      <Paper>
        <List>
          {unapprovedClients.length === 0 && (
            <ListItem>
              <ListItemText primary="Ingen ikke-godkendte klienter." />
            </ListItem>
          )}
          {unapprovedClients.map((client) => (
            <React.Fragment key={client.id}>
              <ListItem
                secondaryAction={
                  <Button
                    variant="contained"
                    color="success"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => onApproveClient(client.id)}
                  >
                    Tilføj klient
                  </Button>
                }
              >
                <ListItemText
                  primary={
                    <Typography sx={{ fontWeight: 600 }}>
                      {client.name || "Ukendt navn"}
                    </Typography>
                  }
                  secondary={
                    <Stack direction="row" spacing={3}>
                      <Chip
                        label={`IP: ${client.ip_address || "ukendt"}`}
                        size="small"
                        sx={{ bgcolor: "#e3f2fd" }}
                      />
                      <Chip
                        label={`MAC: ${client.mac_address || "ukendt"}`}
                        size="small"
                        sx={{ bgcolor: "#f3e5f5" }}
                      />
                    </Stack>
                  }
                />
              </ListItem>
              <Divider />
            </React.Fragment>
          ))}
        </List>
      </Paper>
    </Box>
  );
}
