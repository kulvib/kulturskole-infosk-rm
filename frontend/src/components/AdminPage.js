import React, { useState, useEffect } from "react";
import {
  Typography, Box, TextField, Button, List, ListItem, MenuItem,
  Select, FormControl, InputLabel, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, Table, TableHead,
  TableRow, TableCell, TableBody
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import axios from "axios";
import { apiUrl, getToken } from "../api";

const TIMES_STORAGE_PREFIX = "standard_times_settings_";

function loadStandardTimesForSchool(schoolId) {
  if (!schoolId) return {
    weekday: { onTime: "09:00", offTime: "22:30" },
    weekend: { onTime: "08:00", offTime: "18:00" }
  };
  const saved = localStorage.getItem(TIMES_STORAGE_PREFIX + schoolId);
  if (saved) {
    try {
      const t = JSON.parse(saved);
      return {
        weekday: t.weekday || { onTime: "09:00", offTime: "22:30" },
        weekend: t.weekend || { onTime: "08:00", offTime: "18:00" }
      };
    } catch {}
  }
  return {
    weekday: { onTime: "09:00", offTime: "22:30" },
    weekend: { onTime: "08:00", offTime: "18:00" }
  };
}

export default function AdminPage() {
  // SKOLEVALG OG TIDER
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState("");
  const [weekdayTimes, setWeekdayTimes] = useState({ onTime: "09:00", offTime: "22:30" });
  const [weekendTimes, setWeekendTimes] = useState({ onTime: "08:00", offTime: "18:00" });

  // NY SKOLE
  const [schoolName, setSchoolName] = useState("");
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  // SLET SKOLE FLOW
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [schoolToDelete, setSchoolToDelete] = useState(null);
  const [clientsToDelete, setClientsToDelete] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);

  // Hent skoler
  useEffect(() => {
    fetchSchools();
  }, []);

  const fetchSchools = () => {
    axios.get(`${apiUrl}/api/schools/`, {
      headers: { Authorization: "Bearer " + getToken() }
    })
      .then(res => setSchools(res.data))
      .catch((err) => {
        setSchools([]);
        setError("Kunne ikke hente skoler");
        console.error("FEJL VED HENTNING AF SKOLER", err);
      });
  };

  // Hent tider for valgt skole
  useEffect(() => {
    if (!selectedSchool) return;
    const times = loadStandardTimesForSchool(selectedSchool);
    setWeekdayTimes(times.weekday);
    setWeekendTimes(times.weekend);
  }, [selectedSchool]);

  const handleAddSchool = () => {
    const name = schoolName.trim();
    setError("");
    if (!name) return;
    if (schools.some(s => s.name === name)) {
      setError("Skolen findes allerede!");
      return;
    }
    axios.post(`${apiUrl}/api/schools/`, { name }, {
      headers: { Authorization: "Bearer " + getToken() }
    })
      .then(res => {
        setSchools([...schools, res.data]);
        setSchoolName("");
      })
      .catch(e => {
        setError(e.response?.data?.detail || "Fejl ved oprettelse");
        console.error("FEJL VED OPRETTELSE", e);
      });
  };

  // Gem tider for valgt skole
  const handleSaveTimes = () => {
    if (!selectedSchool) return;
    localStorage.setItem(TIMES_STORAGE_PREFIX + selectedSchool, JSON.stringify({
      weekday: weekdayTimes,
      weekend: weekendTimes
    }));
    alert("Standard tider gemt for skole!");
  };

  // Slet skole: Åben dialog og hent klienter
  const handleOpenDeleteDialog = (school) => {
    setDeleteError("");
    setSchoolToDelete(school);
    setClientsToDelete([]);
    setDeleteDialogOpen(true);
    setLoadingClients(true);
    setDeleteStep(1);
    axios.get(`${apiUrl}/api/schools/${school.id}/clients/`, {
      headers: { Authorization: "Bearer " + getToken() }
    })
      .then(res => {
        setClientsToDelete(res.data);
        setLoadingClients(false);
      })
      .catch(e => {
        setClientsToDelete([]);
        setLoadingClients(false);
      });
  };

  // Første bekræftelse
  const handleFirstDeleteConfirm = () => setDeleteStep(2);

  // Endelig sletning
  const handleFinalDeleteSchool = () => {
    if (!schoolToDelete) return;
    axios.delete(`${apiUrl}/api/schools/${schoolToDelete.id}/`, {
      headers: { Authorization: "Bearer " + getToken() }
    })
      .then(() => {
        setSchools(schools.filter(s => s.id !== schoolToDelete.id));
        if (selectedSchool === schoolToDelete.id) {
          setSelectedSchool("");
          setWeekdayTimes({ onTime: "09:00", offTime: "22:30" });
          setWeekendTimes({ onTime: "08:00", offTime: "18:00" });
        }
        localStorage.removeItem(TIMES_STORAGE_PREFIX + schoolToDelete.id);
        setDeleteDialogOpen(false);
        setSchoolToDelete(null);
        setClientsToDelete([]);
        setDeleteStep(1);
      })
      .catch(e => {
        setDeleteError("Kunne ikke slette skole: " + (e.response?.data?.detail || ""));
        console.error("FEJL VED SLETNING AF SKOLE", e);
      });
  };

  // Luk dialog
  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setSchoolToDelete(null);
    setClientsToDelete([]);
    setDeleteError("");
    setDeleteStep(1);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Administration
      </Typography>
      <Typography sx={{ mb: 2 }}>
        Her kan jeg oprette administration af f.eks. bruger opretning og andet.
      </Typography>

      {/* VÆLG SKOLE */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6">Vælg skole for standard tænd/sluk tider</Typography>
        <FormControl sx={{ minWidth: 240, mt: 1 }}>
          <InputLabel id="skole-select-label">Skole</InputLabel>
          <Select
            labelId="skole-select-label"
            value={selectedSchool}
            label="Skole"
            onChange={e => setSelectedSchool(e.target.value)}
          >
            {schools.map(school => (
              <MenuItem key={school.id} value={school.id}>{school.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* TIDER */}
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h6">
          Standard tænd/sluk tider <span style={{ fontWeight: 400 }}>({selectedSchool ? (schools.find(s => s.id === selectedSchool)?.name || "") : "Vælg skole"})</span>
        </Typography>
        <Box sx={{ display: "flex", gap: 4, alignItems: "center", mt: 1 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Hverdage (ma-fr):</Typography>
            <TextField
              label="Tænd kl."
              type="time"
              value={weekdayTimes.onTime}
              onChange={e => setWeekdayTimes({ ...weekdayTimes, onTime: e.target.value })}
              sx={{ mr: 2 }}
              disabled={!selectedSchool}
            />
            <TextField
              label="Sluk kl."
              type="time"
              value={weekdayTimes.offTime}
              onChange={e => setWeekdayTimes({ ...weekdayTimes, offTime: e.target.value })}
              disabled={!selectedSchool}
            />
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Weekend (lø-sø):</Typography>
            <TextField
              label="Tænd kl."
              type="time"
              value={weekendTimes.onTime}
              onChange={e => setWeekendTimes({ ...weekendTimes, onTime: e.target.value })}
              sx={{ mr: 2 }}
              disabled={!selectedSchool}
            />
            <TextField
              label="Sluk kl."
              type="time"
              value={weekendTimes.offTime}
              onChange={e => setWeekendTimes({ ...weekendTimes, offTime: e.target.value })}
              disabled={!selectedSchool}
            />
          </Box>
          <Button variant="contained" onClick={handleSaveTimes} disabled={!selectedSchool}>
            Gem tider
          </Button>
        </Box>
      </Box>

      {/* SKOLE OPRETTELSE OG LISTE */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6">Tilføj og se godkendte skoler</Typography>
        <Box sx={{ display: "flex", gap: 2, mt: 1 }}>
          <TextField
            label="Skole-navn"
            value={schoolName}
            onChange={e => setSchoolName(e.target.value)}
            error={!!error}
            helperText={error}
          />
          <Button variant="contained" onClick={handleAddSchool}>
            Tilføj skole
          </Button>
        </Box>
        {deleteError && (
          <Typography color="error" sx={{ mt: 2 }}>
            {deleteError}
          </Typography>
        )}
        <List sx={{ mt: 2 }}>
          {schools.length === 0 ? (
            <ListItem>Ingen skoler oprettet endnu</ListItem>
          ) : (
            schools.map((school) => (
              <ListItem
                key={school.id ?? school.name}
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label="slet"
                    color="error"
                    onClick={() => handleOpenDeleteDialog(school)}
                  >
                    <DeleteIcon />
                  </IconButton>
                }
              >
                {school.name}
              </ListItem>
            ))
          )}
        </List>
      </Box>

      {/* SLET DIALOG MED DOBBELT BEKRÆFTELSE OG TABEL */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          Slet skole: {schoolToDelete?.name}
        </DialogTitle>
        <DialogContent>
          <Typography color="error" gutterBottom>
            Advarsel: Du er ved at slette skolen <b>{schoolToDelete?.name}</b>.<br />
            Alle tilknyttede klienter vil også blive slettet!
          </Typography>
          {loadingClients ? (
            <Typography>Henter tilknyttede klienter...</Typography>
          ) : (
            <>
              {clientsToDelete.length > 0 ? (
                <>
                  <Table sx={{ mt: 2, mb: 1 }}>
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
                </>
              ) : (
                <Typography sx={{ mt: 2, mb: 1 }}>Ingen klienter er tilknyttet denne skole.</Typography>
              )}
            </>
          )}
          {deleteStep === 1 && (
            <Typography sx={{ mt: 2 }}>
              Er du sikker på at du vil slette denne skole og alle dens klienter?
            </Typography>
          )}
          {deleteStep === 2 && (
            <Typography color="error" sx={{ mt: 2 }}>
              Denne handling kan <b>ikke fortrydes!</b><br />
              Tryk <b>Slet endeligt</b> for at bekræfte.
            </Typography>
          )}
          {deleteError && (
            <Typography color="error" sx={{ mt: 2 }}>
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
