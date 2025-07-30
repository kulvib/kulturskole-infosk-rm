import React from "react";
import {
  Typography, Table, TableHead, TableBody, TableRow, TableCell,
  IconButton, CircularProgress, TextField, Button, Stack, Paper
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

export default function HolidaysPage({
  holidays, holidayDate, setHolidayDate, holidayDesc, setHolidayDesc,
  loading, handleAddHoliday, handleDeleteHoliday
}) {
  return (
    <Paper sx={{ p: 3, maxWidth: 700, mx: "auto", mt: 2, boxShadow: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: "bold", mb: 2 }}>
        Helligdage
      </Typography>
      <form onSubmit={handleAddHoliday}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mb={2}>
          <TextField
            type="date"
            label="Dato"
            value={holidayDate}
            onChange={e => setHolidayDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            required
            size="small"
          />
          <TextField
            label="Beskrivelse"
            value={holidayDesc}
            onChange={e => setHolidayDesc(e.target.value)}
            required
            size="small"
          />
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={loading}
            sx={{ minWidth: 120 }}
          >
            Tilføj helligdag
          </Button>
        </Stack>
      </form>
      {loading ? (
        <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 150 }}>
          <CircularProgress />
        </Stack>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Dato</TableCell>
              <TableCell>Beskrivelse</TableCell>
              <TableCell>Handling</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {holidays.map((h) => (
              <TableRow key={h.id || h.date}>
                <TableCell>{h.date}</TableCell>
                <TableCell>{h.description}</TableCell>
                <TableCell>
                  <IconButton
                    onClick={() => handleDeleteHoliday(h.id)}
                    title="Slet helligdag"
                  >
                    <DeleteIcon color="error" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {holidays.length === 0 && (
              <TableRow>
                <TableCell colSpan={3}>
                  <Typography color="text.secondary" align="center">
                    Ingen helligdage registreret
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
