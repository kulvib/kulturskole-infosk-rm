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
  Skeleton,
  useTheme,
} from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { Link } from "react-router-dom";

function OnlineIndicator({ online }) {
  const theme = useTheme();
  return (
    <FiberManualRecordIcon
      sx={{
        color: online ? theme.palette.success.main : theme.palette.error.main,
        fontSize: 18,
        mr: 1,
      }}
    />
  );
}

function ClientRow({
  client,
  onRemove,
  onSaveLocality,
  isSaving,
  editableLocation,
  setEditableLocation,
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        mb: 2,
        p: 2,
        borderRadius: 2,
        bgcolor: client.isOnline ? "rgba(76,175,80,0.07)" : "background.paper",
        transition: "background 0.2s",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        spacing={2}
      >
        <Stack direction="row" alignItems="center" spacing={2} flex={1}>
          <OnlineIndicator online={client.isOnline} />
          <Box>
            <Typography variant="h6" fontWeight={600}>
              {client.name}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
              <Typography variant="caption" color="text.secondary">
                Lokalitet:
              </Typography>
              <TextField
                size="small"
                value={editableLocation[client.id] || ""}
                onChange={e =>
                  setEditableLocation({ ...editableLocation, [client.id]: e.target.value })
                }
                disabled={isSaving}
                sx={{ width: 140 }}
                inputProps={{ style: { fontSize: 13 } }}
              />
              <Button
                size="small"
                variant="contained"
                color="primary"
                onClick={() => onSaveLocality(client.id)}
                disabled={isSaving}
                sx={{ ml: 1, minWidth: 60, fontSize: 12 }}
              >
                {isSaving ? <CircularProgress size={16} /> : "Gem"}
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} mt={1}>
              <Chip
                label={client.ip_address}
                color="default"
                variant="outlined"
                size="small"
              />
              <Chip
                label={client.mac_address}
                color="default"
                variant="outlined"
                size="small"
              />
            </Stack>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Info">
            <IconButton component={Link} to={`/clients/${client.id}`} color="primary">
              <InfoIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Fjern klient">
            <IconButton
              color="error"
              onClick={() => onRemove(client.id)}
              sx={{ ml: 1 }}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
    </Paper>
  );
}

function PendingClientRow({ client, onApprove }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        mb: 2,
        p: 2,
        borderRadius: 2,
        bgcolor: "background.paper",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        spacing={2}
      >
        <Box>
          <Typography variant="h6" fontWeight={600}>
            {client.name || "Ukendt navn"}
          </Typography>
          <Stack direction="row" spacing={1} mt={1}>
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
        </Box>
        <Button
          variant="contained"
          color="success"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => onApprove(client.id)}
          sx={{ minWidth: 120 }}
        >
          Tilføj klient
        </Button>
      </Stack>
    </Paper>
  );
}

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
    <Box sx={{ maxWidth: 700, mx: "auto", mt: 4 }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>
        Godkendte klienter
      </Typography>
      {loading ? (
        Array.from({ length: 2 }).map((_, i) => (
          <Paper variant="outlined" sx={{ mb: 2, p: 2, borderRadius: 2 }} key={i}>
            <Skeleton variant="rectangular" height={48} />
          </Paper>
        ))
      ) : approvedClients.length === 0 ? (
        <Paper sx={{ p: 2, mb: 4 }}>
          <Typography variant="body1" color="text.secondary">
            Ingen godkendte klienter.
          </Typography>
        </Paper>
      ) : (
        approvedClients.map((client) => (
          <ClientRow
            key={client.id}
            client={client}
            onRemove={onRemoveClient}
            onSaveLocality={handleLocationSave}
            isSaving={!!savingLocation[client.id]}
            editableLocation={editableLocations}
            setEditableLocation={setEditableLocations}
          />
        ))
      )}

      <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>
        Ikke godkendte klienter
      </Typography>
      {loading ? (
        Array.from({ length: 1 }).map((_, i) => (
          <Paper variant="outlined" sx={{ mb: 2, p: 2, borderRadius: 2 }} key={i}>
            <Skeleton variant="rectangular" height={40} />
          </Paper>
        ))
      ) : unapprovedClients.length === 0 ? (
        <Paper sx={{ p: 2 }}>
          <Typography variant="body1" color="text.secondary">
            Ingen ikke-godkendte klienter.
          </Typography>
        </Paper>
      ) : (
        unapprovedClients.map((client) => (
          <PendingClientRow
            key={client.id}
            client={client}
            onApprove={onApproveClient}
          />
        ))
      )}
    </Box>
  );
}
