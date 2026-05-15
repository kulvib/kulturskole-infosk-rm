import React, { useState, useEffect } from "react";
import {
  Box, Typography, Paper, IconButton, Button, Tooltip, CircularProgress,
  Stack, Snackbar, Alert as MuiAlert, Select, MenuItem, Dialog, DialogTitle,
  DialogContent, DialogActions, FormControl, InputLabel, TextField, Grid,
  Card, CardContent, Chip,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import {
  getSchools, addSchool, getSchoolTimes, updateSchoolTimes,
  deleteSchool, updateSchoolName, getSchoolClients,
} from "../../api";
import { useAuth } from "../../auth/authcontext";

// Nuværende sæson + 2 fremtidige — season er string "2025/2026"
function getSeasons() {
  const now = new Date();
  const currentStart = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return [0, 1, 2].map(i => {
    const start = currentStart + i;
    return {
      value: `${start}/${start + 1}`,
      label: `${start}/${start + 1}`,
      isCurrent: i === 0,
    };
  });
}

const SEASONS = getSeasons();
const DEFAULT_SEASON = SEASONS[0].value;

export default function SchoolAdministration() {
  const { user } = useAuth();
  const isSuperadmin = user?.role === "superadmin";

  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState("");
  const [selectedSeason, setSelectedSeason] = useState(DEFAULT_SEASON);
  const [weekdayTimes, setWeekdayTimes] = useState({ onTime: "09:00", offTime: "22:30" });
  const [weekendTimes, setWeekendTimes] = useState({ onTime: "08:00", offTime: "18:00" });
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [loadingTimes, setLoadingTimes] = useState(false);

  const [schoolName, setSchoolName] = useState("");
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [schoolToDelete, setSchoolToDelete] = useState(null);
  const [clientsToDelete, setClientsToDelete] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);

  const [schoolSort, setSchoolSort] = useState({ direction: "asc" });
  const [schoolSearch, setSchoolSearch] = useState("");

  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const showSnackbar = (message, severity = "success") => setSnackbar({ open: true, message, severity });
  const handleCloseSnackbar = () => setSnackbar({ open: false, message: "", severity: "success" });

  const [editSchoolId, setEditSchoolId] = useState(null);
  const [editSchoolName, setEditSchoolName] = useState("");
  const [editSchoolError, setEditSchoolError] = useState("");

  useEffect(() => {
    setLoadingSchools(true);
    getSchools()
      .then(data => setSchools(Array.isArray(data) ? data : []))
      .catch(() => { setSchools([]); setError("Kunne ikke hente skoler"); })
      .finally(() => setLoadingSchools(false));
  }, []);

  // Admin ser kun sin egen skole
  useEffect(() => {
    if (!isSuperadmin && user?.school_id && schools.length > 0) {
      setSelectedSchool(user.school_id);
    }
  }, [isSuperadmin, user, schools]);

  // Hent sæsonbaserede tider når skole eller sæson ændres
  useEffect(() => {
    if (!selectedSchool || !selectedSeason) return;
    setLoadingTimes(true);
    getSchoolTimes(selectedSchool, selectedSeason)
      .then(data => {
        setWeekdayTimes({
          onTime: data.weekday?.onTime || "09:00",
          offTime: data.weekday?.offTime || "22:30",
        });
        setWeekendTimes({
          onTime: data.weekend?.onTime || "08:00",
          offTime: data.weekend?.offTime || "18:00",
        });
      })
      .catch(() => {
        setWeekdayTimes({ onTime: "09:00", offTime: "22:30" });
        setWeekendTimes({ onTime: "08:00", offTime: "18:00" });
      })
      .finally(() => setLoadingTimes(false));
  }, [selectedSchool, selectedSeason]);

  const handleAddSchool = () => {
    const name = schoolName.trim();
    setError("");
    if (!name) return;
    if (schools.some(s => s.name === name)) { setError("Skolen findes allerede!"); return; }
    addSchool(name)
      .then(data => {
        setSchools(prev => [...prev, data]);
        setSchoolName("");
        showSnackbar("Skole oprettet!", "success");
      })
      .catch(e => { setError(e.message || "Fejl ved oprettelse"); showSnackbar("Fejl ved oprettelse af skole", "error"); });
  };

  const handleSaveTimes = async () => {
    if (!selectedSchool || !selectedSeason) return;
    try {
      const updated = await updateSchoolTimes(selectedSchool, selectedSeason, {
        weekday_on: weekdayTimes.onTime,
        weekday_off: weekdayTimes.offTime,
        weekend_on: weekendTimes.onTime,
        weekend_off: weekendTimes.offTime,
      });
      setWeekdayTimes({
        onTime: updated.weekday?.onTime || weekdayTimes.onTime,
        offTime: updated.weekday?.offTime || weekdayTimes.offTime,
      });
      setWeekendTimes({
        onTime: updated.weekend?.onTime || weekendTimes.onTime,
        offTime: updated.weekend?.offTime || weekendTimes.offTime,
      });
      showSnackbar(`Tider gemt for sæson ${selectedSeason}!`, "success");
    } catch (e) {
      showSnackbar(e.message || "Kunne ikke gemme tider", "error");
    }
  };

  const handleOpenDeleteDialog = (school) => {
    setDeleteError(""); setSchoolToDelete(school); setClientsToDelete([]);
    setDeleteDialogOpen(true); setLoadingClients(true); setDeleteStep(1);
    getSchoolClients(school.id)
      .then(data => { setClientsToDelete(Array.isArray(data) ? data : []); setLoadingClients(false); })
      .catch(() => { setClientsToDelete([]); setLoadingClients(false); });
  };

  const handleFinalDeleteSchool = () => {
    if (!schoolToDelete) return;
    deleteSchool(schoolToDelete.id)
      .then(() => {
        setSchools(prev => prev.filter(s => s.id !== schoolToDelete.id));
        if (selectedSchool === schoolToDelete.id) {
          setSelectedSchool("");
          setWeekdayTimes({ onTime: "09:00", offTime: "22:30" });
          setWeekendTimes({ onTime: "08:00", offTime: "18:00" });
        }
        setDeleteDialogOpen(false); setSchoolToDelete(null);
        setClientsToDelete([]); setDeleteStep(1);
        showSnackbar("Skole og tilknyttede klienter er slettet!", "success");
      })
      .catch(e => { setDeleteError("Kunne ikke slette skole: " + (e.message || "")); showSnackbar("Fejl ved sletning af skole", "error"); });
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false); setSchoolToDelete(null);
    setClientsToDelete([]); setDeleteError(""); setDeleteStep(1);
  };

  const getSortedSchools = () => {
    let arr = schools.filter(s =>
      schoolSearch.trim() === "" || s.name.toLowerCase().includes(schoolSearch.trim().toLowerCase())
    );
    arr.sort((a, b) => {
      const cmp = a.name.localeCompare(b.name, "da", { sensitivity: "base" });
      return schoolSort.direction === "asc" ? cmp : -cmp;
    });
    return arr;
  };

  const getAlphaSchools = () => {
    const all = schools.slice().sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" }));
    if (!isSuperadmin && user?.school_id) return all.filter(s => s.id === user.school_id);
    return all;
  };

  const handleEditSchool = (school) => { setEditSchoolId(school.id); setEditSchoolName(school.name); setEditSchoolError(""); };
  const handleCancelEditSchool = () => { setEditSchoolId(null); setEditSchoolName(""); setEditSchoolError(""); };

  const handleSaveEditSchool = (school) => {
    const trimmedName = editSchoolName.trim();
    if (!trimmedName) { setEditSchoolError("Navnet kan ikke være tomt"); return; }
    if (schools.some(s => s.name === trimmedName && s.id !== school.id)) { setEditSchoolError("Skolenavnet findes allerede"); return; }
    updateSchoolName(school.id, trimmedName)
      .then(data => {
        setSchools(schools.map(s => s.id === school.id ? data : s));
        showSnackbar("Skolenavn opdateret!", "success");
        handleCancelEditSchool();
      })
      .catch(e => { setEditSchoolError(e.message || "Fejl ved opdatering"); });
  };

  const inputSx = { minWidth: 180, my: 0 };

  return (
    <Box>
      {/* Tider per skole og sæson */}
      <Paper sx={{ mb: 4, p: 3 }}>
        <Stack direction="row" gap={4} alignItems="flex-end" sx={{ width: "100%", flexWrap: "wrap" }}>

          {/* Skolevælger */}
          <Box sx={{ flex: 1, minWidth: 240 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Vælg skole</Typography>
            <FormControl size="small" fullWidth sx={inputSx}>
              <InputLabel id="skole-select-label">Skole</InputLabel>
              <Select
                labelId="skole-select-label" value={selectedSchool} label="Skole"
                onChange={e => setSelectedSchool(e.target.value)}
                disabled={loadingSchools || (!isSuperadmin && !!user?.school_id)}
              >
                {getAlphaSchools().map(school => (
                  <MenuItem key={school.id} value={school.id}>{school.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Sæsonvælger med chip */}
          <Box sx={{ minWidth: 220 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Vælg sæson</Typography>
            <FormControl size="small" fullWidth>
              <InputLabel id="season-select-label">Sæson</InputLabel>
              <Select
                labelId="season-select-label" value={selectedSeason} label="Sæson"
                onChange={e => setSelectedSeason(e.target.value)}
                renderValue={val => {
                  const s = SEASONS.find(x => x.value === val);
                  return (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <span>{val}</span>
                      {s?.isCurrent && (
                        <Chip label="Nuværende" size="small" color="primary" sx={{ height: 18, fontSize: "0.7rem" }} />
                      )}
                    </Box>
                  );
                }}
              >
                {SEASONS.map(s => (
                  <MenuItem key={s.value} value={s.value}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <span>{s.label}</span>
                      {s.isCurrent && (
                        <Chip label="Nuværende sæson" size="small" color="primary" sx={{ height: 20, fontSize: "0.72rem" }} />
                      )}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Tider */}
          <Box sx={{ flex: 2, minWidth: 300 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Standard tænd/sluk tider — sæson {selectedSeason}:
            </Typography>
            {loadingTimes ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1 }}>
                <CircularProgress size={20} />
                <Typography variant="body2">Henter tider...</Typography>
              </Box>
            ) : (
              <Stack direction="row" gap={2} alignItems="flex-end" sx={{ flexWrap: "wrap" }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 500 }}>Hverdage (ma-fr):</Typography>
                  <Stack direction="row" gap={1}>
                    <TextField label="Tænd kl." type="time" size="small" sx={{ minWidth: 120 }}
                      value={weekdayTimes.onTime}
                      onChange={e => setWeekdayTimes({ ...weekdayTimes, onTime: e.target.value })}
                      disabled={!selectedSchool} />
                    <TextField label="Sluk kl." type="time" size="small" sx={{ minWidth: 120 }}
                      value={weekdayTimes.offTime}
                      onChange={e => setWeekdayTimes({ ...weekdayTimes, offTime: e.target.value })}
                      disabled={!selectedSchool} />
                  </Stack>
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 500 }}>Weekend (lø-sø):</Typography>
                  <Stack direction="row" gap={1}>
                    <TextField label="Tænd kl." type="time" size="small" sx={{ minWidth: 120 }}
                      value={weekendTimes.onTime}
                      onChange={e => setWeekendTimes({ ...weekendTimes, onTime: e.target.value })}
                      disabled={!selectedSchool} />
                    <TextField label="Sluk kl." type="time" size="small" sx={{ minWidth: 120 }}
                      value={weekendTimes.offTime}
                      onChange={e => setWeekendTimes({ ...weekendTimes, offTime: e.target.value })}
                      disabled={!selectedSchool} />
                  </Stack>
                </Box>
                <Button variant="contained" size="large"
                  sx={{ minWidth: 140, height: 40, alignSelf: "flex-end" }}
                  onClick={handleSaveTimes} disabled={!selectedSchool
