import React, { useEffect, useState } from "react";
import { Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress } from "@mui/material";
import { api } from "../api/api";
import { useAuth } from "../auth/AuthContext";

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();

  useEffect(() => {
    async function fetchClients() {
      try {
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        const res = await api.get("/clients/");
        setClients(res.data);
      } catch (err) {
        setClients([]);
      } finally {
        setLoading(false);
      }
    }
    fetchClients();
  }, [token]);

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>Klienter</Typography>
      {loading ? (
        <CircularProgress />
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Unique ID</TableCell>
                <TableCell>SW Version</TableCell>
                <TableCell>MAC</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {clients.map(client => (
                <TableRow key={client.id}>
                  <TableCell>{client.id}</TableCell>
                  <TableCell>{client.unique_id}</TableCell>
                  <TableCell>{client.sw_version}</TableCell>
                  <TableCell>{client.mac}</TableCell>
                  <TableCell>{client.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}
