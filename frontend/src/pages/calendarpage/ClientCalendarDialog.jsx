import React, { useState, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box,
  CircularProgress, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Stack,
} from "@mui/material";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import daLocale from "date-fns/locale/da";
import { getMarkedDays, getCurrentSeason } from "../../api";

function formatDateLong(dt) {
  const weekdays = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"];
  const day = dt.getDate().toString().padStart(2, "0");
  const month = (dt.getMonth() + 1).toString().padStart(2, "0");
  return `${weekdays[dt.getDay()]} ${day}.${month} ${dt.getFullYear()}`;
}

// FIX: Slår dato op med både YYYY-MM-DDT00:00:00 og YYYY-MM-DD format.
// Backend returnerer YYYY-MM-DDT00:00:00 nøgler; fallback til kortformat sikrer robusthed.
function getStatusAndTimesFromRaw(markedDays, dt) {
  const yyyy = dt.getFullYear();
  const mm = (dt.getMonth() + 1).toString().padStart(2, "0");
  const dd = dt.getDate().toString().padStart(2, "0");
  const dateKeyFull = `${yyyy}-${mm}-${dd}T00:00:00`;
  const dateKeyShort = `${yyyy}-${mm}-${dd}`;

  const data = markedDays[dateKeyFull]
    || markedDays[dateKeyShort]
    || Object.entries(markedDays).find(([k]) => k.startsWith(dateKeyShort))?.[1];

  if (!data || !data.status || data.status === "off") {
    return { status: "off", powerOn: "", powerOff: "" };
  }
  return { status: "on", powerOn: data.onTime || "", powerOff: data.offTime || "" };
}

function StatusText({ status }) {
  return (
    <Typography variant="body2" sx={{
      fontWeight: 600,
      color: status === "on" ? "#43a047" : "#e53935",
      textTransform: "lowercase",
    }}>
      {status}
    </Typography>
  );
}

function getDaysInRange(start, end) {
  const days = [];
  let d = new Date(start);
  d.setHours(0, 0, 0, 0);
  const endD = new Date(end);
  endD.setHours(0, 0, 0, 0);
  while (d <= endD) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function addMonths(date, num) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + num);
  return d;
}

// FIX: Formatér Date-objekt til YYYY-MM-DD string til API-kald
function formatDateToString(d) {
  if (!d) return undefined;
  const yyyy = d.getFullYear();
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function ClientPowerPeriodTable({ markedDays, days }) {
  return (
    <TableContainer sx={{ maxHeight: 340, overflowY: "auto", mt: 3 }}>
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
            const { status, powerOn, powerOff } = getStatusAndTimesFromRaw(markedDays, dt);
            return (
              <TableRow key={dt.toISOString().slice(0, 10)}>
                <TableCell>{formatDateLong(dt)}</TableCell>
                <TableCell><StatusText status={status} /></TableCell>
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
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(() => addMonths(new Date(), 1));
  const [markedDays, setMarkedDays] = useState({});
  const [loading, setLoading] = useState(false);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const s = await getCurrentSeason();
        setSeason(s);

        const today = new Date();
        let start = new Date(today);
        let end = addMonths(today, 1);

        // FIX: Klip start/slut til sæson-grænser hvis tilgængelige
        if (s?.start_date && s?.end_date) {
          const seasonStart = new Date(s.start_date);
          const seasonEnd = new Date(s.end_date);
          if (start < seasonStart) start = new Date(seasonStart);
          if (start > seasonEnd) start = new Date(seasonEnd);
          if (end < seasonStart) end = new Date(seasonStart);
          if (end > seasonEnd) end = new Date(seasonEnd);
        }

        setStartDate(start);
        setEndDate(end);
        setMarkedDays({});
        setShowTable(false);
      } catch {
        // Fallback uden sæson-begrænsning
        setStartDate(new Date());
        setEndDate(addMonths(new Date(), 1));
        setMarkedDays({});
        setShowTable(false);
      }
    })();
  }, [open]);

  const handleFetch = async () => {
    if (!startDate || !endDate || !clientId || !season) return;
    setLoading(true);
    try {
      // FIX: Formatér Date-objekter til YYYY-MM-DD strings inden API-kald
      const startStr = formatDateToString(startDate);
      const endStr = formatDateToString(endDate);
      const res = await getMarkedDays(season.id, clientId, startStr, endStr);
      setMarkedDays(res?.markedDays || {});
      setShowTable(true);
    } catch {
      setMarkedDays({});
      setShowTable(true);
    }
    setLoading(false);
  };

  const seasonStartDate = season?.start_date ? new Date(season.start_date) : undefined;
  const seasonEndDate = season?.end_date ? new Date(season.end_date) : undefined;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 3, pt: 2, fontWeight: 500 }}>
        Vis kalender for periode
      </DialogTitle>
      <DialogContent sx={{ pt: 2, px: 4 }}>
        <LocalizationProvider dateAdapter={AdapterDateFns} locale={daLocale}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={4}
            alignItems="center"
            justifyContent="center"
            sx={{ mb: 4, mt: 2 }}
          >
            <DatePicker
              label={<span style={{ fontWeight: 500 }}>Startdato</span>}
              value={startDate}
              onChange={setStartDate}
              minDate={seasonStartDate}
              maxDate={seasonEndDate}
              format="dd/MM/yyyy"
              slotProps={{
                textField: {
                  variant: "outlined", fullWidth: true, size: "medium",
                  sx: { minWidth: 170 },
                  error: !startDate,
                  helperText: !startDate ? "Vælg startdato" : "",
                },
              }}
            />
            <DatePicker
              label={<span style={{ fontWeight: 500 }}>Slutdato</span>}
              value={endDate}
              onChange={setEndDate}
              minDate={startDate || seasonStartDate}
              maxDate={seasonEndDate}
              format="dd/MM/yyyy"
              slotProps={{
                textField: {
                  variant: "outlined", fullWidth: true, size: "medium",
                  sx: { minWidth: 170 },
                  error: !endDate,
                  helperText: !endDate ? "Vælg slutdato" : "",
                },
              }}
            />
            <Button
              variant="contained"
              color="primary"
              size="large"
              sx={{ minWidth: 165, whiteSpace: "nowrap" }}
              onClick={handleFetch}
              disabled={loading || !startDate || !endDate || !season}
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
      <DialogActions sx={{ justifyContent: "center", pb: 2, pt: 1 }}>
        <Button onClick={onClose} color="primary">Luk</Button>
      </DialogActions>
    </Dialog>
  );
}
