import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box,
  CircularProgress, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Stack, Alert,
} from "@mui/material";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import daLocale from "date-fns/locale/da";
import { getMarkedDays, getCurrentSeason } from "../../api";

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatDateKey(dt) {
  if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return "";
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

function formatDateLong(dt) {
  if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return "Ukendt dato";
  const weekdays = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"];
  return `${weekdays[dt.getDay()]} ${pad2(dt.getDate())}.${pad2(dt.getMonth() + 1)} ${dt.getFullYear()}`;
}

function normalizeDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const d = new Date(value);
    d.setHours(12, 0, 0, 0);
    return d;
  }

  const str = String(value).trim();
  if (!str) return null;

  // YYYY-MM-DD skal tolkes som lokal dato, ikke UTC-midnat.
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  }

  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(12, 0, 0, 0);
  return d;
}

function getSeasonValue(season) {
  return season?.id ?? season?.season ?? season;
}

/**
 * Slår dato op med:
 *   1. YYYY-MM-DDT00:00:00
 *   2. YYYY-MM-DD
 *   3. Prefix-match
 */
function getStatusAndTimesFromRaw(markedDays = {}, dt) {
  const dateKeyShort = formatDateKey(dt);
  if (!dateKeyShort || !markedDays || typeof markedDays !== "object") {
    return { status: "off", powerOn: "", powerOff: "" };
  }

  const dateKeyFull = `${dateKeyShort}T00:00:00`;
  const data = markedDays[dateKeyFull]
    || markedDays[dateKeyShort]
    || Object.entries(markedDays).find(([k]) => String(k).startsWith(dateKeyShort))?.[1];

  const status = String(data?.status || "").toLowerCase();
  if (!data || !status || status === "off") {
    return { status: "off", powerOn: "", powerOff: "" };
  }

  return {
    status: "on",
    powerOn: data.onTime || data.powerOn || data.power_on || "",
    powerOff: data.offTime || data.powerOff || data.power_off || "",
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
  const startD = normalizeDateOnly(start);
  const endD = normalizeDateOnly(end);
  if (!startD || !endD || startD > endD) return [];

  const days = [];
  const d = new Date(startD);

  while (d <= endD) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }

  return days;
}

function addMonths(date, num) {
  const d = normalizeDateOnly(date) || new Date();
  d.setMonth(d.getMonth() + num);
  return d;
}

