import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Button,
  Tooltip,
  CircularProgress,
  Stack,
  Snackbar,
  Alert as MuiAlert,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  TextField,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import axios from "axios";

const API_URL = "https://kulturskole-infosk-rm.onrender.com";

export default function SchoolAdministration() {
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState("");
  const [weekdayTimes, setWeekdayTimes] = useState({ onTime: "09:00", offTime: "22:30" });
  const [weekendTimes, setWeekendTimes] = useState({ onTime: "08:00", offTime: "18:00" });
  const [loadingSchools, setLoadingSchools] = useState(false);

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

  useEffect(() => {
    setLoadingSchools(true);
    axios.get(`${API_URL}/api/schools/`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    })
      .then(res => setSchools(Array.isArray(res.data) ? res.data : []))
      .catch(() => {
        setSchools([]);
        setError("Kunne ikke hente skoler");
      }).finally(() => setLoadingSchools(false));
  }, []);

  useEffect(() => {
    if (!selectedSchool) return;
    axios.get(`${API_URL}/api/schools/${selectedSchool}/times/`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    })
      .then(res => {
        setWeekdayTimes(res.data.weekday || { onTime: "09:00", offTime: "22:30" });
        setWeekendTimes(res.data.weekend || { onTime: "08:00", offTime: "18:00" });
      })
      .catch(() => {
        setWeekdayTimes({ onTime: "09:00", offTime: "22:30" });
        setWeekendTimes({ onTime: "08:00", offTime: "18:00" });
      });
  }, [selectedSchool]);

  const handleAddSchool = () => {
    const name = schoolName.trim();
    setError("");
    if (!name) return;
    if (Array.isArray(schools) && schools.some(s => s.name === name)) {
      setError("Skolen findes allerede!");
      return;
    }
    axios.post(`${API_URL}/api/schools/`, { name }, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    })
      .then(res => {
        setSchools(Array.isArray(schools) ? [...schools, res.data] : [res.data]);
        setSchoolName("");
        showSnackbar("Skole oprettet!", "success");
      })
      .catch(e => {
        setError(e.response?.data?.detail || e.message || "Fejl ved oprettelse");
        showSnackbar("Fejl ved oprettelse af skole", "error");
      });
  };

  const handleSaveTimes = async () => {
    if (!selectedSchool) return;
    try {
      await axios.patch(`${API_URL}/api/schools/${selectedSchool}/times/`, {
        weekday_on: weekdayTimes.onTime,
        weekday_off: weekdayTimes.offTime,
        weekend_on: weekendTimes.onTime,
        weekend_off: weekendTimes.offTime
      }, {
        headers: { Authorization: "Bearer " + localStorage.getItem("token") }
      });
      showSnackbar("Standard tider gemt for skole!", "success");
    } catch (e) {
      showSnackbar("Kunne ikke gemme tider", "error");
    }
  };

  const handleOpenDeleteDialog = (school) => {
    setDeleteError("");
    setSchoolToDelete(school);
    setClientsToDelete([]);
    setDeleteDialogOpen(true);
    setLoadingClients(true);
    setDeleteStep(1);
    axios.get(`${API_URL}/api/schools/${school.id}/clients/`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    })
      .then(res => {
        setClientsToDelete(Array.isArray(res.data) ? res.data : []);
        setLoadingClients(false);
      })
      .catch(() => {
        setClientsToDelete([]);
        setLoadingClients(false);
      });
  };

  const handleFirstDeleteConfirm = () => setDeleteStep(2);

  const handleFinalDeleteSchool = () => {
    if (!schoolToDelete) return;
    axios.delete(`${API_URL}/api/schools/${schoolToDelete.id}/`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    })
      .then(() => {
        setSchools(Array.isArray(schools) ? schools.filter(s => s.id !== schoolToDelete.id) : []);
        if (selectedSchool === schoolToDelete.id) {
          setSelectedSchool("");
          setWeekdayTimes({ onTime: "09:00", offTime: "22:30" });
          setWeekendTimes({ onTime: "08:00", offTime: "18:00" });
        }
        setDeleteDialogOpen(false);
        setSchoolToDelete(null);
        setClientsToDelete([]);
        setDeleteStep(1);
        showSnackbar("Skole og tilknyttede klienter er slettet!", "success");
      })
      .catch(e => {
        setDeleteError("Kunne ikke slette skole: " + (e.response?.data?.detail || ""));
        showSnackbar("Fejl ved sletning af skole", "error");
      });
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setSchoolToDelete(null);
    setClientsToDelete([]);
    setDeleteError("");
    setDeleteStep(1);
  };

  const getSortedSchools = () => {
    let arr = schools
      .filter(s =>
        schoolSearch.trim() === "" ||
        s.name.toLowerCase().includes(schoolSearch.trim().toLowerCase())
      );
    arr.sort((a, b) => {
      const cmp = a.name.localeCompare(b.name, 'da', { sensitivity: 'base' });
      return schoolSort.direction === "asc" ? cmp : -cmp;
    });
    return arr;
  };

  const getAlphaSchools = () =>
    schools.slice().sort((a, b) => a.name.localeCompare(b.name, 'da', { sensitivity: 'base' }));

  const inputSx = { minWidth: 180, my: 0 };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", mt: 4, minHeight: "60vh", p: 2 }}>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3400}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <MuiAlert elevation={6} variant="filled" onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </MuiAlert>
      </Snackbar>

      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        Skoleadministration
      </Typography>

      <Paper sx={{ mb: 4, p: 3 }}>
        <Stack
          direction="row"
          gap={4}
          alignItems="flex-end"
          sx={{ width: "100%", flexWrap: "wrap" }}
        >
          <Box sx={{ flex: 1, minWidth: 240 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Vælg skole
            </Typography>
            <FormControl size="small" fullWidth sx={inputSx}>
              <InputLabel id="skole-select-label">Skole</InputLabel>
              <Select
                labelId="skole-select-label"
                value={selectedSchool}
                label="Skole"
                onChange={e => setSelectedSchool(e.target.value)}
                disabled={loadingSchools}
              >
                {getAlphaSchools().map(school => (
                  <MenuItem key={school.id} value={school.id}>{school.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ flex: 2, minWidth: 300 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Standard tænd/sluk tider:
            </Typography>
            <Stack
              direction="row"
              gap={2}
              alignItems="flex-end"
              sx={{ mt: 0, flexWrap: "wrap" }}
            >
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 500 }}>Hverdage (ma-fr):</Typography>
                <Stack direction="row" gap={1}>
                  <TextField
                    label="Tænd kl."
                    type="time"
                    size="small"
                    fullWidth
                    sx={{ minWidth: 120 }}
                    value={weekdayTimes.onTime}
                    onChange={e => setWeekdayTimes({ ...weekdayTimes, onTime: e.target.value })}
                    disabled={!selectedSchool}
                  />
                  <TextField
                    label="Sluk kl."
                    type="time"
                    size="small"
                    fullWidth
                    sx={{ minWidth: 120 }}
                    value={weekdayTimes.offTime}
                    onChange={e => setWeekdayTimes({ ...weekdayTimes, offTime: e.target.value })}
                    disabled={!selectedSchool}
                  />
                </Stack>
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 500 }}>Weekend (lø-sø):</Typography>
                <Stack direction="row" gap={1}>
                  <TextField
                    label="Tænd kl."
                    type="time"
                    size="small"
                    fullWidth
                    sx={{ minWidth: 120 }}
                    value={weekendTimes.onTime}
                    onChange={e => setWeekendTimes({ ...weekendTimes, onTime: e.target.value })}
                    disabled={!selectedSchool}
                  />
                  <TextField
                    label="Sluk kl."
                    type="time"
                    size="small"
                    fullWidth
                    sx={{ minWidth: 120 }}
                    value={weekendTimes.offTime}
                    onChange={e => setWeekendTimes({ ...weekendTimes, offTime: e.target.value })}
                    disabled={!selectedSchool}
                  />
                </Stack>
              </Box>
              <Button
                variant="contained"
                size="large"
                sx={{ minWidth: 140, height: 40, alignSelf: "flex-end" }}
                onClick={handleSaveTimes}
                disabled={!selectedSchool}
              >
                Gem tider
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Paper>

      <Paper sx={{ mb: 4, p: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} gap={4} alignItems="flex-end">
          <Box sx={{ flex: 2, minWidth: 340 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Tilføj og se godkendte skoler
            </Typography>
            <Stack direction="row" gap={2} alignItems="flex-end" sx={{ mb: 2 }}>
              <TextField
                label="Skole-navn"
                value={schoolName}
                onChange={e => setSchoolName(e.target.value)}
                error={!!error}
                helperText={error}
                size="small"
                sx={inputSx}
                fullWidth
              />
              <Button variant="contained" sx={{ height: 40, minWidth: 140 }} onClick={handleAddSchool}>
                Tilføj skole
              </Button>
              <TextField
                label="Søg"
                size="small"
                value={schoolSearch}
                onChange={e => setSchoolSearch(e.target.value)}
                sx={{ minWidth: 120 }}
                placeholder="Søg skole..."
              />
              <Tooltip title={`Sortér alfabetisk ${schoolSort.direction === "asc" ? "(A-Å)" : "(Å-A)"}`}>
                <IconButton
                  onClick={() =>
                    setSchoolSort((prev) => ({
                      ...prev,
                      direction: prev.direction === "asc" ? "desc" : "asc",
                    }))
                  }
                  sx={{ ml: 1 }}
                  aria-label="Sortér"
                >
                  {schoolSort.direction === "asc" ? <ArrowDownwardIcon /> : <ArrowUpwardIcon />}
                </IconButton>
              </Tooltip>
            </Stack>
            {deleteError && (
              <Typography color="error" sx={{ mb: 2 }}>
                {deleteError}
              </Typography>
            )}
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Skole</TableCell>
                    <TableCell sx={{ fontWeight: 700, textAlign: "right" }}>Handlinger</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {getSortedSchools().length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} align="center" sx={{ color: "#888" }}>
                        Ingen skoler oprettet endnu
                      </TableCell>
                    </TableRow>
                  ) : (
                    getSortedSchools().map((school) => (
                      <TableRow key={school.id ?? school.name} hover>
                        <TableCell>{school.name}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Slet skole">
                            <span>
                              <IconButton
                                edge="end"
                                aria-label="slet"
                                color="error"
                                onClick={() => handleOpenDeleteDialog(school)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Stack>
      </Paper>

      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          Slet skole: {schoolToDelete?.name}
        </DialogTitle>
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
                <TableContainer sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><b>Klient ID</b></TableCell>
                        <TableCell><b>Lokation</b></TableCell>
                        <TableCell><b>Skole</b></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {clientsToDelete.map(client => (
                        <TableRow key={client.id}>
                          <TableCell>{client.id}</TableCell>
                          <TableCell>{client.locality || client.name || "-"}</TableCell>
                          <TableCell>{schoolToDelete?.name}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography sx={{ mb: 2 }}>Ingen klienter er tilknyttet denne skole.</Typography>
              )}
            </>
          )}
          {deleteStep === 1 && (
            <Typography sx={{ mb: 2 }}>
              Er du sikker på at du vil slette denne skole og alle dens klienter?
            </Typography>
          )}
          {deleteStep === 2 && (
            <Typography color="error" sx={{ mb: 2 }}>
              Denne handling kan <b>ikke fortrydes!</b><br />
              Tryk <b>Slet endeligt</b> for at bekræfte.
            </Typography>
          )}
          {deleteError && (
            <Typography color="error" sx={{ mb: 2 }}>
              {deleteError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Annuller</Button>
          {deleteStep === 1 ? (
            <Button color="warning" variant="contained" onClick={handleFirstDeleteConfirm} disabled={loadingClients}>
              Bekræft sletning
            </Button>
          ) : (
            <Button color="error" variant="contained" onClick={handleFinalDeleteSchool} disabled={loadingClients}>
              Slet endeligt
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
