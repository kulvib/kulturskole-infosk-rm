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
import AddIcon from "@mui/icons-material/Add";
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
const USER_TABLE_COLUMN_COUNT = 9;

// ----------- Helper functions ----------- //
function generateSecurePassword() {
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  const specials = "!@#$%&*";
  const all = lower + upper + digits + specials;
  const array = new Uint32Array(16);
  crypto.getRandomValues(array);
  let password = [
    lower[array[0] % lower.length],
    upper[array[1] % upper.length],
    digits[array[2] % digits.length],
    specials[array[3] % specials.length],
  ];
  for (let i = 4; i < 12; i++) {
    password.push(all[array[i] % all.length]);
  }
  const shuffleArr = new Uint32Array(password.length);
  crypto.getRandomValues(shuffleArr);
  for (let i = password.length - 1; i > 0; i--) {
    const j = shuffleArr[i] % (i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }
  return password.join("");
}

function formatCreatedAt(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("da-DK");
}

const EMPTY_NEW_USER = {
  username: "",
  password: "",
  full_name: "",
  role: "",
  is_active: true,
  school_id: "",
  remarks: "",
  email: "",
  confirmEmail: "",
};

// ----------- Main Component ----------- //
export default function BrugerAdministration() {
  const { isSuperadmin } = useAuth();
  const availableRoles = isSuperadmin ? Object.keys(ROLE_DISPLAY) : ADMIN_ALLOWED_ROLES;
  const canManageUser = (targetUser) => isSuperadmin || targetUser.role !== "superadmin";

  // ----------- State ----------- //
  const [users, setUsers] = useState([]);
  const [schools, setSchools] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSort, setUserSort] = useState({ key: "username", direction: "asc" });
  const [userSearch, setUserSearch] = useState("");

  // Opret bruger dialog
  const [opretDialogOpen, setOpretDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState(EMPTY_NEW_USER);
  const [newUserError, setNewUserError] = useState("");
  const [savingNewUser, setSavingNewUser] = useState(false);

  // Login-oplysninger dialog
  const [userInfoDialogOpen, setUserInfoDialogOpen] = useState(false);
  const [userInfoDialogData, setUserInfoDialogData] = useState(null);

  // Rediger bruger dialog
  const [editUser, setEditUser] = useState(null);
  const [editUserConfirmEmail, setEditUserConfirmEmail] = useState("");
  const [editUserEmailError, setEditUserEmailError] = useState("");
  const [editUserError, setEditUserError] = useState("");
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [savingEditUser, setSavingEditUser] = useState(false);

  // Slet bruger dialog
  const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteUserError, setDeleteUserError] = useState("");
  const [deleteUserStep, setDeleteUserStep] = useState(1);

  // Snackbar
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
        showSnackbar("Kunne ikke hente brugere (kun admin kan se listen)", "error");
      })
      .finally(() => setLoadingUsers(false));
  }, []);

  useEffect(() => {
    getSchools()
      .then(data => setSchools(Array.isArray(data) ? data : []))
      .catch(() => setSchools([]));
  }, []);

  // ----------- Handlers ----------- //

  const handleGeneratePassword = (forEdit = false) => {
    const password = generateSecurePassword();
    if (forEdit) {
      setEditUser(prev => ({ ...prev, password }));
    } else {
      setNewUser(prev => ({ ...prev, password }));
    }
    showSnackbar("Adgangskode genereret!", "info");
  };

  // --- Opret bruger ---
  const handleOpenOpretDialog = () => {
    setNewUser(EMPTY_NEW_USER);
    setNewUserError("");
    setOpretDialogOpen(true);
  };

  const handleCloseOpretDialog = () => {
    if (savingNewUser) return;
    setOpretDialogOpen(false);
    setNewUser(EMPTY_NEW_USER);
    setNewUserError("");
  };

  const handleAddUser = () => {
    setNewUserError("");
    const { username, password, full_name, role, is_active, school_id, remarks, email, confirmEmail } = newUser;

    const missing = [];
    if (!username) missing.push("Brugernavn");
    if (!full_name) missing.push("Fulde navn");
    if (!email) missing.push("Email");
    if (!confirmEmail) missing.push("Bekræft email");
    if (!role) missing.push("Rolle");
    if (role === "bruger" && !school_id) missing.push("Skole");
    if (!password) missing.push("Adgangskode (tryk 'Generer adgangskode')");

    if (email && !emailRegex.test(email)) {
      const msg = "Ugyldig emailadresse!";
      setNewUserError(msg);
      showSnackbar(msg, "error");
      return;
    }
    if (email && confirmEmail && email !== confirmEmail) {
      const msg = "Email adresserne matcher ikke!";
      setNewUserError(msg);
      showSnackbar(msg, "error");
      return;
    }
    if (missing.length > 0) {
      const msg = missing.join(", ") + " skal udfyldes";
      setNewUserError(msg);
      showSnackbar(msg, "error");
      return;
    }

    setSavingNewUser(true);
    createUser({
      username,
      password,
      full_name,
      role,
      is_active,
      school_id: role === "bruger" ? school_id : undefined,
      remarks: remarks || undefined,
      email,
    })
      .then(data => {
        setUsers(prev => Array.isArray(prev) ? [...prev, data] : [data]);
        showSnackbar("Bruger oprettet!", "success");
        const schoolName = role === "bruger"
          ? (schools.find(s => s.id === school_id)?.name ?? "")
          : "";
        setUserInfoDialogData({ full_name, username, password, schoolName, email });
        setUserInfoDialogOpen(true);
        setOpretDialogOpen(false);
        setNewUser(EMPTY_NEW_USER);
      })
      .catch(e => {
        const msg = e.message || "Fejl ved oprettelse";
        setNewUserError(msg);
        showSnackbar("Fejl ved oprettelse af bruger: " + msg, "error");
      })
      .finally(() => setSavingNewUser(false));
  };

  // --- Rediger bruger ---
  const openEditUserDialog = (user) => {
    setEditUser({ ...user, password: "" });
    setEditUserConfirmEmail(user.email || "");
    setEditUserEmailError("");
    setEditUserError("");
    setUserDialogOpen(true);
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
      setEditUserError("Fulde navn skal udfyldes");
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
      remarks: remarks || undefined,
      email,
    })
      .then(data => {
        setUsers(prev => prev.map(u => u.id === data.id ? data : u));
        setEditUserEmailError("");
        setEditUserError("");
        showSnackbar("Bruger opdateret!", "success");
        if (password) {
          const schoolName = role === "bruger" && school_id
            ? (schools.find(s => s.id === school_id)?.name ?? "")
            : "";
          setUserInfoDialogData({ full_name, username, password, schoolName, email });
          setUserInfoDialogOpen(true);
        }
        setUserDialogOpen(false);
      })
      .catch(e => {
        const msg = e.message || "Fejl ved opdatering";
        setEditUserError(msg);
        showSnackbar("Fejl ved opdatering af bruger: " + msg, "error");
      })
      .finally(() => setSavingEditUser(false));
  };

  // --- Slet bruger ---
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
        setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
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

  // --- Sortering og filtrering ---
  const getAlphaSchools = () =>
    schools.slice().sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" }));

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
        case "role":
          aVal = ROLE_DISPLAY[a.role] || a.role || "";
          bVal = ROLE_DISPLAY[b.role] || b.role || ""; break;
        case "school":
          aVal = a.school_id ? (schools.find(s => s.id === a.school_id)?.name ?? "") : "";
          bVal = b.school_id ? (schools.find(s => s.id === b.school_id)?.name ?? "") : ""; break;
        case "email": aVal = a.email || ""; bVal = b.email || ""; break;
        default: aVal = a.username || ""; bVal = b.username || "";
      }
      const cmp = (aVal || "").localeCompare(bVal || "", "da", { sensitivity: "base" });
      return userSort.direction === "asc" ? cmp : -cmp;
    });
    return arr;
  };

  const handleUserTableSort = (key) => {
    setUserSort(prev => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const sortIcon = (key) => {
    if (userSort.key !== key) return null;
    return userSort.direction === "asc"
      ? <ArrowDownwardIcon fontSize="small" sx={{ verticalAlign: "middle" }} />
      : <ArrowUpwardIcon fontSize="small" sx={{ verticalAlign: "middle" }} />;
  };

  // ----------- Delte formular-felter (identisk rækkefølge i opret og rediger) ----------- //
  // Felter til "Opret ny bruger"-dialog
  const opretFormFields = (
    <Stack gap={2} sx={{ mt: 1 }}>
      {/* 1. Brugernavn */}
      <TextField
        required
        label="Brugernavn"
        value={newUser.username}
        onChange={e => setNewUser(prev => ({ ...prev, username: e.target.value }))}
        fullWidth
        size="small"
        disabled={savingNewUser}
        autoFocus
      />
      {/* 2. Fulde navn */}
      <TextField
        required
        label="Fulde navn"
        value={newUser.full_name}
        onChange={e => setNewUser(prev => ({ ...prev, full_name: e.target.value }))}
        fullWidth
        size="small"
        disabled={savingNewUser}
      />
      {/* 3. Email + Bekræft email */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TextField
            required
            label="Email"
            type="email"
            value={newUser.email}
            onChange={e => setNewUser(prev => ({ ...prev, email: e.target.value }))}
            fullWidth
            size="small"
            disabled={savingNewUser}
            error={!!(newUser.email && !emailRegex.test(newUser.email))}
            helperText={newUser.email && !emailRegex.test(newUser.email) ? "Ugyldig emailadresse" : ""}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            required
            label="Bekræft email"
            type="email"
            value={newUser.confirmEmail}
            onChange={e => setNewUser(prev => ({ ...prev, confirmEmail: e.target.value }))}
            fullWidth
            size="small"
            disabled={savingNewUser}
            error={!!(newUser.confirmEmail && newUser.email !== newUser.confirmEmail)}
            helperText={newUser.confirmEmail && newUser.email !== newUser.confirmEmail ? "Email adresserne matcher ikke" : ""}
          />
        </Grid>
      </Grid>
      {/* 4. Rolle */}
      <FormControl fullWidth size="small" required>
        <InputLabel id="opret-rolle-label">Rolle</InputLabel>
        <Select
          labelId="opret-rolle-label"
          value={newUser.role}
          label="Rolle"
          onChange={e => setNewUser(prev => ({ ...prev, role: e.target.value, school_id: "" }))}
          disabled={savingNewUser}
        >
          {availableRoles.map(role => (
            <MenuItem key={role} value={role}>{ROLE_DISPLAY[role]}</MenuItem>
          ))}
        </Select>
      </FormControl>
      {/* 5. Skole (kun hvis rolle=bruger) */}
      {newUser.role === "bruger" && (
        <FormControl fullWidth size="small" required>
          <InputLabel id="opret-skole-label">Skole</InputLabel>
          <Select
            labelId="opret-skole-label"
            value={newUser.school_id}
            label="Skole"
            onChange={e => setNewUser(prev => ({ ...prev, school_id: e.target.value }))}
            disabled={savingNewUser}
          >
            {getAlphaSchools().map(school => (
              <MenuItem key={school.id} value={school.id}>{school.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
      {/* 6. Status */}
      <FormControl fullWidth size="small">
        <InputLabel id="opret-status-label">Status</InputLabel>
        <Select
          labelId="opret-status-label"
          value={newUser.is_active ? "true" : "false"}
          label="Status"
          onChange={e => setNewUser(prev => ({ ...prev, is_active: e.target.value === "true" }))}
          disabled={savingNewUser}
        >
          <MenuItem value="true">Aktiv</MenuItem>
          <MenuItem value="false">Spærret</MenuItem>
        </Select>
      </FormControl>
      {/* 7. Bemærkninger */}
      <TextField
        label="Bemærkninger"
        value={newUser.remarks || ""}
        onChange={e => setNewUser(prev => ({ ...prev, remarks: e.target.value }))}
        fullWidth
        size="small"
        multiline
        minRows={1}
        maxRows={3}
        disabled={savingNewUser}
      />
      {/* 8. Adgangskode + generator */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TextField
            label="Adgangskode"
            type="text"
            value={newUser.password}
            disabled
            fullWidth
            size="small"
            helperText={!newUser.password ? "Klik 'Generer adgangskode' for at oprette en sikker adgangskode" : ""}
          />
        </Grid>
        <Grid item xs={12} md={6} sx={{ display: "flex", alignItems: "center" }}>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => handleGeneratePassword(false)}
            disabled={savingNewUser}
            fullWidth
          >
            Generer adgangskode
          </Button>
        </Grid>
      </Grid>
      {newUserError && (
        <Typography color="error" variant="body2">{newUserError}</Typography>
      )}
    </Stack>
  );

  // ----------- Render ----------- //
  return (
    <Box>
      <Paper sx={{ mb: 4, p: 3 }}>
        {/* Overskrift + søgefelt + opret-knap */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          gap={2}
          sx={{ mb: 2 }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Brugeradministration
          </Typography>
          <Stack direction="row" gap={2} alignItems="center" flexWrap="wrap">
            <TextField
              label="Søg"
              size="small"
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              sx={{ minWidth: 200 }}
              placeholder="Søg bruger, navn, rolle, email..."
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenOpretDialog}
            >
              Opret ny bruger
            </Button>
          </Stack>
        </Stack>

        {/* Brugertabel */}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{ fontWeight: 700, cursor: "pointer" }}
                  onClick={() => handleUserTableSort("username")}
                >
                  Brugernavn {sortIcon("username")}
                </TableCell>
                <TableCell
                  sx={{ fontWeight: 700, cursor: "pointer" }}
                  onClick={() => handleUserTableSort("fullname")}
                >
                  Fulde navn {sortIcon("fullname")}
                </TableCell>
                <TableCell
                  sx={{ fontWeight: 700, cursor: "pointer" }}
                  onClick={() => handleUserTableSort("email")}
                >
                  Email {sortIcon("email")}
                </TableCell>
                <TableCell
                  sx={{ fontWeight: 700, cursor: "pointer" }}
                  onClick={() => handleUserTableSort("role")}
                >
                  Rolle {sortIcon("role")}
                </TableCell>
                <TableCell
                  sx={{ fontWeight: 700, cursor: "pointer" }}
                  onClick={() => handleUserTableSort("school")}
                >
                  Skole {sortIcon("school")}
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Oprettet</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Bemærkninger</TableCell>
                <TableCell sx={{ fontWeight: 700, textAlign: "right" }}>Handlinger</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loadingUsers ? (
                <TableRow>
                  <TableCell colSpan={USER_TABLE_COLUMN_COUNT} align="center">
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : getSortedUsers().length === 0 ? (
                <TableRow>
                  <TableCell colSpan={USER_TABLE_COLUMN_COUNT} align="center" sx={{ color: "#888" }}>
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
                        color={
                          user.role === "superadmin" ? "error"
                          : user.role === "admin" ? "warning"
                          : "default"
                        }
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {user.school_id
                        ? (schools.find(s => s.id === user.school_id)?.name ?? user.school_id)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={user.is_active ? "Aktiv" : "Spærret"}
                        color={user.is_active ? "success" : "default"}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{formatCreatedAt(user.created_at)}</TableCell>
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
      </Paper>

      {/* ===== Opret ny bruger dialog ===== */}
      <Dialog
        open={opretDialogOpen}
        onClose={handleCloseOpretDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Opret ny bruger</DialogTitle>
        <DialogContent>{opretFormFields}</DialogContent>
        <DialogActions>
          <Button onClick={handleCloseOpretDialog} disabled={savingNewUser}>
            Annuller
          </Button>
          <Button
            variant="contained"
            onClick={handleAddUser}
            disabled={savingNewUser || !newUser.password}
          >
            {savingNewUser ? <CircularProgress size={24} color="inherit" /> : "Opret bruger"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Rediger bruger dialog ===== */}
      <Dialog
        open={userDialogOpen}
        onClose={() => !savingEditUser && setUserDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Rediger bruger</DialogTitle>
        <DialogContent>
          {editUser && (
            <Stack gap={2} sx={{ mt: 1 }}>
              {/* 1. Brugernavn (ikke redigerbart) */}
              <TextField
                label="Brugernavn"
                value={editUser.username}
                disabled
                fullWidth
                size="small"
              />
              {/* 2. Fulde navn */}
              <TextField
                required
                label="Fulde navn"
                value={editUser.full_name || ""}
                onChange={e => setEditUser(prev => ({ ...prev, full_name: e.target.value }))}
                fullWidth
                size="small"
                disabled={savingEditUser}
              />
              {/* 3. Email + Bekræft email */}
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    required
                    label="Email"
                    type="email"
                    value={editUser.email || ""}
                    onChange={e => setEditUser(prev => ({ ...prev, email: e.target.value }))}
                    fullWidth
                    size="small"
                    disabled={savingEditUser}
                    error={!!(editUser.email && !emailRegex.test(editUser.email))}
                    helperText={editUser.email && !emailRegex.test(editUser.email) ? "Ugyldig emailadresse" : ""}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    required
                    label="Bekræft email"
                    type="email"
                    value={editUserConfirmEmail || ""}
                    onChange={e => setEditUserConfirmEmail(e.target.value)}
                    fullWidth
                    size="small"
                    disabled={savingEditUser}
                    error={!!(editUser.email && editUser.email !== editUserConfirmEmail)}
                    helperText={editUser.email && editUser.email !== editUserConfirmEmail ? "Email adresserne matcher ikke" : ""}
                  />
                </Grid>
              </Grid>
              {/* 4. Rolle */}
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
                      school_id: value === "bruger" ? prev.school_id : "",
                    }));
                  }}
                  disabled={savingEditUser}
                >
                  {availableRoles.map(role => (
                    <MenuItem key={role} value={role}>{ROLE_DISPLAY[role]}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              {/* 5. Skole (kun hvis rolle=bruger) */}
              {editUser.role === "bruger" && (
                <FormControl fullWidth size="small">
                  <InputLabel id="edit-skole-label">Skole</InputLabel>
                  <Select
                    labelId="edit-skole-label"
                    value={editUser.school_id || ""}
                    label="Skole"
                    onChange={e => setEditUser(prev => ({ ...prev, school_id: e.target.value }))}
                    disabled={savingEditUser}
                  >
                    {getAlphaSchools().map(school => (
                      <MenuItem key={school.id} value={school.id}>{school.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              {/* 6. Status */}
              <FormControl fullWidth size="small">
                <InputLabel id="edit-status-label">Status</InputLabel>
                <Select
                  labelId="edit-status-label"
                  value={editUser.is_active ? "true" : "false"}
                  label="Status"
                  onChange={e => setEditUser(prev => ({ ...prev, is_active: e.target.value === "true" }))}
                  disabled={savingEditUser}
                >
                  <MenuItem value="true">Aktiv</MenuItem>
                  <MenuItem value="false">Spærret</MenuItem>
                </Select>
              </FormControl>
              {/* 7. Bemærkninger */}
              <TextField
                label="Bemærkninger"
                value={editUser.remarks || ""}
                onChange={e => setEditUser(prev => ({ ...prev, remarks: e.target.value }))}
                fullWidth
                size="small"
                multiline
                minRows={1}
                maxRows={3}
                disabled={savingEditUser}
              />
              {/* 8. Adgangskode + generator */}
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Adgangskode"
                    type="text"
                    value={editUser.password || ""}
                    disabled
                    fullWidth
                    size="small"
                    helperText="Generer kun ny adgangskode hvis den skal nulstilles"
                  />
                </Grid>
                <Grid item xs={12} md={6} sx={{ display: "flex", alignItems: "center" }}>
                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={() => handleGeneratePassword(true)}
                    disabled={savingEditUser}
                    fullWidth
                  >
                    Generer adgangskode
                  </Button>
                </Grid>
              </Grid>
              {(editUserError || editUserEmailError) && (
                <Typography color="error" variant="body2">
                  {editUserError || editUserEmailError}
                </Typography>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserDialogOpen(false)} disabled={savingEditUser}>
            Annuller
          </Button>
          <Button variant="contained" onClick={handleEditUser} disabled={savingEditUser}>
            {savingEditUser ? <CircularProgress size={24} color="inherit" /> : "Gem ændringer"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Slet bruger dialog ===== */}
      <Dialog open={deleteUserDialogOpen} onClose={handleCloseDeleteUserDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Slet bruger: {userToDelete?.username}</DialogTitle>
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
            <Typography color="error" variant="body2">{deleteUserError}</Typography>
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

      {/* ===== Snackbar ===== */}
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

      {/* ===== Login-oplysninger dialog ===== */}
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
