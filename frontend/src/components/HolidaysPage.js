import React from "react";
import {
  Typography, Table, TableBody, TableCell, TableHead, TableRow,
  Button, TextField, Paper, Stack, CircularProgress
} from "@mui/material";

export default function HolidaysPage({
  holidays,
  holidayDate,
  setHolidayDate,
  holidayDesc,
  setHolidayDesc,
  loading,
  handleAddHoliday,
  handleDeleteHoliday
}) {
  return (
    <Paper sx={{ p: 3, boxShadow: 3 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold" }}>Fridage / Helligdage</Typography>
      <form onSubmit={handleAddHoliday}>
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TextField
            type="date"
            value={holidayDate}
            onChange={e => setHolidayDate(e.target.value)}
            required
            label="Dato"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            placeholder="Beskrivelse"
            value={holidayDesc}
            onChange={e => setHolidayDesc(e.target.value)}
            required
            label="Beskrivelse"
          />
          <Button type="submit" variant="contained" disabled={loading}>
            Tilføj fridag
          </Button>
        </Stack>
      </form>
      {loading ? (
        <Stack alignItems="center" sx={{ py: 4 }}>
          <CircularProgress />
        </Stack>
      ) : (
        <Table>
          <TableHead>
            <TableRow sx={{ background: "#f0f5f9" }}>
              <TableCell sx={{ fontWeight: "bold" }}>Dato</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Beskrivelse</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Slet</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {holidays.map(h => (
              <TableRow key={h.id}>
                <TableCell>{h.date ? h.date.slice(0, 10) : ""}</TableCell>
                <TableCell>{h.description}</TableCell>
                <TableCell>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => handleDeleteHoliday(h.id)}
                    disabled={loading}
                  >
                    Slet
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Paper>
  );
}
