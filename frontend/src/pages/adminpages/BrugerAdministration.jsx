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
  Chip,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import { getSchools, getUsers, createUser, updateUser as apiUpdateUser, deleteUser as apiDeleteUser } from "../../api";
import { useAuth } from "../../auth/authcontext";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_DISPLAY = {
  superadmin: "Superadministrator",
  admin: "Administrator",
  bruger: "Bruger",
  viewer: "Viewer (Se adgang)",
};

// Roller som en normal admin (ikke superadmin) må tildele
const ADMIN_ALLOWED_ROLES = ["admin", "bruger", "viewer"];

// ----------- Helper functions ----------- //
function generateSecurePassword() {
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  const specials = "!@#$%&*";
  const all = lower + upper + digits + specials;
  const array = new Uint32Array(16);
  crypto.getRandomValues(array);
  // Sørg for mindst ét tegn fra hver kategori
  let password = [
    lower[array[0] % lower.length],
    upper[array[1] % upper.length],
    digits[array[2] % digits.length],
    specials[array[3] % specials.length],
  ];
  for (let i = 4; i < 12; i++) {
    password.push(all[array[i] % all.length]);
  }
  // Bland ved hjælp af Fisher-Yates med kryptografisk random
  const shuffleArr = new Uint32Array(password.length);
  crypto.getRandomValues(shuffleArr);
  for (let i = password.length - 1; i > 0; i--) {
    const j = shuffleArr[i] % (i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }
  return password.join("");
}

// ----------- Main Component ----------- //
export default function BrugerAdministration() {
  const { isSuperadmin } = useAuth();

  // Rolle-muligheder baseret på den nuværende brugers rolle
  const availableRoles = isSuperadmin ? Object.keys(ROLE_DISPLAY) : ADMIN_ALLOWED_ROLES;

  // Hjælper: må current user administrere en given target-bruger?
  const canManageUser = (targetUser) => isSuperadmin || targetUser.role !== "superadmin";

  // ----------- State ----------- //
  const [users, setUsers] = useState([]);
  const [schools, setSchools] = useState([]);
  const [userError, setUserError] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingSchools, setLoadingSchools] = useState(false);

  const [userSort, setUserSort] = useState({ key: "username", direction: "asc" });
  const [userSearch, setUserSearch] = useState("");

  // --- New user state
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    full_name: "",
    role: "",
    is_active: true,
    school_id: "",
    remarks: "",
    email: "",
    confirmEmail: "",
  });
  const [newUserDownloadInfo, setNewUserDownloadInfo] = useState(null);
  const [showDownloadButton, setShowDownloadButton] = useState(false);
  const [downloadCountdown, setDownloadCountdown] = useState(10);
  const [savingNewUser, setSavingNewUser] = useState(false);

  // --- Brugeroplysningsdialog (viser login-oplysninger efter oprettelse/ændret password)
  const [userInfoDialogOpen, setUserInfoDialogOpen] = useState(false);
  const [userInfoDialogData, setUserInfoDialogData] = useState(null);

  // --- Edit user state (email fields isolated)
  const [editUser, setEditUser] = useState(null);
  const [editUserConfirmEmail, setEditUserConfirmEmail] = useState("");
  const [editUserEmailError, setEditUserEmailError] = useState("");
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [holdEditDialogOpen, setHoldEditDialogOpen] = useState(false);
  const [editUserDownloadInfo, setEditUserDownloadInfo] = useState(null);
  const [showEditDownloadButton, setShowEditDownloadButton] = useState(false);
  const [editDownloadCountdown, setEditDownloadCountdown] = useState(10);
  const [savingEditUser, setSavingEditUser] = useState(false);

  // --- Delete user state
  const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteUserError, setDeleteUserError] = useState("");
  const [deleteUserStep, setDeleteUserStep] = useState(1);

  // --- Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const showSnackbar = (message, severity = "success") =>
    setSnackbar({ open: true, message, severity });
  const handleCloseSnackbar = () =>
    setSnackbar({ open: false, message: "", severity: "success" });

  // ----------- Effects ----------- //
  useEffect(() => {
    setLoadingUsers(true);
    getUsers()
      .then(data => setUsers(Array.isArray(data) ? data : []))
      .catch(() => {
        setUsers([]);
        setUserError("Kunne ikke hente brugere (kun admin kan se listen)");
      })
      .finally(() => setLoadingUsers(false));
  }, []);

  useEffect(() => {
    setLoadingSchools(true);
    getSchools()
      .then(data => setSchools(Array.isArray(data) ? data : []))
      .catch(() => setSchools([]))
      .finally(() => setLoadingSchools(false));
  }, []);

  useEffect(() => {
    let timer;
    if (showDownloadButton && downloadCountdown > 0) {
      timer = setTimeout(() => setDownloadCountdown(val => val - 1), 1000);
    } else if (showDownloadButton && downloadCountdown === 0) {
      setShowDownloadButton(false);
      setNewUserDownloadInfo(null);
      setDownloadCountdown(10);
    }
    return () => clearTimeout(timer);
  }, [showDownloadButton, downloadCountdown]);

  useEffect(() => {
    let timer;
    if (showEditDownloadButton && editDownloadCountdown > 0) {
      setHoldEditDialogOpen(true);
      timer = setTimeout(() => setEditDownloadCountdown(val => val - 1), 1000);
    } else if (showEditDownloadButton && editDownloadCountdown === 0) {
      setShowEditDownloadButton(false);
      setEditUserDownloadInfo(null);
      setEditDownloadCountdown(10);
      setHoldEditDialogOpen(false);
      setUserDialogOpen(false);
    }
    return () => clearTimeout(timer);
  }, [showEditDownloadButton, editDownloadCountdown]);

  // ----------- Handlers ----------- //
  // --- Password generator ---
  const handleGeneratePassword = (forEdit = false) => {
    const password = generateSecurePassword();
    if (forEdit) {
      setEditUser(editUser => ({ ...editUser, password }));
      showSnackbar("Password genereret!", "info");
    } else {
      setNewUser(prev => ({ ...prev, password }));
      showSnackbar("Password genereret!", "info");
    }
  };

  // --- New User ---
  const handleAddUser = () => {
    setUserError("");
    setSavingNewUser(true);
    const { username, password, full_name, role, is_active, school_id, remarks, email, confirmEmail } = newUser;

    let missing = [];
    if (!username) missing.push("Brugernavn");
    if (!password) missing.push("Password");
    if (!full_name) missing.push("Fulde navn");
    if (!role) missing.push("Rolle");
    if (!email) missing.push("Email");
    if (!confirmEmail) missing.push("Bekræft email");
    if (role === "bruger" && !school_id) missing.push("Skole");

    if (email && confirmEmail && email !== confirmEmail) {
      setUserError("Email adresserne matcher ikke!");
      setSavingNewUser(false);
      showSnackbar("Email adresserne matcher ikke!", "error");
      return;
    }
    if (email && !emailRegex.test(email)) {
      setUserError("Ugyldig emailadresse!");
      setSavingNewUser(false);
      showSnackbar("Ugyldig emailadresse!", "error");
      return;
    }
    if (missing.length > 0) {
      setUserError(missing.join(", ") + " skal udfyldes");
      setSavingNewUser(false);
      showSnackbar(missing.join(", ") + " skal udfyldes", "error");
      return;
    }

    createUser({
      username,
      password,
      full_name,
      role,
      is_active,
      school_id: role === "bruger" ? school_id : undefined,
      remarks,
      email,
    })
      .then(data => {
        setUsers(Array.isArray(users) ? [...users, data] : [data]);
        setNewUser({
          username: "",
          password: "",
          full_name: "",
          role: "",
          is_active: true,
          school_id: "",
          remarks: "",
          email: "",
          confirmEmail: ""
        });
        showSnackbar("Bruger oprettet!", "success");
        const schoolName = role === "bruger"
          ? (schools.find(s => s.id === school_id)?.name ?? "")
          : "";
        setUserInfoDialogData({ full_name, username, password, schoolName, email });
        setUserInfoDialogOpen(true);
      })
      .catch(e => {
        setUserError(e.message || "Fejl ved oprettelse");
        showSnackbar("Fejl ved oprettelse af bruger", "error");
      }).finally(() => setSavingNewUser(false));
  };

  // --- Edit User ---
  const openEditUserDialog = (user) => {
    setEditUser({
      ...user,
      password: "",
    });
    setEditUserConfirmEmail(user.email || "");
    setEditUserEmailError("");
    setUserDialogOpen(true);
    setHoldEditDialogOpen(false);
    setUserError("");
    setShowEditDownloadButton(false);
    setEditUserDownloadInfo(null);
    setEditDownloadCountdown(10);
  };

  const handleEditUser = () => {
    if (!editUser) return;
    setSavingEditUser(true);
    const { id, role, is_active, password, full_name, school_id, remarks, username, email } = editUser;

    if (!email || !emailRegex.test(email)) {
      setEditUserEmailError("Ugyldig emailadresse!");
      setSavingEditUser(false);
      showSnackbar("Ugyldig emailadresse!", "error");
      return;
    }
    if (email !== editUserConfirmEmail) {
      setEditUserEmailError("Email adresserne matcher ikke!");
      setSavingEditUser(false);
      showSnackbar("Email adresserne matcher ikke!", "error");
      return;
    }
    if (!full_name) {
      setUserError("Fulde navn skal udfyldes");
      setSavingEditUser(false);
      showSnackbar("Fulde navn skal udfyldes", "error");
      return;
    }
    apiUpdateUser(id, {
      role,
      is_active,
      password: password || undefined,
      full_name,
      school_id: role === "bruger" ? school_id : undefined,
      remarks,
      email,
    })
      .then(data => {
        setUsers(users.map(u => u.id === data.id ? data : u));
        setUserError("");
        setEditUserEmailError("");
        showSnackbar("Bruger opdateret!", "success");
        const schoolName = role === "bruger" && school_id
          ? (schools.find(s => s.id === school_id)?.name ?? "")
          : "";
        if (password) {
          setUserInfoDialogData({ full_name, username, password, schoolName, email });
          setUserInfoDialogOpen(true);
        }
        setUserDialogOpen(false);
      })
      .catch(e => {
        setUserError(e.message || "Fejl ved opdatering");
        showSnackbar("Fejl ved opdatering af bruger", "error");
      }).finally(() => setSavingEditUser(false));
  };

  // --- Delete User ---
  const handleOpenDeleteUserDialog = (user) => {
    setUserToDelete(user);
    setDeleteUserDialogOpen(true);
    setDeleteUserError("");
    setDeleteUserStep(1);
  };
  const handleFirstDeleteUserConfirm = () => setDeleteUserStep(2);
  const handleFinalDeleteUser = () => {
    if (!userToDelete) return;
    apiDeleteUser(userToDelete.id)
      .then(() => {
        setUsers(users.filter(u => u.id !== userToDelete.id));
        setDeleteUserDialogOpen(false);
        setUserToDelete(null);
        setDeleteUserStep(1);
        showSnackbar("Bruger slettet!", "success");
      })
      .catch(e => {
        setDeleteUserError("Kunne ikke slette bruger: " + (e.message || ""));
        showSnackbar("Fejl ved sletning af bruger", "error");
      });
  };
  const handleCloseDeleteUserDialog = () => {
    setDeleteUserDialogOpen(false);
    setUserToDelete(null);
    setDeleteUserError("");
    setDeleteUserStep(1);
  };

  // --- Sorting, filtering ---
  const getAlphaSchools = () =>
    schools.slice().sort((a, b) => a.name.localeCompare(b.name, 'da', { sensitivity: 'base' }));

  const getSortedUsers = () => {
    let arr = users.filter(u => {
      const schoolName = u.school_id
        ? (schools.find(s => s.id === u.school_id)?.name ?? "")
        : "";
      const search = userSearch.trim().toLowerCase();
      return (
        search === "" ||
        (u.username && u.username.toLowerCase().includes(search)) ||
        (u.full_name && u.full_name.toLowerCase().includes(search)) ||
        (u.email && u.email.toLowerCase().includes(search)) ||
        (ROLE_DISPLAY[u.role] || u.role || "").toLowerCase().includes(search) ||
        schoolName.toLowerCase().includes(search) ||
        (u.remarks && u.remarks.toLowerCase().includes(search))
      );
    });

    arr.sort((a, b) => {
      let aVal, bVal;
      switch (userSort.key) {
        case "username": aVal = a.username || ""; bVal = b.username || ""; break;
        case "fullname": aVal = a.full_name || ""; bVal = b.full_name || ""; break;
        case "role": aVal = ROLE_DISPLAY[a.role] || a.role || "";
          bVal = ROLE_DISPLAY[b.role] || b.role || ""; break;
        case "school": aVal = a.school_id ? (schools.find(s => s.id === a.school_id)?.name ?? "") : "";
          bVal = b.school_id ? (schools.find(s => s.id === b.school_id)?.name ?? "") : ""; break;
        case "email": aVal = a.email || ""; bVal = b.email || ""; break;
        default: aVal = a.username || ""; bVal = b.username || "";
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

  // ----------- Render ----------- //
  return (
    <Box>
      <Paper sx={{ mb: 4, p: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} gap={4} alignItems="flex-end">
          <Box sx={{ flex: 2, minWidth: 340 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Brugeradministration
            </Typography>
            {/* Opret bruger-formular */}
            <Grid container spacing={2} sx={{ mb: 1 }}>
              {/* Linje 1 */}
              <Grid item xs={12} md={3}>
                <TextField required label="Brugernavn" value={newUser.username}
                  onChange={e => setNewUser({ ...newUser, username: e.target.value })} size="small" fullWidth />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField required label="Fulde navn" value={newUser.full_name}
                  onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} size="small" fullWidth />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl size="small" fullWidth required>
                  <InputLabel id="rolle-label">Rolle</InputLabel>
                  <Select
                    labelId="rolle-label"
                    value={newUser.role}
                    label="Rolle"
                    required
                    onChange={e => setNewUser({ ...newUser, role: e.target.value, school_id: "" })}
                  >
                    {availableRoles.map(role => (
                      <MenuItem key={role} value={role}>{ROLE_DISPLAY[role]}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                {newUser.role === "bruger" ? (
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
                ) : (
                  <Box />
                )}
              </Grid>
              {/* Linje 2 */}
              <Grid item xs={12} md={3}>
                <TextField required label="Email" type="email" value={newUser.email}
                  onChange={e => setNewUser({ ...newUser, email: e.target.value })} size="small" fullWidth
                  error={!!(newUser.email && !emailRegex.test(newUser.email))}
                  helperText={newUser.email && !emailRegex.test(newUser.email) ? "Ugyldig emailadresse" : ""} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField required label="Bekræft email" type="email" value={newUser.confirmEmail}
                  onChange={e => setNewUser({ ...newUser, confirmEmail: e.target.value })} size="small" fullWidth
                  error={!!(newUser.confirmEmail && newUser.email !== newUser.confirmEmail)}
                  helperText={newUser.confirmEmail && newUser.email !== newUser.confirmEmail ? "Email adresserne matcher ikke" : ""} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField label="Password" value={newUser.password} required type="text"
                  size="small" fullWidth disabled placeholder="Password" />
              </Grid>
              <Grid item xs={12} md={3} sx={{ display: "flex", alignItems: "center" }}>
                <Button variant="outlined" color="primary"
                  onClick={() => handleGeneratePassword(false)}
                  sx={{ mr: 2 }} disabled={savingNewUser} fullWidth>
                  Generer password
                </Button>
              </Grid>
              {/* Linje 3 */}
              <Grid item xs={12}>
                <TextField label="Bemærkninger" value={newUser.remarks || ""}
                  onChange={e => setNewUser({ ...newUser, remarks: e.target.value })} size="small"
                  fullWidth multiline minRows={1} maxRows={3} />
              </Grid>
            </Grid>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, mt: 2 }}>
              <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                <Button variant="contained" onClick={handleAddUser} disabled={savingNewUser}>
                  {savingNewUser ? <CircularProgress size={24} color="inherit" /> : "Opret bruger"}
                </Button>
              </Box>
              <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                <TextField label="Søg" size="small" value={userSearch}
                  onChange={e => setUserSearch(e.target.value)} sx={{ minWidth: 120 }}
                  placeholder="Søg bruger, navn, rolle, email, skole, bemærkninger..." />
              </Box>
            </Stack>
            {userError && <Typography color="error" sx={{ mb: 2 }}>
              {typeof userError === "object" ? JSON.stringify(userError) : userError}
            </Typography>}
            {/* Brugertabel */}
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, cursor: "pointer" }} onClick={() => handleUserTableSort("username")}>
                      Brugernavn
                      {userSort.key === "username" &&
                        (userSort.direction === "asc"
                          ? <ArrowDownwardIcon fontSize="small" sx={{ verticalAlign: "middle" }} />
                          : <ArrowUpwardIcon fontSize="small" sx={{ verticalAlign: "middle" }} />)}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, cursor: "pointer" }} onClick={() => handleUserTableSort("fullname")}>
                      Fulde navn
                      {userSort.key === "fullname" &&
                        (userSort.direction === "asc"
                          ? <ArrowDownwardIcon fontSize="small" sx={{ verticalAlign: "middle" }} />
                          : <ArrowUpwardIcon fontSize="small" sx={{ verticalAlign: "middle" }} />)}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, cursor: "pointer" }} onClick={() => handleUserTableSort("email")}>
                      Email
                      {userSort.key === "email" &&
                        (userSort.direction === "asc"
                          ? <ArrowDownwardIcon fontSize="small" sx={{ verticalAlign: "middle" }} />
                          : <ArrowUpwardIcon fontSize="small" sx={{ verticalAlign: "middle" }} />)}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, cursor: "pointer" }} onClick={() => handleUserTableSort("role")}>
                      Rolle
                      {userSort.key === "role" &&
                        (userSort.direction === "asc"
                          ? <ArrowDownwardIcon fontSize="small" sx={{ verticalAlign: "middle" }} />
                          : <ArrowUpwardIcon fontSize="small" sx={{ verticalAlign: "middle" }} />)}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, cursor: "pointer" }} onClick={() => handleUserTableSort("school")}>
                      Skole
                      {userSort.key === "school" &&
                        (userSort.direction === "asc"
                          ? <ArrowDownwardIcon fontSize="small" sx={{ verticalAlign: "middle" }} />
                          : <ArrowUpwardIcon fontSize="small" sx={{ verticalAlign: "middle" }} />)}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Bemærkninger</TableCell>
                    <TableCell sx={{ fontWeight: 700, textAlign: "right" }}>Handlinger</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loadingUsers ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center">
                        <CircularProgress size={24} />
                      </TableCell>
                    </TableRow>
                  ) : getSortedUsers().length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ color: "#888" }}>
                        Ingen brugere oprettet endnu
                      </TableCell>
                    </TableRow>
                  ) : (
                    getSortedUsers().map(user => (
                      <TableRow key={user.id} hover>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>{user.full_name || ""}</TableCell>
                        <TableCell>{user.email || ""}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={ROLE_DISPLAY[user.role] || user.role}
                            color={user.role === "superadmin" ? "error" : user.role === "admin" ? "warning" : "default"}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          {user.school_id
                            ? (schools.find(s => s.id === user.school_id)?.name ?? user.school_id)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {user.is_active ? "Aktiv" : "Spærret"}
                        </TableCell>
                        <TableCell>{user.remarks || ""}</TableCell>
                        <TableCell align="right">
                          {canManageUser(user) ? (
                            <>
                              <Tooltip title="Rediger bruger">
                                <span>
                                  <IconButton onClick={() => openEditUserDialog(user)}>
                                    <EditIcon />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title="Slet bruger">
                                <span>
                                  <IconButton
                                    color="error"
                                    onClick={() => handleOpenDeleteUserDialog(user)}
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </>
                          ) : (
                            <Tooltip title="Kun superadministratorer kan administrere denne bruger">
                              <span>
                                <IconButton disabled>
                                  <EditIcon />
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
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
                    <TextField label="Brugernavn" value={editUser.username} disabled fullWidth size="small" />
                    <TextField required label="Fulde navn" value={editUser.full_name || ""}
                      onChange={e => setEditUser({ ...editUser, full_name: e.target.value })} fullWidth size="small" />
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <TextField required label="Email" type="email"
                          value={editUser.email || ""}
                          onChange={e => setEditUser({ ...editUser, email: e.target.value })}
                          fullWidth size="small"
                          error={!!(editUser.email && !emailRegex.test(editUser.email))}
                          helperText={editUser.email && !emailRegex.test(editUser.email) ? "Ugyldig emailadresse" : ""}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField required label="Bekræft email" type="email"
                          value={editUserConfirmEmail || ""}
                          onChange={e => setEditUserConfirmEmail(e.target.value)}
                          fullWidth size="small"
                          error={!!(editUser.email && editUser.email !== editUserConfirmEmail)}
                          helperText={editUser.email && editUser.email !== editUserConfirmEmail ? "Email adresserne matcher ikke" : ""}
                        />
                      </Grid>
                    </Grid>
                    <FormControl fullWidth size="small">
                      <InputLabel id="edit-rolle-label">Rolle</InputLabel>
                      <Select
                        labelId="edit-rolle-label"
                        value={editUser.role || ""}
                        label="Rolle"
                        onChange={e => {
                          const value = e.target.value;
                          setEditUser(prev => ({
                            ...prev,
                            role: value,
                            school_id: value === "bruger" ? prev.school_id : ""
                          }));
                        }}
                        disabled={savingEditUser}
                      >
                        {availableRoles.map(role => (
                          <MenuItem key={role} value={role}>{ROLE_DISPLAY[role]}</MenuItem>
                        ))}
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
                          disabled={savingEditUser}
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
                        disabled={savingEditUser}
                      >
                        <MenuItem value="true">Aktiv</MenuItem>
                        <MenuItem value="false">Spærret</MenuItem>
                      </Select>
                    </FormControl>
                    <TextField label="Bemærkninger" value={editUser.remarks || ""}
                      onChange={e => setEditUser({ ...editUser, remarks: e.target.value })}
                      fullWidth size="small" multiline minRows={1} maxRows={3} disabled={savingEditUser} />
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <TextField label="Password" type="text" value={editUser.password || ""}
                          disabled fullWidth size="small" />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Button variant="outlined" color="primary"
                          onClick={() => handleGeneratePassword(true)} disabled={savingEditUser} fullWidth>
                          Generer password
                        </Button>
                      </Grid>
                    </Grid>
                    {/* Adgangskodedialoget vises udenfor Rediger-dialog */}
                  </Stack>
                )}
                {(userError || editUserEmailError) &&
                  <Typography color="error" sx={{ mt: 2 }}>
                    {userError || editUserEmailError}
                  </Typography>}
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setUserDialogOpen(false)} disabled={savingEditUser}>Annuller</Button>
                <Button variant="contained" onClick={handleEditUser} disabled={savingEditUser}>
                  {savingEditUser ? <CircularProgress size={24} color="inherit" /> : "Gem ændringer"}
                </Button>
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
          {userToDelete && (
            <>
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
            </>
          )}
          {deleteUserError && (
            <Typography color="error" sx={{ mb: 2 }}>
              {deleteUserError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteUserDialog}>Annuller</Button>
          {userToDelete && (
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
      {/* Login-oplysninger dialog — vises efter oprettelse eller adgangskodeskift */}
      <Dialog open={userInfoDialogOpen} onClose={() => setUserInfoDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Loginoplysninger for {userInfoDialogData?.full_name}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Brugernavn: <strong>{userInfoDialogData?.username}</strong>
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Adgangskode: <strong>{userInfoDialogData?.password}</strong>
          </Typography>
          {userInfoDialogData?.schoolName && (
            <Typography variant="body2" sx={{ mb: 1 }}>
              Skole: <strong>{userInfoDialogData.schoolName}</strong>
            </Typography>
          )}
          <Typography variant="body2" sx={{ mb: 1 }}>
            Email: <strong>{userInfoDialogData?.email}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Notér venligst disse oplysninger — adgangskoden vises ikke igen.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setUserInfoDialogOpen(false)}>
            Luk
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
