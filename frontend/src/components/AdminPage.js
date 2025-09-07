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
import EditIcon from "@mui/icons-material/Edit";
import axios from "axios";

const API_URL = "https://kulturskole-infosk-rm.onrender.com";

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
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    password2: "",
    role: "bruger",
    is_active: true,
    school_id: "",
  });
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // SLET BRUGER FLOW
  const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteUserError, setDeleteUserError] = useState("");
  const [deleteUserStep, setDeleteUserStep] = useState(1);

  // SNACKBAR
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const showSnackbar = (message, severity = "success") => setSnackbar({ open: true, message, severity });
  const handleCloseSnackbar = () => setSnackbar({ open: false, message: "", severity: "success" });

  // Hent skoler
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

  // Hent tider for valgt skole
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

  // SKOLE OPRETTELSE
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

  // Gem tider for valgt skole
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

  // Slet skole: Åben dialog og hent klienter
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

  // USER ADMINISTRATION
  useEffect(() => {
    setLoadingUsers(true);
    axios.get(`${API_URL}/api/users/`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    })
      .then(res => {
        setUsers(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        setUsers([]);
        setUserError("Kunne ikke hente brugere (kun admin kan se listen)");
      }).finally(() => setLoadingUsers(false));
  }, []);

  // Opret bruger
  const handleAddUser = () => {
    setUserError("");
    const { username, password, password2, role, is_active, school_id } = newUser;
    if (!username || !password || !password2) {
      setUserError("Brugernavn og begge kodeord skal udfyldes");
      showSnackbar("Brugernavn og begge kodeord skal udfyldes", "error");
      return;
    }
    if (password !== password2) {
      setUserError("Kodeordene matcher ikke");
      showSnackbar("Kodeordene matcher ikke", "error");
      return;
    }
    if (role === "bruger" && !school_id) {
      setUserError("Bruger skal tilknyttes en skole");
      showSnackbar("Bruger skal tilknyttes en skole", "error");
      return;
    }
    axios.post(`${API_URL}/api/users/`, {
      username,
      password,
      role: role === "administrator" ? "admin" : "bruger",
      is_active,
      school_id: role === "bruger" ? school_id : undefined
    }, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    })
      .then(res => {
        setUsers(Array.isArray(users) ? [...users, res.data] : [res.data]);
        setNewUser({ username: "", password: "", password2: "", role: "bruger", is_active: true, school_id: "" });
        showSnackbar("Bruger oprettet!", "success");
      })
      .catch(e => {
        setUserError(e.response?.data?.detail || e.message || "Fejl ved oprettelse");
        showSnackbar("Fejl ved oprettelse af bruger", "error");
      });
  };

  // SLET BRUGER: Åben advarselsdialog
  const handleOpenDeleteUserDialog = (user) => {
    setUserToDelete(user);
    setDeleteUserDialogOpen(true);
    setDeleteUserError("");
    setDeleteUserStep(1);
  };
  const handleFirstDeleteUserConfirm = () => setDeleteUserStep(2);

  // Endelig sletning af bruger
  const handleFinalDeleteUser = () => {
    if (!userToDelete) return;
    axios.delete(`${API_URL}/api/users/${userToDelete.id}`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    })
      .then(() => {
        setUsers(Array.isArray(users) ? users.filter(u => u.id !== userToDelete.id) : []);
        setDeleteUserDialogOpen(false);
        setUserToDelete(null);
        setDeleteUserStep(1);
        showSnackbar("Bruger slettet!", "success");
      })
      .catch(e => {
        setDeleteUserError("Kunne ikke slette bruger: " + (e.response?.data?.detail || ""));
        showSnackbar("Fejl ved sletning af bruger", "error");
      });
  };
  const handleCloseDeleteUserDialog = () => {
    setDeleteUserDialogOpen(false);
    setUserToDelete(null);
    setDeleteUserError("");
    setDeleteUserStep(1);
  };

  const openEditUserDialog = (user) => {
    setEditUser({ ...user, password: "", password2: "" });
    setUserDialogOpen(true);
    setUserError("");
  };

  const handleEditUser = () => {
    if (!editUser) return;
    const { id, role, is_active, password, password2, school_id } = editUser;
    if (password && password !== password2) {
      setUserError("Kodeordene matcher ikke");
      showSnackbar("Kodeordene matcher ikke", "error");
      return;
    }
    axios.patch(`${API_URL}/api/users/${id}`, {
      role: role === "administrator" ? "admin" : "bruger",
      is_active,
      password: password ? password : undefined,
      school_id: role === "bruger" ? school_id : undefined
    }, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    })
      .then(res => {
        setUsers(Array.isArray(users) ? users.map(u => u.id === res.data.id ? res.data : u) : []);
        setUserDialogOpen(false);
        setEditUser(null);
        showSnackbar("Bruger opdateret!", "success");
      })
      .catch(e => {
        setUserError(e.response?.data?.detail || e.message || "Fejl ved opdatering");
        showSnackbar("Fejl ved opdatering af bruger", "error");
      });
  };

  // Helper: get sorted schools alphabetically
  const getSortedSchools = () =>
    schools
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'da', { sensitivity: 'base' }));

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
        Administration
      </Typography>
      <Typography sx={{ mb: 2 }}>
        Her kan du oprette og administrere brugere, godkende skoler og bestemme standardtider.
      </Typography>

      {/* Skolevalg + tænd/sluk tider */}
      <Paper sx={{ mb: 4, p: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} gap={4} alignItems="flex-start">
          <Box sx={{ flex: 1, minWidth: 240 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Vælg skole
            </Typography>
            <FormControl fullWidth>
              <InputLabel id="skole-select-label">Skole</InputLabel>
              <Select
                labelId="skole-select-label"
                value={selectedSchool}
                label="Skole"
                onChange={e => setSelectedSchool(e.target.value)}
                disabled={loadingSchools}
              >
                {Array.isArray(schools) &&
                  getSortedSchools().map(school => (
                    <MenuItem key={school.id} value={school.id}>{school.name}</MenuItem>
                  ))}
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ flex: 2, minWidth: 300 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Standard tænd/sluk tider {selectedSchool ? `- ${Array.isArray(schools) ? (schools.find(s => s.id === selectedSchool)?.name || "") : ""}` : ""}
            </Typography>
            <Stack direction="row" gap={4} alignItems="center" sx={{ mt: 2 }}>
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
              <Button
                variant="contained"
                size="large"
                sx={{ minWidth: 140, height: 56 }}
                onClick={handleSaveTimes}
                disabled={!selectedSchool}
              >
                Gem tider
              </Button>
            </Stack>
          </Box>
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
              {Array.isArray(schools) && schools.length === 0 ? (
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
      </Paper>

      {/* SLET SKOLE DIALOG MED DOBBELT BEKRÆFTELSE OG TABEL */}
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
          <TextField
            label="Gentag kodeord"
            type="password"
            value={newUser.password2}
            onChange={e => setNewUser({ ...newUser, password2: e.target.value })}
          />
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel id="rolle-label">Rolle</InputLabel>
            <Select
              labelId="rolle-label"
              value={newUser.role}
              label="Rolle"
              onChange={e => setNewUser({ ...newUser, role: e.target.value })}
            >
              <MenuItem value="administrator">Administrator</MenuItem>
              <MenuItem value="bruger">Bruger</MenuItem>
            </Select>
          </FormControl>
          {newUser.role === "bruger" && (
            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel id="skole-label">Skole</InputLabel>
              <Select
                labelId="skole-label"
                value={newUser.school_id}
                label="Skole"
                onChange={e => setNewUser({ ...newUser, school_id: e.target.value })}
              >
                {getSortedSchools().map(school => (
                  <MenuItem key={school.id} value={school.id}>{school.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
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
                <TableCell sx={{ fontWeight: 700 }}>Skole</TableCell>
                <TableCell sx={{ fontWeight: 700, textAlign: "right" }}>Handlinger</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loadingUsers ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : Array.isArray(users) && users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ color: "#888" }}>
                    Ingen brugere oprettet endnu
                  </TableCell>
                </TableRow>
              ) : (
                users.map(user => (
                  <TableRow key={user.id} hover>
                    <TableCell>{user.id}</TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>{user.role === "admin" ? "administrator" : "bruger"}</TableCell>
                    <TableCell>{user.is_active ? "Aktiv" : "Spærret"}</TableCell>
                    <TableCell>
                      {user.school_id
                        ? (schools.find(s => s.id === user.school_id)?.name ?? user.school_id)
                        : "-"}
                    </TableCell>
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
                          <IconButton color="error" onClick={() => handleOpenDeleteUserDialog(user)}>
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
                    <MenuItem value="administrator">Administrator</MenuItem>
                    <MenuItem value="bruger">Bruger</MenuItem>
                  </Select>
                </FormControl>
                {editUser.role === "bruger" && (
                  <FormControl fullWidth>
                    <InputLabel id="edit-skole-label">Skole</InputLabel>
                    <Select
                      labelId="edit-skole-label"
                      value={editUser.school_id || ""}
                      label="Skole"
                      onChange={e => setEditUser({ ...editUser, school_id: e.target.value })}
                    >
                      {getSortedSchools().map(school => (
                        <MenuItem key={school.id} value={school.id}>{school.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
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
                <TextField
                  label="Gentag nyt kodeord"
                  type="password"
                  value={editUser.password2 || ""}
                  onChange={e => setEditUser({ ...editUser, password2: e.target.value })}
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
      {/* SLET BRUGER DIALOG MED DOBBELT BEKRÆFTELSE */}
      <Dialog open={deleteUserDialogOpen} onClose={handleCloseDeleteUserDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Slet bruger: {userToDelete?.username}
        </DialogTitle>
        <DialogContent>
          <Typography color="error" gutterBottom sx={{ mb: 2 }}>
            Advarsel: Du er ved at slette brugeren <b>{userToDelete?.username}</b>.<br />
            Denne handling kan <b>ikke fortrydes!</b>
          </Typography>
          {deleteUserStep === 1 && (
            <Typography sx={{ mb: 2 }}>
              Er du sikker på at du vil slette denne bruger?
            </Typography>
          )}
          {deleteUserStep === 2 && (
            <Typography color="error" sx={{ mb: 2 }}>
              Tryk <b>Slet endeligt</b> for at bekræfte.
            </Typography>
          )}
          {deleteUserError && (
            <Typography color="error" sx={{ mb: 2 }}>
              {deleteUserError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteUserDialog}>Annuller</Button>
          {deleteUserStep === 1 ? (
            <Button color="warning" variant="contained" onClick={handleFirstDeleteUserConfirm}>
              Bekræft sletning
            </Button>
          ) : (
            <Button color="error" variant="contained" onClick={handleFinalDeleteUser}>
              Slet endeligt
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
