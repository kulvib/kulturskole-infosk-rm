import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Button,
  Tooltip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { apiUrl, getToken } from "../api";
import axios from "axios";

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
  const [loadingSchools, setLoadingSchools] = useState(false);

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

  // USER ADMINISTRATION
  const [users, setUsers] = useState([]);
  const [userError, setUserError] = useState("");
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "elev", is_active: true });
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Hent skoler
  useEffect(() => {
    setLoadingSchools(true);
    axios.get(`${apiUrl}/api/schools/`, {
      headers: { Authorization: "Bearer " + getToken() }
    })
      .then(res => setSchools(res.data))
      .catch((err) => {
        setSchools([]);
        setError("Kunne ikke hente skoler");
      }).finally(() => setLoadingSchools(false));
  }, []);

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
      .catch(() => {
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

  // ----------- USER ADMINISTRATION -----------
  useEffect(() => {
    setLoadingUsers(true);
    axios.get(`${apiUrl}/api/users/`, {
      headers: { Authorization: "Bearer " + getToken() }
    })
      .then(res => setUsers(res.data))
      .catch(() => {
        setUsers([]);
        setUserError("Kunne ikke hente brugere (kun admin kan se listen)");
      }).finally(() => setLoadingUsers(false));
  }, []);

  const handleAddUser = () => {
    setUserError("");
    const { username, password, role, is_active } = newUser;
    if (!username || !password) {
      setUserError("Brugernavn og kodeord skal udfyldes");
      return;
    }
    axios.post(`${apiUrl}/api/users/`, null, {
      params: { username, password, role, is_active },
      headers: { Authorization: "Bearer " + getToken() }
    })
      .then(res => {
        setUsers([...users, res.data]);
        setNewUser({ username: "", password: "", role: "elev", is_active: true });
      })
      .catch(e => {
        setUserError(e.response?.data?.detail || "Fejl ved oprettelse");
      });
  };

  const handleDeleteUser = (id) => {
    axios.delete(`${apiUrl}/api/users/${id}`, {
      headers: { Authorization: "Bearer " + getToken() }
    })
      .then(() => setUsers(users.filter(u => u.id !== id)))
      .catch(e => setUserError(e.response?.data?.detail || "Fejl ved sletning"));
  };

  const openEditUserDialog = (user) => {
    setEditUser({ ...user, password: "" });
    setUserDialogOpen(true);
    setUserError("");
  };

  const handleEditUser = () => {
    if (!editUser) return;
    const { id, role, is_active, password } = editUser;
    axios.patch(`${apiUrl}/api/users/${id}`, null, {
      params: {
        role,
        is_active,
        password: password ? password : undefined
      },
      headers: { Authorization: "Bearer " + getToken() }
    })
      .then(res => {
        setUsers(users.map(u => u.id === res.data.id ? res.data : u));
        setUserDialogOpen(false);
        setEditUser(null);
      })
      .catch(e => setUserError(e.response?.data?.detail || "Fejl ved opdatering"));
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", mt: 4, minHeight: "60vh", p: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        Administration
      </Typography>
      <Typography sx={{ mb: 2 }}>
        Her kan du oprette og administrere brugere, godkende skoler og bestemme standardtider.
      </Typography>

      {/* VÆLG SKOLE */}
      <Paper sx={{ mb: 4, p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Vælg skole for standard tænd/sluk tider
        </Typography>
        <FormControl sx={{ minWidth: 240 }}>
          <InputLabel id="skole-select-label">Skole</InputLabel>
          <Select
            labelId="skole-select-label"
            value={selectedSchool}
            label="Skole"
            onChange={e => setSelectedSchool(e.target.value)}
            disabled={loadingSchools}
          >
            {schools.map(school => (
              <MenuItem key={school.id} value={school.id}>{school.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>

      {/* TIDER */}
      <Paper sx={{ mb: 4, p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Standard tænd/sluk tider <span style={{ fontWeight: 400 }}>({selectedSchool ? (schools.find(s => s.id === selectedSchool)?.name || "") : "Vælg skole"})</span>
        </Typography>
        <Stack direction={{ xs: "column", md: "row" }} gap={4} alignItems="flex-start" sx={{ mt: 2 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 500 }}>Hverdage (ma-fr):</Typography>
            <Stack direction="row" gap={2}>
              <TextField
                label="Tænd kl."
                type="time"
                value={weekdayTimes.onTime}
                onChange={e => setWeekdayTimes({ ...weekdayTimes, onTime: e.target.value })}
                disabled={!selectedSchool}
              />
              <TextField
                label="Sluk kl."
                type="time"
                value={weekdayTimes.offTime}
                onChange={e => setWeekdayTimes({ ...weekdayTimes, offTime: e.target.value })}
                disabled={!selectedSchool}
              />
            </Stack>
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 500 }}>Weekend (lø-sø):</Typography>
            <Stack direction="row" gap={2}>
              <TextField
                label="Tænd kl."
                type="time"
                value={weekendTimes.onTime}
                onChange={e => setWeekendTimes({ ...weekendTimes, onTime: e.target.value })}
                disabled={!selectedSchool}
              />
              <TextField
                label="Sluk kl."
                type="time"
                value={weekendTimes.offTime}
                onChange={e => setWeekendTimes({ ...weekendTimes, offTime: e.target.value })}
                disabled={!selectedSchool}
              />
            </Stack>
          </Box>
          <Button variant="contained" onClick={handleSaveTimes} disabled={!selectedSchool}>
            Gem tider
          </Button>
        </Stack>
      </Paper>

      {/* SKOLE OPRETTELSE OG LISTE */}
      <Paper sx={{ mb: 4, p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Tilføj og se godkendte skoler
        </Typography>
        <Stack direction={{ xs: "column", md: "row" }} gap={2} sx={{ mb: 2 }}>
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
              {schools.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} align="center" sx={{ color: "#888" }}>
                    Ingen skoler oprettet endnu
                  </TableCell>
                </TableRow>
              ) : (
                schools.map((school) => (
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
      </Paper>

      {/* SLET DIALOG MED DOBBELT BEKRÆFTELSE OG TABEL */}
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
              {clientsToDelete.length > 0 ? (
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

      {/* ----------- BRUGERADMINISTRATION ----------- */}
      <Paper sx={{ mb: 4, p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Brugeradministration
        </Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Opret, redigér og slet brugere (kræver admin-rettigheder)
        </Typography>
        <Stack direction={{ xs: "column", md: "row" }} gap={2} sx={{ mb: 2 }}>
          <TextField
            label="Brugernavn"
            value={newUser.username}
            onChange={e => setNewUser({ ...newUser, username: e.target.value })}
          />
          <TextField
            label="Kodeord"
            type="password"
            value={newUser.password}
            onChange={e => setNewUser({ ...newUser, password: e.target.value })}
          />
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel id="rolle-label">Rolle</InputLabel>
            <Select
              labelId="rolle-label"
              value={newUser.role}
              label="Rolle"
              onChange={e => setNewUser({ ...newUser, role: e.target.value })}
            >
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="laerer">Lærer</MenuItem>
              <MenuItem value="elev">Elev</MenuItem>
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel id="status-label">Status</InputLabel>
            <Select
              labelId="status-label"
              value={newUser.is_active ? "true" : "false"}
              label="Status"
              onChange={e => setNewUser({ ...newUser, is_active: e.target.value === "true" })}
            >
              <MenuItem value="true">Aktiv</MenuItem>
              <MenuItem value="false">Spærret</MenuItem>
            </Select>
          </FormControl>
          <Button variant="contained" onClick={handleAddUser}>Opret bruger</Button>
        </Stack>
        {userError && <Typography color="error" sx={{ mb: 2 }}>{userError}</Typography>}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Brugernavn</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Rolle</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700, textAlign: "right" }}>Handlinger</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loadingUsers ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ color: "#888" }}>
                    Ingen brugere oprettet endnu
                  </TableCell>
                </TableRow>
              ) : (
                users.map(user => (
                  <TableRow key={user.id} hover>
                    <TableCell>{user.id}</TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>{user.role}</TableCell>
                    <TableCell>{user.is_active ? "Aktiv" : "Spærret"}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Rediger bruger">
                        <span>
                          <IconButton onClick={() => openEditUserDialog(user)}>
                            <EditIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Slet bruger">
                        <span>
                          <IconButton color="error" onClick={() => handleDeleteUser(user.id)}>
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
        {/* Dialog til redigering */}
        <Dialog open={userDialogOpen} onClose={() => setUserDialogOpen(false)}>
          <DialogTitle>Rediger bruger</DialogTitle>
          <DialogContent>
            {editUser && (
              <Stack gap={2} sx={{ mt: 1 }}>
                <TextField label="Brugernavn" value={editUser.username} disabled fullWidth />
                <FormControl fullWidth>
                  <InputLabel id="edit-rolle-label">Rolle</InputLabel>
                  <Select
                    labelId="edit-rolle-label"
                    value={editUser.role}
                    label="Rolle"
                    onChange={e => setEditUser({ ...editUser, role: e.target.value })}
                  >
                    <MenuItem value="admin">Admin</MenuItem>
                    <MenuItem value="laerer">Lærer</MenuItem>
                    <MenuItem value="elev">Elev</MenuItem>
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel id="edit-status-label">Status</InputLabel>
                  <Select
                    labelId="edit-status-label"
                    value={editUser.is_active ? "true" : "false"}
                    label="Status"
                    onChange={e => setEditUser({ ...editUser, is_active: e.target.value === "true" })}
                  >
                    <MenuItem value="true">Aktiv</MenuItem>
                    <MenuItem value="false">Spærret</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Nyt kodeord"
                  type="password"
                  value={editUser.password || ""}
                  onChange={e => setEditUser({ ...editUser, password: e.target.value })}
                  fullWidth
                />
              </Stack>
            )}
            {userError && <Typography color="error" sx={{ mt: 2 }}>{userError}</Typography>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setUserDialogOpen(false)}>Annuller</Button>
            <Button variant="contained" onClick={handleEditUser}>Gem ændringer</Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Box>
  );
}
