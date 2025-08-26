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
    <TableContainer sx={{ maxHeight: 340, overflowY: "auto", mt: 2 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 500 }}>Dato</TableCell>
            <TableCell sx={{ fontWeight: 500 }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 500 }}>Tænd</TableCell>
            <TableCell sx={{ fontWeight: 500 }}>Sluk</TableCell>
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

function addMonths(date, num) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + num);
  return d;
}

export default function ClientCalendarDialog({ open, onClose, clientId }) {
  const [season, setSeason] = useState(null);
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(() => addMonths(new Date(), 1));
  const [markedDays, setMarkedDays] = useState({});
  const [loading, setLoading] = useState(false);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    if (open) {
      (async () => {
        const s = await getCurrentSeason();
        setSeason(s);
        // Sæt start/slutdato til dags dato og +1 måned, klip til sæson-grænser hvis nødvendigt
        const today = new Date();
        let start = today;
        let end = addMonths(today, 1);
        if (s) {
          const seasonStart = new Date(s.start_date);
          const seasonEnd = new Date(s.end_date);
          if (start < seasonStart) start = seasonStart;
          if (start > seasonEnd) start = seasonEnd;
          if (end < seasonStart) end = seasonStart;
          if (end > seasonEnd) end = seasonEnd;
        }
        setStartDate(start);
        setEndDate(end);
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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 2, pt: 1, fontWeight: 500 }}>
        Vis kalender for periode
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <LocalizationProvider dateAdapter={AdapterDateFns} locale={daLocale}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={3}
            alignItems="center"   // Centrerer alle elementer vertikalt
            justifyContent="center"
            sx={{ mb: 2, mt: 1 }}
          >
            <DatePicker
              label={<span style={{ fontWeight: 500 }}>Startdato</span>}
              value={startDate}
              onChange={setStartDate}
              minDate={season ? new Date(season.start_date) : undefined}
              maxDate={season ? new Date(season.end_date) : undefined}
              format="dd/MM/yyyy"
              slotProps={{
                textField: {
                  variant: "outlined",
                  fullWidth: true,
                  size: "medium",
                  sx: { minWidth: 180 },
                  error: !startDate,
                  helperText: !startDate ? "Vælg startdato" : "",
                },
              }}
            />
            <DatePicker
              label={<span style={{ fontWeight: 500 }}>Slutdato</span>}
              value={endDate}
              onChange={setEndDate}
              minDate={season ? new Date(season.start_date) : undefined}
              maxDate={season ? new Date(season.end_date) : undefined}
              format="dd/MM/yyyy"
              slotProps={{
                textField: {
                  variant: "outlined",
                  fullWidth: true,
                  size: "medium",
                  sx: { minWidth: 180 },
                  error: !endDate,
                  helperText: !endDate ? "Vælg slutdato" : "",
                },
              }}
            />
            <Button
              variant="contained"
              sx={{
                minWidth: 120,
                height: 40,
                fontWeight: 500,
                fontSize: "0.95rem",
                borderRadius: 2,
                boxShadow: 1,
                whiteSpace: "nowrap",
                px: 2,
                alignSelf: "center"
              }}
              onClick={handleFetch}
              disabled={loading || !startDate || !endDate}
            >
              Vis kalender
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
          <ClientPowerPeriodTable
            markedDays={markedDays}
            days={getDaysInRange(startDate, endDate)}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: "center" }}>
        <Button onClick={onClose} color="primary">
          Luk
        </Button>
      </DialogActions>
    </Dialog>
  );
}
