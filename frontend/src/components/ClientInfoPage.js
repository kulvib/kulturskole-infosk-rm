import React from "react";
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

  // Split klienter
  const approvedClients = clients.filter(
    (c) => c.apiStatus === "approved" || c.status === "approved"
  );
  const pendingClients = clients.filter(
    (c) => c.apiStatus === "pending" || c.status === "pending"
  );

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
      <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold" }}>Godkendte klienter</Typography>
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
              <TableCell sx={{ fontWeight: "bold" }}>Fjern</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {approvedClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>Ingen godkendte klienter.</TableCell>
              </TableRow>
            ) : (
              approvedClients.map(client => (
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
                    <IconButton
                      color="error"
                      onClick={() => onRemoveClient(client.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {/* Ikke godkendte klienter */}
      <Paper sx={{ mt: 4, p: 2, boxShadow: 1, bgcolor: "#fff" }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold" }}>
          Ikke godkendte klienter
        </Typography>
        {pendingClients.length === 0 ? (
          <Typography>Ingen ikke-godkendte klienter.</Typography>
        ) : (
          <Table>
            <TableHead>
              <TableRow sx={{ background: "#f0f5f9" }}>
                <TableCell sx={{ fontWeight: "bold" }}>Navn</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>IP</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>MAC adresse</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Godkend</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pendingClients.map((client) => (
                <TableRow key={client.id} sx={{ ":hover": { background: "#f8f9fb" } }}>
                  <TableCell>{client.name || client.unique_id}</TableCell>
                  <TableCell>{client.ip || client.ip_address}</TableCell>
                  <TableCell>{client.macAddress || client.mac_address}</TableCell>
                  <TableCell>
                    <Button
                      variant="contained"
                      color="success"
                      onClick={() => onApproveClient(client.id)}
                      disabled={loading}
                    >
                      Godkend
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Paper>
  );
}
