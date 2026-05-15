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
  deleteSchool, updateSchoolName, getSchoolClients, applySeasonTimes,
} from "../../api";
import { useAuth } from "../../auth/authcontext";

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

  // NY: Anvend sæsontider dialog
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);

  useEffect(() => {
    setLoadingSchools(true);
    getSchools()
      .then(data => setSchools(Array.isArray(data) ? data : []))
      .catch(() => { setSchools([]); setError("Kunne ikke hente skoler"); })
      .finally(() => setLoadingSchools(false));
  }, []);

  useEffect(() => {
    if (!isSuperadmin && user?.school_id && schools.length > 0) {
      setSelectedSchool(user.school_id);
    }
  }, [isSuperadmin, user, schools]);

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

  // NY: Anvend sæsontider på alle klienter
  const handleApplySeasonTimes = async () => {
    if (!selectedSchool || !selectedSeason) return;
    setApplyLoading(true);
    try {
      const result = await applySeasonTimes(selectedSchool, selectedSeason);
      setApplyDialogOpen(false);
      showSnackbar(
        `Tider anvendt på ${result.updated_clients.length} klient(er) for sæson ${selectedSeason}!`,
        "success"
      );
    } catch (e) {
      showSnackbar(e.message || "Kunne ikke anvende tider", "error");
    }
    setApplyLoading(false);
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
      .catch(e => {
        setDeleteError("Kunne ikke slette skole: " + (e.message || ""));
        showSnackbar("Fejl ved sletning af skole", "error");
      });
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

  const selectedSchoolName = schools.find(s => s.id === selectedSchool)?.name || "";

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
                <Stack direction="row" gap={1} alignItems="flex-end">
                  <Button
                    variant="contained" size="large"
                    sx={{ minWidth: 140, height: 40 }}
                    onClick={handleSaveTimes}
                    disabled={!selectedSchool}
                  >
                    Gem tider
                  </Button>
                  {/* NY: Knap til at anvende tider på alle klienter */}
                  <Tooltip title="Overskriver alle klienters kalender for den valgte skole og sæson med de gemte tider">
                    <span>
                      <Button
                        variant="outlined" color="warning" size="large"
                        sx={{ minWidth: 200, height: 40 }}
                        onClick={() => setApplyDialogOpen(true)}
                        disabled={!selectedSchool}
                      >
                        Opdater alle klienters tider
                      </Button>
                    </span>
                  </Tooltip>
                </Stack>
              </Stack>
            )}
          </Box>
        </Stack>
      </Paper>

      {/* Tilføj skole — kun superadmin */}
      {isSuperadmin && (
        <Paper sx={{ mb: 4, p: 3 }}>
          <Stack direction={{ xs: "column", md: "row" }} gap={4} alignItems="flex-end">
            <Box sx={{ flex: 2, minWidth: 340 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Tilføj skole</Typography>
              <Stack direction="row" gap={2} alignItems="flex-end" sx={{ mb: 2 }}>
                <TextField
                  label="Skole-navn" value={schoolName}
                  onChange={e => setSchoolName(e.target.value)}
                  error={!!error} helperText={error}
                  size="small" sx={inputSx} fullWidth
                />
                <Button variant="contained" sx={{ height: 40, minWidth: 140 }} onClick={handleAddSchool}>
                  Tilføj skole
                </Button>
                <TextField
                  label="Søg" size="small" value={schoolSearch}
                  onChange={e => setSchoolSearch(e.target.value)}
                  sx={{ minWidth: 120 }} placeholder="Søg skole..."
                />
                <Tooltip title={`Sortér alfabetisk ${schoolSort.direction === "asc" ? "(A-Å)" : "(Å-A)"}`}>
                  <IconButton
                    onClick={() => setSchoolSort(prev => ({ ...prev, direction: prev.direction === "asc" ? "desc" : "asc" }))}
                    sx={{ ml: 1 }} aria-label="Sortér"
                  >
                    {schoolSort.direction === "asc" ? <ArrowDownwardIcon /> : <ArrowUpwardIcon />}
                  </IconButton>
                </Tooltip>
              </Stack>
              {deleteError && <Typography color="error" sx={{ mb: 2 }}>{deleteError}</Typography>}
              {getSortedSchools().length === 0 ? (
                <Typography align="center" sx={{ color: "#888", mt: 2 }}>Ingen skoler oprettet endnu</Typography>
              ) : (
                <Grid container spacing={2} sx={{ mt: 2 }}>
                  {getSortedSchools().map(school => (
                    <Grid item xs={12} sm={6} md={2.4} key={school.id ?? school.name}>
                      <Card variant="outlined" sx={{ height: "100%" }}>
                        <CardContent sx={{ pb: 1 }}>
                          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            {editSchoolId === school.id ? (
                              <TextField
                                value={editSchoolName}
                                onChange={e => { setEditSchoolName(e.target.value); setEditSchoolError(""); }}
                                size="small" error={!!editSchoolError} helperText={editSchoolError}
                                sx={{ minWidth: 120, flex: 1 }} autoFocus
                                onKeyDown={e => { if (e.key === "Enter") handleSaveEditSchool(school); }}
                              />
                            ) : (
                              <Typography variant="subtitle1" sx={{ fontWeight: "normal", flex: 1 }}>
                                {school.name}
                              </Typography>
                            )}
                            <Box sx={{ display: "flex", alignItems: "center", ml: 1 }}>
                              {editSchoolId === school.id ? (
                                <Tooltip title="Gem">
                                  <IconButton color="primary" onClick={() => handleSaveEditSchool(school)} size="small" sx={{ m: 0, p: "2px" }}>
                                    <CheckIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              ) : (
                                <>
                                  <Tooltip title="Rediger navn">
                                    <IconButton color="primary" onClick={() => handleEditSchool(school)} size="small" sx={{ m: 0, p: "2px" }}>
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Slet skole">
                                    <span>
                                      <IconButton edge="end" aria-label="slet" color="error" onClick={() => handleOpenDeleteDialog(school)} size="small" sx={{ m: 0, p: "2px", ml: 0.3 }}>
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                </>
                              )}
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          </Stack>
        </Paper>
      )}

      {/* NY: Bekræftelsesdialog — Opdater alle klienters tider */}
      <Dialog open={applyDialogOpen} onClose={() => !applyLoading && setApplyDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Opdater alle klienters tider</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Du er ved at overskrive <b>alle dage</b> i kalenderen for alle klienter tilknyttet:
          </Typography>
          <Typography sx={{ mb: 1 }}>
            <b>Skole:</b> {selectedSchoolName}
          </Typography>
          <Typography sx={{ mb: 2 }}>
            <b>Sæson:</b> {selectedSeason}
          </Typography>
          <Typography sx={{ mb: 2 }}>
            Alle dage — hverdage og weekender — sættes til <b>tændt</b> med følgende tider:
          </Typography>
          <Box sx={{ background: "#f5f5f5", borderRadius: 1, p: 2, mb: 2 }}>
            <Typography variant="body2"><b>Hverdage:</b> {weekdayTimes.onTime} – {weekdayTimes.offTime}</Typography>
            <Typography variant="body2"><b>Weekend:</b> {weekendTimes.onTime} – {weekendTimes.offTime}</Typography>
          </Box>
          <Typography color="error" sx={{ fontWeight: 600 }}>
            Advarsel: Denne handling overskriver alle eksisterende kalendermarkeringer for alle klienter på denne skole i den valgte sæson. Dette kan ikke fortrydes!
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApplyDialogOpen(false)} disabled={applyLoading}>
            Annuller
          </Button>
          <Button
            color="warning" variant="contained"
            onClick={handleApplySeasonTimes}
            disabled={applyLoading}
            startIcon={applyLoading ? <CircularProgress size={18} color="inherit" /> : null}
          >
            {applyLoading ? "Opdaterer..." : "Ja, opdater alle klienters tider"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Slet-dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog} maxWidth="md" fullWidth>
        <DialogTitle>Slet skole: {schoolToDelete?.name}</DialogTitle>
        <DialogContent>
          <Typography color="error" gutterBottom sx={{ mb: 2 }}>
            Advarsel: Du er ved at slette skolen <b>{schoolToDelete?.name}</b>.<br />
            Alle tilknyttede klienter vil også blive slettet!
          </Typography>
          {loadingClients ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
              <CircularProgress size={24} />
              <Typography>Henter tilknyttede klienter...</Typography>
            </Box>
          ) : (
            <>
              {Array.isArray(clientsToDelete) && clientsToDelete.length > 0 ? (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Tilknyttede klienter:</Typography>
                  {clientsToDelete.map(client => (
                    <Box key={client.id} sx={{ mb: 0.5, ml: 2 }}>
                      <Typography variant="body2">
                        Klient ID: {client.id} – Lokation: {client.locality || client.name || "-"}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography sx={{ mb: 2 }}>Ingen klienter er tilknyttet denne skole.</Typography>
              )}
            </>
          )}
          {deleteStep === 1 && (
            <Typography sx={{ mb: 2 }}>Er du sikker på at du vil slette denne skole og alle dens klienter?</Typography>
          )}
          {deleteStep === 2 && (
            <Typography color="error" sx={{ mb: 2 }}>
              Denne handling kan <b>ikke fortrydes!</b><br />Tryk <b>Slet endeligt</b> for at bekræfte.
            </Typography>
          )}
          {deleteError && <Typography color="error" sx={{ mb: 2 }}>{deleteError}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Annuller</Button>
          {deleteStep === 1 ? (
            <Button color="warning" variant="contained" onClick={() => setDeleteStep(2)} disabled={loadingClients}>
              Bekræft sletning
            </Button>
          ) : (
            <Button color="error" variant="contained" onClick={handleFinalDeleteSchool} disabled={loadingClients}>
              Slet endeligt
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3400} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <MuiAlert elevation={6} variant="filled" onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </MuiAlert>
      </Snackbar>
    </Box>
  );
}
