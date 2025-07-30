import React from "react";
import {
  Typography, Table, TableHead, TableBody, TableRow, TableCell,
  IconButton, CircularProgress, Button, Stack, Paper, Chip
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import DeleteIcon from "@mui/icons-material/Delete";
import InfoIcon from "@mui/icons-material/Info";
import { useNavigate } from "react-router-dom";

export default function ClientInfoPage({
  clients, loading, onApproveClient, onRemoveClient, fetchClients
}) {
  const navigate = useNavigate();

  return (
    <Paper sx={{ p: 3, maxWidth: 1000, mx: "auto", mt: 2, boxShadow: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" sx={{ fontWeight: "bold" }}>
          Klienter
        </Typography>
        <Button onClick={fetchClients} disabled={loading} variant="outlined">
          Opdater liste
        </Button>
      </Stack>
      {loading ? (
        <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 200 }}>
          <CircularProgress />
        </Stack>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Navn</TableCell>
              <TableCell>Lokalitet</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Godkendt</TableCell>
              <TableCell>Online</TableCell>
              <TableCell>Handlinger</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id || client.unique_id}>
                <TableCell>
                  {client.name || client.unique_id}
                </TableCell>
                <TableCell>{client.locality}</TableCell>
                <TableCell>
                  <Chip
                    label={client.isOnline ? "Online" : "Offline"}
                    color={client.isOnline ? "success" : "error"}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={client.status === "approved" ? "Godkendt" : "Afventer"}
                    color={client.status === "approved" ? "success" : "warning"}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={client.isOnline ? "Ja" : "Nej"}
                    color={client.isOnline ? "success" : "default"}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <IconButton
                    onClick={() => onApproveClient(client.id)}
                    disabled={client.status === "approved"}
                    title="Godkend klient"
                  >
                    <CheckIcon color={client.status === "approved" ? "disabled" : "success"} />
                  </IconButton>
                  <IconButton
                    onClick={() => onRemoveClient(client.id)}
                    title="Fjern klient"
                  >
                    <DeleteIcon color="error" />
                  </IconButton>
                  <IconButton
                    onClick={() => navigate(`/clients/${client.id}`)}
                    title="Detaljer"
                  >
                    <InfoIcon color="primary" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography color="text.secondary" align="center">
                    Ingen klienter fundet
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </Paper>
  );
}
