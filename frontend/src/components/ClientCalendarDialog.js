import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  CircularProgress,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  TextField,
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { DatePicker } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import daLocale from "date-fns/locale/da";
import { getMarkedDays, getCurrentSeason } from "../api";

// Datoformat: DD/MM/YYYY
function formatDateShort(dt) {
  return `${dt.getDate().toString().padStart(2, "0")}/${(dt.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${dt.getFullYear()}`;
}

function getStatusAndTimesFromRaw(markedDays, dt) {
  const dateKey = `${dt.getFullYear()}-${(dt.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${dt.getDate().toString().padStart(2, "0")}T00:00:00`;
  const data = markedDays[dateKey];
  if (!data || !data.status || data.status === "off") {
    return { status: "off", powerOn: "", powerOff: "" };
  }
  return {
    status: "on",
    powerOn: data.onTime || "",
    powerOff: data.offTime || "",
  };
}

function StatusText({ status }) {
  return (
    <Typography
      variant="body2"
      sx={{
        fontWeight: 600,
        color: status === "on" ? "#43a047" : "#e53935",
        textTransform: "lowercase",
      }}
    >
      {status}
    </Typography>
  );
}

function getDaysInRange(start, end) {
  const days = [];
  let d = new Date(start);
  while (d <= end) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function ClientPowerPeriodTable({ markedDays, days }) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Dato</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Tænd</TableCell>
            <TableCell>Sluk</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {days.map((dt) => {
            const { status, powerOn, powerOff } = getStatusAndTimesFromRaw(
              markedDays,
              dt
            );
            return (
              <TableRow key={dt.toISOString().slice(0, 10)}>
                <TableCell>{formatDateShort(dt)}</TableCell>
                <TableCell>
                  <StatusText status={status} />
                </TableCell>
                <TableCell>{powerOn}</TableCell>
                <TableCell>{powerOff}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function ClientCalendarDialog({ open, onClose, clientId }) {
  const [season, setSeason] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [markedDays, setMarkedDays] = useState({});
  const [loading, setLoading] = useState(false);
  const [showTable, setShowTable] = useState(false);

  // Hjælpefunktion: Tjek om dato er gyldig
  const isDateInvalid = (date, season) => {
    if (!date || !season) return true;
    const d = new Date(date);
    const start = new Date(season.start_date);
    const end = new Date(season.end_date);
    return d < start || d > end;
  };

  useEffect(() => {
    if (open) {
      (async () => {
        const s = await getCurrentSeason();
        setSeason(s);
        // Sæt start/slutdato automatisk ud fra sæson
        setStartDate(s ? new Date(s.start_date) : null);
        setEndDate(s ? new Date(s.end_date) : null);
        setMarkedDays({});
        setShowTable(false);
      })();
    }
  }, [open]);

  const handleFetch = async () => {
    if (!startDate || !endDate || !clientId) return;
    setLoading(true);
    try {
      const res = await getMarkedDays(season.id, clientId, startDate, endDate);
      setMarkedDays(res?.markedDays || {});
      setShowTable(true);
    } catch {
      setMarkedDays({});
      setShowTable(true);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Vis kalender for periode</DialogTitle>
      <DialogContent>
        <LocalizationProvider dateAdapter={AdapterDateFns} locale={daLocale}>
          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            sx={{ mb: 2 }}
          >
            <DatePicker
              label="Startdato"
              value={startDate}
              onChange={setStartDate}
              minDate={season ? new Date(season.start_date) : undefined}
              maxDate={season ? new Date(season.end_date) : undefined}
              format="dd/MM/yyyy"
              renderInput={(params) => (
                <TextField
                  {...params}
                  variant="outlined"
                  fullWidth
                  size="small"
                  sx={{ width: 200 }}
                  error={isDateInvalid(startDate, season)}
                  helperText={
                    isDateInvalid(startDate, season)
                      ? "Vælg gyldig startdato"
                      : ""
                  }
                />
              )}
            />
            <DatePicker
              label="Slutdato"
              value={endDate}
              onChange={setEndDate}
              minDate={season ? new Date(season.start_date) : undefined}
              maxDate={season ? new Date(season.end_date) : undefined}
              format="dd/MM/yyyy"
              renderInput={(params) => (
                <TextField
                  {...params}
                  variant="outlined"
                  fullWidth
                  size="small"
                  sx={{ width: 200 }}
                  error={isDateInvalid(endDate, season)}
                  helperText={
                    isDateInvalid(endDate, season)
                      ? "Vælg gyldig slutdato"
                      : ""
                  }
                />
              )}
            />
            <Button
              variant="contained"
              onClick={handleFetch}
              disabled={
                loading ||
                !startDate ||
                !endDate ||
                isDateInvalid(startDate, season) ||
                isDateInvalid(endDate, season)
              }
            >
              Hent kalender
            </Button>
          </Stack>
        </LocalizationProvider>
        {loading && (
          <Box sx={{ textAlign: "center", py: 2 }}>
            <CircularProgress size={28} />
            <Typography sx={{ mt: 1 }}>Indlæser kalender...</Typography>
          </Box>
        )}
        {showTable && !loading && (
          <Box sx={{ mt: 2 }}>
            <ClientPowerPeriodTable
              markedDays={markedDays}
              days={getDaysInRange(startDate, endDate)}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Luk
        </Button>
      </DialogActions>
    </Dialog>
  );
}
