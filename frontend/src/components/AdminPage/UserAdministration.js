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
  Grid,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import axios from "axios";

const API_URL = "https://kulturskole-infosk-rm.onrender.com";

function generateSecurePassword() {
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  const specials = "!@#$%&*";
  let password = "";
  password += lower[Math.floor(Math.random() * lower.length)];
  password += upper[Math.floor(Math.random() * upper.length)];
  password += digits[Math.floor(Math.random() * digits.length)];
  for (let i = 0; i < Math.floor(Math.random() * 2) + 1; i++) {
    password += specials[Math.floor(Math.random() * specials.length)];
  }
  const all = lower + upper + digits + specials;
  for (let i = password.length; i < 12; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

export default function UserAdministration() {
  const [users, setUsers] = useState([]);
  const [userError, setUserError] = useState("");
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    full_name: "",
    role: "",
    is_active: true,
    school_id: "",
    remarks: "",
  });
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteUserError, setDeleteUserError] = useState("");
  const [deleteUserStep, setDeleteUserStep] = useState(1);

  const [userSort, setUserSort] = useState({ key: "username", direction: "asc" });
  const [userSearch, setUserSearch] = useState("");

  const [schools, setSchools] = useState([]);
  const [loadingSchools, setLoadingSchools] = useState(false);

  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const showSnackbar = (message, severity = "success") => setSnackbar({ open: true, message, severity });
  const handleCloseSnackbar = () => setSnackbar({ open: false, message: "", severity: "success" });

  const [newUserDownloadInfo, setNewUserDownloadInfo] = useState(null);
  const [showDownloadButton, setShowDownloadButton] = useState(false);
  const [downloadCountdown, setDownloadCountdown] = useState(10);

  const [editUserDownloadInfo, setEditUserDownloadInfo] = useState(null);
  const [showEditDownloadButton, setShowEditDownloadButton] = useState(false);
  const [editDownloadCountdown, setEditDownloadCountdown] = useState(10);

  useEffect(() => {
    setLoadingUsers(true);
    axios.get(`${API_URL}/api/users/`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    })
      .then(res => {
        // Map "admin" to "administrator" for dropdown
        setUsers(
          Array.isArray(res.data)
            ? res.data.map(u => ({
                ...u,
                role: u.role === "admin" ? "administrator" : u.role,
              }))
            : []
        );
      })
      .catch(() => {
        setUsers([]);
        setUserError("Kunne ikke hente brugere (kun admin kan se listen)");
      }).finally(() => setLoadingUsers(false));
  }, []);

  useEffect(() => {
    setLoadingSchools(true);
    axios.get(`${API_URL}/api/schools/`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    })
      .then(res => setSchools(Array.isArray(res.data) ? res.data : []))
      .catch(() => setSchools([]))
      .finally(() => setLoadingSchools(false));
  }, []);

  useEffect(() => {
    let timer;
    if (showDownloadButton && downloadCountdown > 0) {
      timer = setTimeout(() => setDownloadCountdown(downloadCountdown - 1), 1000);
    } else if (downloadCountdown === 0) {
      setShowDownloadButton(false);
      setNewUserDownloadInfo(null);
      setDownloadCountdown(10);
    }
    return () => clearTimeout(timer);
  }, [showDownloadButton, downloadCountdown]);

  useEffect(() => {
    let timer;
    if (showEditDownloadButton && editDownloadCountdown > 0) {
      timer = setTimeout(() => setEditDownloadCountdown(editDownloadCountdown - 1), 1000);
    } else if (editDownloadCountdown === 0) {
      setShowEditDownloadButton(false);
      setEditUserDownloadInfo(null);
      setEditDownloadCountdown(10);
    }
    return () => clearTimeout(timer);
  }, [showEditDownloadButton, editDownloadCountdown]);

  const handleGeneratePassword = (forEdit = false) => {
    const password = generateSecurePassword();
    if (forEdit) {
      setEditUser(editUser => {
        const updated = { ...editUser, password };
        // Prepare download info
        const schoolName =
          updated.role === "bruger" && updated.school_id
            ? (getAlphaSchools().find(s => s.id === updated.school_id)?.name ?? "")
            : "";
        setEditUserDownloadInfo({
          full_name: updated.full_name,
          username: updated.username,
          password,
          schoolName,
        });
        setShowEditDownloadButton(true);
        setEditDownloadCountdown(10);
        showSnackbar("Kodeord genereret!", "info");
        return updated;
      });
    } else {
      setNewUser(prev => {
        const updated = { ...prev, password };
        const schoolName =
          updated.role === "bruger" && updated.school_id
            ? (getAlphaSchools().find(s => s.id === updated.school_id)?.name ?? "")
            : "";
        setNewUserDownloadInfo({
          full_name: updated.full_name,
          username: updated.username,
          password,
          schoolName,
        });
        setShowDownloadButton(true);
        setDownloadCountdown(10);
        showSnackbar("Kodeord genereret!", "info");
        return updated;
      });
    }
  };

  const triggerDownloadUserInfo = (info) => {
    const fileName = info.full_name.trim().replace(/\s+/g, "_") + ".txt";
    const content = `Fulde navn: ${info.full_name}
Skole: ${info.schoolName}
Brugernavn: ${info.username}
Kodeord: ${info.password}
`;
    const blob = new Blob([content], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => document.body.removeChild(link), 100);
  };

  const handleAddUser = () => {
    setUserError("");
    const { username, password, full_name, role, is_active, school_id, remarks } = newUser;
    if (!username || !password) {
      setUserError("Brugernavn og kodeord skal udfyldes");
      showSnackbar("Brugernavn og kodeord skal udfyldes", "error");
      return;
    }
    if (!full_name) {
      setUserError("Fuldt navn skal udfyldes");
      showSnackbar("Fuldt navn skal udfyldes", "error");
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
      school_id: role === "bruger" ? school_id : undefined,
      remarks,
    }, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    })
      .then(res => {
        setUsers(Array.isArray(users) ? [...users, {
          ...res.data,
          role: res.data.role === "admin" ? "administrator" : res.data.role
        }] : [{
          ...res.data,
          role: res.data.role === "admin" ? "administrator" : res.data.role
        }]);
        setNewUser({ username: "", password: "", full_name: "", role: "", is_active: true, school_id: "", remarks: "" });
        showSnackbar("Bruger oprettet!", "success");
        setShowDownloadButton(false);
        setNewUserDownloadInfo(null);
        setDownloadCountdown(10);
      })
      .catch(e => {
        setUserError(e.response?.data?.detail || e.message || "Fejl ved oprettelse");
        showSnackbar("Fejl ved oprettelse af bruger", "error");
      });
  };

  const openEditUserDialog = (user) => {
    // Map "admin" to "administrator"
    const mappedUser = {
      ...user,
      role: user.role === "admin" ? "administrator" : user.role,
      password: "",
    };
    setEditUser(mappedUser);
    setUserDialogOpen(true);
    setUserError("");
    setShowEditDownloadButton(false);
    setEditUserDownloadInfo(null);
    setEditDownloadCountdown(10);
  };

  const handleEditUser = () => {
    if (!editUser) return;
    const { id, role, is_active, password, full_name, school_id, remarks, username } = editUser;
    if (!full_name) {
      setUserError("Fuldt navn skal udfyldes");
      showSnackbar("Fuldt navn skal udfyldes", "error");
      return;
    }
    axios.patch(`${API_URL}/api/users/${id}`, {
      role: role === "administrator" ? "admin" : "bruger",
      is_active,
      password,
      full_name,
      school_id: role === "bruger" ? school_id : undefined,
      remarks,
    }, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    })
      .then(res => {
        setUsers(Array.isArray(users)
          ? users.map(u => u.id === res.data.id
              ? { ...res.data, role: res.data.role === "admin" ? "administrator" : res.data.role }
              : u)
          : []);
        setUserDialogOpen(false);
        setEditUser(null);
        showSnackbar("Bruger opdateret!", "success");
        // Download info skal vises
        const schoolName =
          role === "bruger" && school_id
            ? (getAlphaSchools().find(s => s.id === school_id)?.name ?? "")
            : "";
        setEditUserDownloadInfo({
          full_name,
          username,
          password,
          schoolName,
        });
        setShowEditDownloadButton(true);
        setEditDownloadCountdown(10);
      })
      .catch(e => {
        setUserError(e.response?.data?.detail || e.message || "Fejl ved opdatering");
        showSnackbar("Fejl ved opdatering af bruger", "error");
      });
  };

  const getAlphaSchools = () =>
    schools.slice().sort((a, b) => a.name.localeCompare(b.name, 'da', { sensitivity: 'base' }));

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
        (u.role === "administrator" ? "administrator" : "bruger").includes(search) ||
        schoolName.toLowerCase().includes(search) ||
        (u.remarks && u.remarks.toLowerCase().includes(search))
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
          aVal = a.role === "administrator" ? "administrator" : "bruger";
          bVal = b.role === "administrator" ? "administrator" : "bruger";
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

  const handleUserTableSort = (key) => {
    setUserSort(prev => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
    }));
  };

  return (
    <Box sx={{}}>
      <Paper sx={{ mb: 4, p: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} gap={4} alignItems="flex-end">
          <Box sx={{ flex: 2, minWidth: 340 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Brugeradministration
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Opret, redigér og slet brugere (kræver admin-rettigheder)
            </Typography>
            <Grid container spacing={2} sx={{ mb: 1 }}>
              {/* Første linje */}
              <Grid item xs={12} md={4}>
                <TextField
                  required
                  label="Brugernavn"
                  value={newUser.username}
                  onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                  size="small"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  required
                  label="Fuldt navn"
                  value={newUser.full_name}
                  onChange={e => setNewUser({ ...newUser, full_name: e.target.value })}
                  size="small"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl size="small" fullWidth>
                  <InputLabel id="rolle-label">Rolle</InputLabel>
                  <Select
                    labelId="rolle-label"
                    value={newUser.role}
                    label="Rolle"
                    onChange={e => setNewUser({ ...newUser, role: e.target.value, school_id: "" })}
                  >
                    <MenuItem value="">Vælg rolle...</MenuItem>
                    <MenuItem value="administrator">Administrator</MenuItem>
                    <MenuItem value="bruger">Bruger</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {/* Anden linje */}
              <Grid item xs={12} md={4} sx={{ display: "flex", alignItems: "center" }}>
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={() => handleGeneratePassword(false)}
                  sx={{ mr: 2 }}
                >
                  Generer kodeord
                </Button>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  required
                  label="Kodeord"
                  type="text"
                  value={newUser.password}
                  disabled
                  size="small"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={4}>
                {newUser.role === "bruger" && (
                  <FormControl size="small" fullWidth>
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
              </Grid>
              {/* Tredje linje */}
              <Grid item xs={12} md={12}>
                <TextField
                  label="Bemærkninger"
                  value={newUser.remarks || ""}
                  onChange={e => setNewUser({ ...newUser, remarks: e.target.value })}
                  size="small"
                  fullWidth
                  multiline
                  minRows={1}
                  maxRows={3}
                />
              </Grid>
            </Grid>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, mt: 2 }}>
              <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                <Button variant="contained" onClick={handleAddUser}>
                  Opret bruger
                </Button>
                {showDownloadButton && newUserDownloadInfo && (
                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={() => triggerDownloadUserInfo(newUserDownloadInfo)}
                  >
                    Download brugerinfo ({downloadCountdown})
                  </Button>
                )}
              </Box>
              <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                <TextField
                  label="Søg"
                  size="small"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  sx={{ minWidth: 120 }}
                  placeholder="Søg bruger, navn, rolle, skole, bemærkninger..."
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
                      onClick={() => handleUserTableSort("school")}
                    >
                      Skole
                      {userSort.key === "school" &&
                        (userSort.direction === "asc" ? <ArrowDownwardIcon fontSize="small" sx={{ verticalAlign: "middle" }} />
                          : <ArrowUpwardIcon fontSize="small" sx={{ verticalAlign: "middle" }} />)}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      Status
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      Bemærkninger
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, textAlign: "right" }}>
                      Handlinger
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loadingUsers ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        <CircularProgress size={24} />
                      </TableCell>
                    </TableRow>
                  ) : getSortedUsers().length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ color: "#888" }}>
                        Ingen brugere oprettet endnu
                      </TableCell>
                    </TableRow>
                  ) : (
                    getSortedUsers().map(user => (
                      <TableRow key={user.id} hover>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>{user.full_name || ""}</TableCell>
                        <TableCell>{user.role === "administrator" ? "administrator" : "bruger"}</TableCell>
                        <TableCell>
                          {user.school_id
                            ? (getAlphaSchools().find(s => s.id === user.school_id)?.name ?? user.school_id)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {user.is_active ? "Aktiv" : "Spærret"}
                        </TableCell>
                        <TableCell>{user.remarks || ""}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Rediger bruger">
                            <span>
                              <IconButton onClick={() => openEditUserDialog(user)}>
                                <EditIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={user.role === "administrator" ? "Administrator kan ikke slettes" : "Slet bruger"}>
                            <span>
                              <IconButton
                                color="error"
                                onClick={() => handleOpenDeleteUserDialog(user)}
                                disabled={user.role === "administrator"}
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
            {/* Rediger bruger dialog */}
            <Dialog
              open={userDialogOpen}
              onClose={() => setUserDialogOpen(false)}
              maxWidth="sm"
              fullWidth
              sx={{ '& .MuiDialog-paper': { width: '110%' } }}
            >
              <DialogTitle>Rediger bruger</DialogTitle>
              <DialogContent>
                {editUser && (
                  <Stack gap={2} sx={{ mt: 1 }}>
                    <TextField
                      label="Brugernavn"
                      value={editUser.username}
                      disabled
                      fullWidth
                      size="small"
                    />
                    <TextField
                      required
                      label="Fuldt navn"
                      value={editUser.full_name || ""}
                      onChange={e => setEditUser({ ...editUser, full_name: e.target.value })}
                      fullWidth
                      size="small"
                    />
                    <FormControl fullWidth size="small">
                      <InputLabel id="edit-rolle-label">Rolle</InputLabel>
                      <Select
                        labelId="edit-rolle-label"
                        value={editUser.role}
                        label="Rolle"
                        disabled={editUser.role === "administrator"}
                        onChange={e => {
                          const value = e.target.value;
                          setEditUser(prev => ({
                            ...prev,
                            role: value,
                            school_id: value === "bruger" ? prev.school_id : ""
                          }));
                        }}
                      >
                        <MenuItem value="">Vælg rolle...</MenuItem>
                        <MenuItem value="administrator">Administrator</MenuItem>
                        <MenuItem value="bruger">Bruger</MenuItem>
                      </Select>
                    </FormControl>
                    {editUser.role === "bruger" && (
                      <FormControl fullWidth size="small">
                        <InputLabel id="edit-skole-label">Skole</InputLabel>
                        <Select
                          labelId="edit-skole-label"
                          value={editUser.school_id || ""}
                          label="Skole"
                          onChange={e => setEditUser({ ...editUser, school_id: e.target.value })}
                        >
                          {getAlphaSchools().map(school => (
                            <MenuItem key={school.id} value={school.id}>{school.name}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                    <FormControl fullWidth size="small">
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
                      label="Bemærkninger"
                      value={editUser.remarks || ""}
                      onChange={e => setEditUser({ ...editUser, remarks: e.target.value })}
                      fullWidth
                      size="small"
                      multiline
                      minRows={1}
                      maxRows={3}
                    />
                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={() => handleGeneratePassword(true)}
                    >
                      Generer kodeord
                    </Button>
                    <TextField
                      label="Kodeord"
                      type="text"
                      value={editUser.password || ""}
                      disabled
                      fullWidth
                      size="small"
                    />
                    {showEditDownloadButton && editUserDownloadInfo && (
                      <Button
                        variant="outlined"
                        color="primary"
                        onClick={() => triggerDownloadUserInfo(editUserDownloadInfo)}
                      >
                        Download brugerinfo ({editDownloadCountdown})
                      </Button>
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
      <Dialog open={deleteUserDialogOpen} onClose={handleCloseDeleteUserDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Slet bruger: {userToDelete?.username}
        </DialogTitle>
        <DialogContent>
          <Typography color="error" gutterBottom sx={{ mb: 2 }}>
            Advarsel: Du er ved at slette brugeren <b>{userToDelete?.username}</b>.<br />
            Denne handling kan <b>ikke fortrydes!</b>
          </Typography>
          {userToDelete?.role === "administrator" && (
            <Typography color="error" sx={{ mb: 2 }}>
              Administrator-brugere kan ikke slettes.
            </Typography>
          )}
          {deleteUserStep === 1 && userToDelete?.role !== "administrator" && (
            <Typography sx={{ mb: 2 }}>
              Er du sikker på at du vil slette denne bruger?
            </Typography>
          )}
          {deleteUserStep === 2 && userToDelete?.role !== "administrator" && (
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
          {userToDelete?.role !== "administrator" && (
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
    </Box>
  );
}
