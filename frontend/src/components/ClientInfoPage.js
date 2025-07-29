import React, { useEffect } from "react";
import {
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Button,
  Paper,
  Stack,
  CircularProgress,
  TextField,
  Tooltip,
  IconButton,
  Chip,
} from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";
import DeleteIcon from "@mui/icons-material/Delete";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useNavigate } from "react-router-dom";

// Status-chip: grøn/rød prik og tekst
function StatusChip({ isOnline }) {
  return (
    <Chip
      icon={
        <FiberManualRecordIcon
          sx={{
            color: isOnline ? "#33cc33" : "#cc3333",
            fontSize: 18,
            ml: "3px",
          }}
        />
      }
      label={isOnline ? "Online" : "Offline"}
      sx={{
        fontWeight: "bold",
        bgcolor: isOnline ? "#e5fbe5" : "#fbe5e5",
        color: isOnline ? "#388e3c" : "#d32f2f",
        px: 2,
      }}
    />
  );
}

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

  // Godkendte og ikke-godkendte klienter
  const approvedClients = clients.filter(
    (c) => c.apiStatus === "approved" || c.status === "approved"
  );
  const pendingClients = clients.filter(
    (c) => c.apiStatus === "pending" || c.status === "pending"
  );

  // Polling: Automatisk opdatering hvert 30. sekund
  useEffect(() => {
    const interval = setInterval(() => {
      fetchClients();
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line
  }, []);

  // Lokalitet redigering
  const handleLocalityChange = async (id, value) => {
    await fetch(`/api/clients/${id}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locality: value }),
    });
    setClients &&
      setClients((prev) =>
        prev.map((c) => (c.id === id ? { ...c, locality: value } : c))
      );
  };

  return (
    <Stack spacing={4}>
      {/* Refresh/Opdater knap */}
      <Stack direction="row" alignItems="center" spacing={2}>
        <Button
          variant="outlined"
          onClick={fetchClients}
          startIcon={<RefreshIcon />}
          disabled={loading}
        >
          Opdater
        </Button>
        {loading && <span>Henter data…</span>}
      </Stack>

      {/* Godkendte klienter (Ligger nu øverst) */}
      <Paper sx={{ p: 3, boxShadow: 3, bgcolor: "#fff" }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold" }}>
          Godkendte klienter
        </Typography>
        <Table>
          <TableHead>
            <TableRow sx={{ background: "#f0f5f9" }}>
              <TableCell sx={{ fontWeight: "bold" }}>Klientnavn</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Lokalitet</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Status</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Info</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Fjern</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Stack alignItems="center" sx={{ py: 2 }}>
                    <CircularProgress size={28} />
                  </Stack>
                </TableCell>
              </TableRow>
            ) : approvedClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>Ingen godkendte klienter.</TableCell>
              </TableRow>
            ) : (
              approvedClients.map((client) => {
                // Bestem om klienten er online (baseret på status eller heartbeat)
                const isOnline =
                  client.isOnline !== undefined
                    ? client.isOnline
                    : client.status === "online" ||
                      client.heartbeat === "online" ||
                      client.heartbeat === true;

                return (
                  <TableRow
                    key={client.id}
                    sx={{
                      transition: "background 0.3s",
                      ":hover": { background: "#f5f7fa" },
                    }}
                  >
                    <TableCell>{client.name || client.unique_id}</TableCell>
                    <TableCell>
                      <TextField
                        value={client.locality || ""}
                        onChange={(e) =>
                          handleLocalityChange(client.id, e.target.value)
                        }
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <StatusChip isOnline={isOnline} />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Info">
                        <IconButton
                          color="primary"
                          onClick={() =>
                            navProp
                              ? navProp(`/clients/${client.id}`)
                              : navigate(`/clients/${client.id}`)
                          }
                        >
                          <InfoIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      {(client.apiStatus === "approved" ||
                        client.status === "approved") && (
                        <IconButton
                          color="error"
                          onClick={() => onRemoveClient(client.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Ikke godkendte klienter (ligger nu nederst) */}
      <Paper sx={{ p: 3, boxShadow: 3, bgcolor: "#fff" }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold" }}>
          Ikke godkendte klienter
        </Typography>
        <Table>
          <TableHead>
            <TableRow sx={{ background: "#f0f5f9" }}>
              <TableCell sx={{ fontWeight: "bold" }}>Klientnavn</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>IP adresse</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>MAC adresse</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Godkend klient</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <Stack alignItems="center" sx={{ py: 2 }}>
                    <CircularProgress size={28} />
                  </Stack>
                </TableCell>
              </TableRow>
            ) : pendingClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  Ingen ikke-godkendte klienter.
                </TableCell>
              </TableRow>
            ) : (
              pendingClients.map((client) => (
                <TableRow
                  key={client.id}
                  sx={{
                    transition: "background 0.3s",
                    ":hover": { background: "#f5f7fa" },
                  }}
                >
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
              ))
            )}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
