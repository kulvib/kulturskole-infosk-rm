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
  InputAdornment,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
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
    full_name: "",
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

  // VIS/SKJUL PASSWORD
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showEditPassword2, setShowEditPassword2] = useState(false);

  // SORTERING OG SØGNING FOR SKOLELISTE
  const [schoolSort, setSchoolSort] = useState({ direction: "asc" });
  const [schoolSearch, setSchoolSearch] = useState("");

  // SORTERING OG SØGNING FOR BRUGERLISTE
  const [userSort, setUserSort] = useState({ key: "username", direction: "asc" });
  const [userSearch, setUserSearch] = useState("");

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
    const { username, password, password2, full_name, role, is_active, school_id } = newUser;
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
      full_name,
      role: role === "administrator" ? "admin" : "bruger",
      is_active,
      school_id: role === "bruger" ? school_id : undefined
    }, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    })
      .then(res => {
        setUsers(Array.isArray(users) ? [...users, res.data] : [res.data]);
        setNewUser({ username: "", password: "", password2: "", full_name: "", role: "bruger", is_active: true, school_id: "" });
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
    if (!userToDelete || userToDelete.role === "admin") return;
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
    const { id, role, is_active, password, password2, full_name } = editUser;
    if (password && password !== password2) {
      setUserError("Kodeordene matcher ikke");
      showSnackbar("Kodeordene matcher ikke", "error");
      return;
    }
    axios.patch(`${API_URL}/api/users/${id}`, {
      role: role === "administrator" ? "admin" : "bruger",
      is_active,
      password: password ? password : undefined,
      full_name,
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

  // Helper: get sorted and searched schools
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

  // Helper: all dropdowns should be A-Å sorted (no search)
  const getAlphaSchools = () =>
    schools.slice().sort((a, b) => a.name.localeCompare(b.name, 'da', { sensitivity: 'base' }));

  // Helper: get sorted and searched users
  const getSortedUsers = () => {
    let arr = users.filter(u => {
      const schoolName = u.school_id
        ? (getAlphaSchools().find(s => s.id === u.school_id)?.name ?? "")
        : "";
      const search = userSearch.trim().toLowerCase();
      return (
        search === "" ||
        (u.username && u.username.toLowerCase().includes(search)) ||
        (u.full_name && u.full_name.toLowerCase().includes(search)) ||
        (u.role === "admin" ? "administrator" : "bruger").includes(search) ||
        schoolName.toLowerCase().includes(search)
      );
    });

    arr.sort((a, b) => {
      let aVal, bVal;
      switch (userSort.key) {
        case "username":
          aVal = a.username || "";
          bVal = b.username || "";
          break;
        case "fullname":
          aVal = a.full_name || "";
          bVal = b.full_name || "";
          break;
        case "role":
          aVal = a.role === "admin" ? "administrator" : "bruger";
          bVal = b.role === "admin" ? "administrator" : "bruger";
          break;
        case "status":
          aVal = a.is_active ? "Aktiv" : "Spærret";
          bVal = b.is_active ? "Aktiv" : "Spærret";
          break;
        case "school":
          aVal = a.school_id
            ? (getAlphaSchools().find(s => s.id === a.school_id)?.name ?? "")
            : "";
          bVal = b.school_id
            ? (getAlphaSchools().find(s => s.id === b.school_id)?.name ?? "")
            : "";
          break;
        default:
          aVal = a.username || "";
          bVal = b.username || "";
      }
      const cmp = (aVal || "").localeCompare(bVal || "", 'da', { sensitivity: 'base' });
      return userSort.direction === "asc" ? cmp : -cmp;
    });
    return arr;
  };

  // Helper for input alignment
  const inputSx = { minWidth: 180, my: 0 };

  // Handler for click on sort in table head
  const handleUserTableSort = (key) => {
    setUserSort(prev => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
    }));
  };

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

      {/* -------- PAPER 1 -------- */}
      <Paper sx={{ mb: 4, p: 3 }}>
        <Stack
          direction="row"
          gap={4}
          alignItems="flex-end"
          sx={{ width: "100%", flexWrap: "wrap" }}
        >
          {/* Venstre kolonne */}
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
          {/* Højre kolonne */}
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

      {/* -------- PAPER 2 -------- */}
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

      {/* -------- PAPER 3 -------- */}
      <Paper sx={{ mb: 4, p: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} gap={4} alignItems="flex-end">
          <Box sx={{ flex: 2, minWidth: 340 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Brugeradministration
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Opret, redigér og slet brugere (kræver admin-rettigheder)
            </Typography>
            {/* INPUT-FELTERNE */}
            <Stack direction="row" gap={2} alignItems="flex-end" sx={{ mb: 0 }}>
              <TextField
                label="Brugernavn"
                value={newUser.username}
                onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                size="small"
                sx={inputSx}
                fullWidth
              />
              <TextField
                label="Fuldt navn"
                value={newUser.full_name}
                onChange={e => setNewUser({ ...newUser, full_name: e.target.value })}
                size="small"
                sx={inputSx}
                fullWidth
              />
              <TextField
                label="Kodeord"
                type={showPassword ? "text" : "password"}
                value={newUser.password}
                onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                size="small"
                sx={inputSx}
                fullWidth
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((show) => !show)}
                        edge="end"
                        tabIndex={-1}
                        size="small"
                        sx={{ fontSize: 18 }}
                      >
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
              <TextField
                label="Gentag kodeord"
                type={showPassword2 ? "text" : "password"}
                value={newUser.password2}
                onChange={e => setNewUser({ ...newUser, password2: e.target.value })}
                size="small"
                sx={inputSx}
                fullWidth
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword2((show) => !show)}
                        edge="end"
                        tabIndex={-1}
                        size="small"
                        sx={{ fontSize: 18 }}
                      >
                        {showPassword2 ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
              <FormControl size="small" sx={inputSx} fullWidth>
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
                <FormControl size="small" sx={inputSx} fullWidth>
                  <InputLabel id="skole-label">Skole</InputLabel>
                  <Select
                    labelId="skole-label"
                    value={newUser.school_id}
                    label="Skole"
                    onChange={e => setNewUser({ ...newUser, school_id: e.target.value })}
                  >
                    {getAlphaSchools().map(school => (
                      <MenuItem key={school.id} value={school.id}>{school.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              <FormControl size="small" sx={inputSx} fullWidth>
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
            </Stack>
            {/* EN LINJE: Opret bruger (til venstre), søg+sortér (til højre) */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, mt: 2 }}>
              <Button variant="contained" onClick={handleAddUser}>
                Opret bruger
              </Button>
              <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                <TextField
                  label="Søg"
                  size="small"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  sx={{ minWidth: 120 }}
                  placeholder="Søg bruger, navn, rolle, skole..."
                />
              </Box>
            </Stack>
            {userError && <Typography color="error" sx={{ mb: 2 }}>{userError}</Typography>}
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{ fontWeight: 700, cursor: "pointer" }}
                      onClick={() => handleUserTableSort("username")}
                    >
                      Brugernavn
                      {userSort.key === "username" &&
                        (userSort.direction === "asc" ? <ArrowDownwardIcon fontSize="small" sx={{ verticalAlign: "middle" }} />
                          : <ArrowUpwardIcon fontSize="small" sx={{ verticalAlign: "middle" }} />)}
                    </TableCell>
                    <TableCell
                      sx={{ fontWeight: 700, cursor: "pointer" }}
                      onClick={() => handleUserTableSort("fullname")}
                    >
                      Fuldt navn
                      {userSort.key === "fullname" &&
                        (userSort.direction === "asc" ? <ArrowDownwardIcon fontSize="small" sx={{ verticalAlign: "middle" }} />
                          : <ArrowUpwardIcon fontSize="small" sx={{ verticalAlign: "middle" }} />)}
                    </TableCell>
                    <TableCell
                      sx={{ fontWeight: 700, cursor: "pointer" }}
                      onClick={() => handleUserTableSort("role")}
                    >
                      Rolle
                      {userSort.key === "role" &&
                        (userSort.direction === "asc" ? <ArrowDownwardIcon fontSize="small" sx={{ verticalAlign: "middle" }} />
                          : <ArrowUpwardIcon fontSize="small" sx={{ verticalAlign: "middle" }} />)}
                    </TableCell>
                    <TableCell
                      sx={{ fontWeight: 700, cursor: "pointer" }}
                      onClick={() => handleUserTableSort("status")}
                    >
                      Status
                      {userSort.key === "status" &&
                        (userSort.direction === "asc" ? <ArrowDownwardIcon fontSize="small" sx={{ verticalAlign: "middle" }} />
                          : <ArrowUpwardIcon fontSize="small" sx={{ verticalAlign: "middle" }} />)}
                    </TableCell>
                    <TableCell
                      sx={{ fontWeight: 700, cursor: "pointer" }}
                      onClick={() => handleUserTableSort("school")}
                    >
                      Skole
                      {userSort.key === "school" &&
                        (userSort.direction === "asc" ? <ArrowDownwardIcon fontSize="small" sx={{ verticalAlign: "middle" }} />
                          : <ArrowUpwardIcon fontSize="small" sx={{ verticalAlign: "middle" }} />)}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, textAlign: "right" }}>Handlinger</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loadingUsers ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <CircularProgress size={24} />
                      </TableCell>
                    </TableRow>
                  ) : getSortedUsers().length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ color: "#888" }}>
                        Ingen brugere oprettet endnu
                      </TableCell>
                    </TableRow>
                  ) : (
                    getSortedUsers().map(user => (
                      <TableRow key={user.id} hover>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>{user.full_name || ""}</TableCell>
                        <TableCell>{user.role === "admin" ? "administrator" : "bruger"}</TableCell>
                        <TableCell>{user.is_active ? "Aktiv" : "Spærret"}</TableCell>
                        <TableCell>
                          {user.school_id
                            ? (getAlphaSchools().find(s => s.id === user.school_id)?.name ?? user.school_id)
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
                          <Tooltip title={user.role === "admin" ? "Administrator kan ikke slettes" : "Slet bruger"}>
                            <span>
                              <IconButton
                                color="error"
                                onClick={() => handleOpenDeleteUserDialog(user)}
                                disabled={user.role === "admin"}
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
            {/* Dialog til redigering */}
            <Dialog open={userDialogOpen} onClose={() => setUserDialogOpen(false)}>
              <DialogTitle>Rediger bruger</DialogTitle>
              <DialogContent>
                {editUser && (
                  <Stack gap={2} sx={{ mt: 1 }}>
                    <TextField label="Brugernavn" value={editUser.username} disabled fullWidth size="small" sx={inputSx} />
                    <TextField
                      label="Fuldt navn"
                      value={editUser.full_name || ""}
                      onChange={e => setEditUser({ ...editUser, full_name: e.target.value })}
                      fullWidth
                      size="small"
                      sx={inputSx}
                    />
                    <FormControl fullWidth size="small" sx={inputSx}>
                      <InputLabel id="edit-rolle-label">Rolle</InputLabel>
                      <Select
                        labelId="edit-rolle-label"
                        value={editUser.role === "admin" ? "administrator" : "bruger"}
                        label="Rolle"
                        disabled={editUser.role === "admin"}
                        onChange={e => setEditUser({ ...editUser, role: e.target.value })}
                      >
                        <MenuItem value="administrator">Administrator</MenuItem>
                        <MenuItem value="bruger">Bruger</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl fullWidth size="small" sx={inputSx}>
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
                    {/* Vis kun kodeordsfelter hvis ikke admin */}
                    {editUser.role !== "admin" && (
                      <>
                        <TextField
                          label="Nyt kodeord"
                          type={showEditPassword ? "text" : "password"}
                          value={editUser.password || ""}
                          onChange={e => setEditUser({ ...editUser, password: e.target.value })}
                          fullWidth
                          size="small"
                          sx={inputSx}
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton
                                  onClick={() => setShowEditPassword((show) => !show)}
                                  edge="end"
                                  tabIndex={-1}
                                  size="small"
                                  sx={{ fontSize: 18 }}
                                >
                                  {showEditPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                </IconButton>
                              </InputAdornment>
                            )
                          }}
                        />
                        <TextField
                          label="Gentag nyt kodeord"
                          type={showEditPassword2 ? "text" : "password"}
                          value={editUser.password2 || ""}
                          onChange={e => setEditUser({ ...editUser, password2: e.target.value })}
                          fullWidth
                          size="small"
                          sx={inputSx}
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton
                                  onClick={() => setShowEditPassword2((show) => !show)}
                                  edge="end"
                                  tabIndex={-1}
                                  size="small"
                                  sx={{ fontSize: 18 }}
                                >
                                  {showEditPassword2 ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                </IconButton>
                              </InputAdornment>
                            )
                          }}
                        />
                      </>
                    )}
                  </Stack>
                )}
                {userError && <Typography color="error" sx={{ mt: 2 }}>{userError}</Typography>}
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setUserDialogOpen(false)}>Annuller</Button>
                <Button variant="contained" onClick={handleEditUser}>Gem ændringer</Button>
              </DialogActions>
            </Dialog>
          </Box>
        </Stack>
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
          {userToDelete?.role === "admin" && (
            <Typography color="error" sx={{ mb: 2 }}>
              Administrator-brugere kan ikke slettes.
            </Typography>
          )}
          {deleteUserStep === 1 && userToDelete?.role !== "admin" && (
            <Typography sx={{ mb: 2 }}>
              Er du sikker på at du vil slette denne bruger?
            </Typography>
          )}
          {deleteUserStep === 2 && userToDelete?.role !== "admin" && (
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
          {userToDelete?.role !== "admin" && (
            deleteUserStep === 1 ? (
              <Button color="warning" variant="contained" onClick={handleFirstDeleteUserConfirm}>
                Bekræft sletning
              </Button>
            ) : (
              <Button color="error" variant="contained" onClick={handleFinalDeleteUser}>
                Slet endeligt
              </Button>
            )
          )}
        </DialogActions>
      </Dialog>

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
    </Box>
  );
}
