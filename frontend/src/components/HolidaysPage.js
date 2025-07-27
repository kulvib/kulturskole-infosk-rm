import React, { useEffect, useState } from "react";
import { Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress, TextField, Button, Box, Alert } from "@mui/material";
import { api } from "../api/api";
import { useAuth } from "../auth/AuthContext";

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const { token } = useAuth();

  const fetchHolidays = async () => {
    try {
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      const res = await api.get("/holidays/");
      setHolidays(res.data);
    } catch {
      setHolidays([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
    // eslint-disable-next-line
  }, [token]);

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    setError("");
    if (!date || !description) {
      setError("Alle felter skal udfyldes.");
      return;
    }
    try {
      await api.post("/holidays/", { date, description });
      setDate("");
      setDescription("");
      fetchHolidays();
    } catch (err) {
      setError("Kunne ikke tilføje helligdag. Tjek datoformat (YYYY-MM-DD).");
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>Helligdage</Typography>
      <Box component="form" onSubmit={handleAddHoliday} sx={{ mb: 2, display: "flex", gap: 2, alignItems: "center" }}>
        <TextField label="Dato (YYYY-MM-DD)" value={date} onChange={e => setDate(e.target.value)} />
        <TextField label="Beskrivelse" value={description} onChange={e => setDescription(e.target.value)} />
        <Button type="submit" variant="contained">Tilføj</Button>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? (
        <CircularProgress />
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Dato</TableCell>
                <TableCell>Beskrivelse</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {holidays.map(h => (
                <TableRow key={h.id}>
                  <TableCell>{h.id}</TableCell>
                  <TableCell>{h.date}</TableCell>
                  <TableCell>{h.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}