function clampDate(date, minDate, maxDate) {
  const d = normalizeDateOnly(date);
  if (!d) return null;
  const min = normalizeDateOnly(minDate);
  const max = normalizeDateOnly(maxDate);

  if (min && d < min) return min;
  if (max && d > max) return max;
  return d;
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
            const key = formatDateKey(dt);
            return (
              <TableRow key={key}>
                <TableCell>{formatDateLong(dt)}</TableCell>
                <TableCell><StatusText status={status} /></TableCell>
                <TableCell>{status === "on" ? powerOn : ""}</TableCell>
                <TableCell>{status === "on" ? powerOff : ""}</TableCell>
              </TableRow>
            );
          })}

          {days.length === 0 && (
            <TableRow>
              <TableCell colSpan={4}>
                <Typography variant="body2" color="text.secondary">
                  Ingen datoer i den valgte periode.
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function ClientCalendarDialog({ open, onClose, clientId }) {
  const [season, setSeason] = useState(null);
  const [startDate, setStartDate] = useState(() => normalizeDateOnly(new Date()));
  const [endDate, setEndDate] = useState(() => addMonths(new Date(), 1));
  const [markedDays, setMarkedDays] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingSeason, setLoadingSeason] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;

    async function loadSeason() {
      setLoadingSeason(true);
      setError("");

      try {
        const s = await getCurrentSeason();
        if (cancelled) return;

        setSeason(s);

        const today = normalizeDateOnly(new Date());
        const seasonStart = normalizeDateOnly(s?.start_date);
        const seasonEnd = normalizeDateOnly(s?.end_date);

        const start = clampDate(today, seasonStart, seasonEnd) || today;
        const end = clampDate(addMonths(start, 1), seasonStart, seasonEnd) || addMonths(start, 1);

        setStartDate(start);
        setEndDate(end);
        setMarkedDays({});
        setShowTable(false);
      } catch (err) {
        if (cancelled) return;

        setSeason(null);
        setStartDate(normalizeDateOnly(new Date()));
        setEndDate(addMonths(new Date(), 1));
        setMarkedDays({});
        setShowTable(false);
        setError(err?.message || "Kunne ikke hente aktuel sæson.");
      } finally {
        if (!cancelled) setLoadingSeason(false);
      }
    }

    loadSeason();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const seasonStartDate = useMemo(
    () => normalizeDateOnly(season?.start_date) || undefined,
    [season?.start_date]
  );

  const seasonEndDate = useMemo(
    () => normalizeDateOnly(season?.end_date) || undefined,
    [season?.end_date]
  );

  const selectedDays = useMemo(
    () => getDaysInRange(startDate, endDate),
    [startDate, endDate]
  );

  const dateRangeInvalid = !startDate || !endDate || startDate > endDate;
  const seasonValue = getSeasonValue(season);

  const handleFetch = async () => {
    if (!startDate || !endDate || !clientId || !seasonValue || dateRangeInvalid) return;

    setLoading(true);
    setError("");

    try {
      const startStr = formatDateKey(startDate);
      const endStr = formatDateKey(endDate);
      const res = await getMarkedDays(seasonValue, clientId, startStr, endStr);
      setMarkedDays(res?.markedDays || res?.marked_days || {});
      setShowTable(true);
    } catch (err) {
      setMarkedDays({});
      setShowTable(true);
      setError(err?.message || "Kunne ikke hente kalender for perioden.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 3, pt: 2, fontWeight: 500 }}>
        Vis kalender for periode
      </DialogTitle>

      <DialogContent sx={{ pt: 2, px: 4 }}>
        {error && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={daLocale}>
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
              onChange={(value) => {
                const next = normalizeDateOnly(value);
                setStartDate(next);
                setShowTable(false);

                if (next && endDate && next > endDate) {
                  setEndDate(next);
                }
              }}
              minDate={seasonStartDate}
              maxDate={seasonEndDate}
              format="dd/MM/yyyy"
              slotProps={{
                textField: {
                  variant: "outlined",
                  fullWidth: true,
                  size: "medium",
                  sx: { minWidth: 170 },
                  error: !startDate,
                  helperText: !startDate ? "Vælg startdato" : "",
                },
              }}
            />

            <DatePicker
              label={<span style={{ fontWeight: 500 }}>Slutdato</span>}
              value={endDate}
              onChange={(value) => {
                setEndDate(normalizeDateOnly(value));
                setShowTable(false);
              }}
              minDate={startDate || seasonStartDate}
              maxDate={seasonEndDate}
              format="dd/MM/yyyy"
              slotProps={{
                textField: {
                  variant: "outlined",
                  fullWidth: true,
                  size: "medium",
                  sx: { minWidth: 170 },
                  error: !endDate || dateRangeInvalid,
                  helperText: !endDate
                    ? "Vælg slutdato"
                    : dateRangeInvalid
                      ? "Slutdato skal være efter startdato"
                      : "",
                },
              }}
            />

            <Button
              variant="contained"
              color="primary"
              size="large"
              sx={{ minWidth: 165, whiteSpace: "nowrap" }}
              onClick={handleFetch}
              disabled={loading || loadingSeason || !startDate || !endDate || !seasonValue || dateRangeInvalid}
            >
              {loading ? <CircularProgress size={20} color="inherit" /> : "Vis kalender"}
            </Button>
          </Stack>
        </LocalizationProvider>

        {loadingSeason && (
          <Box sx={{ textAlign: "center", py: 2 }}>
            <CircularProgress size={24} />
            <Typography sx={{ mt: 1 }}>Henter aktuel sæson...</Typography>
          </Box>
        )}

        {loading && (
          <Box sx={{ textAlign: "center", py: 2 }}>
            <CircularProgress size={28} />
            <Typography sx={{ mt: 1 }}>Indlæser kalender...</Typography>
          </Box>
        )}

        {showTable && !loading && (
          <ClientPowerPeriodTable
            markedDays={markedDays}
            days={selectedDays}
          />
        )}
      </DialogContent>

      <DialogActions sx={{ justifyContent: "center", pb: 2, pt: 1 }}>
        <Button onClick={onClose} color="primary">Luk</Button>
      </DialogActions>
    </Dialog>
  );
}
