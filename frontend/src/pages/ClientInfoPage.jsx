import React, { useState, useEffect, useRef, useCallback, memo } from "react";
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
  Chip,
  TextField,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import DevicesIcon from "@mui/icons-material/Devices";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import { Link } from "react-router-dom";
import {
  getClients,
  getMyClients,
  approveClient,
  removeClient,
  updateClient,
  getSchools,
} from "../api";
import { useAuth } from "../auth/authcontext";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

/*
  ClientInfoPage.jsx

  Formål:
  - Viser godkendte klienter.
  - Viser nye/pending klienter fra enrollment/installationskode-flow.
  - Godkender pending klienter med skolevalg.
  - Fjerner klienter med robust loading/error-flow.

  Relevante forbedringer:
  - Pending/enrollment-klienter viser nu lokalitet tydeligt.
  - Pending-listen sorteres med nyeste klienter først.
  - Slet/fjern har loading state og lukker kun dialog ved succes.
  - Fjern opdaterer UI optimistisk og henter derefter listen igen.
  - Baggrundspolling spammer ikke snackbar.
  - Polling pauser under drag/sort.
*/

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(isoDate) {
  if (!isoDate) return { date: "", time: "" };

  const raw = String(isoDate);
  const dateObj = new Date(
    raw.endsWith("Z") || /[+\-]\d{2}:?\d{2}$/.test(raw) ? raw : raw + "Z"
  );

  if (Number.isNaN(dateObj.getTime())) {
    return { date: "", time: "" };
  }

  const formatter = new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(dateObj);
  const get = (type) => parts.find((p) => p.type === type)?.value || "";

  return {
    date: `${get("day")}-${get("month")}-${get("year")}`,
    time: `Kl. ${get("hour")}:${get("minute")}:${get("second")}`,
  };
}

function getTimestampMs(value) {
  if (!value) return 0;
  const raw = String(value);
  const d = new Date(
    raw.endsWith("Z") || /[+\-]\d{2}:?\d{2}$/.test(raw) ? raw : raw + "Z"
  );
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function getClientSchoolId(client) {
  return client?.school_id ?? client?.schoolId ?? "";
}

function getClientDisplayName(client) {
  return client?.name || client?.hostname || `Klient #${client?.id ?? "?"}`;
}

function getClientLocality(client) {
  return client?.locality || client?.location || "";
}

function getClientStatusChipProps(status) {
  const value = String(status || "").toLowerCase();

  if (value === "approved") {
    return { label: "Godkendt", color: "success" };
  }

  if (value === "pending" || value === "awaiting_approval") {
    return { label: "Afventer", color: "warning" };
  }

  if (value === "rejected" || value === "disabled") {
    return { label: "Deaktiveret", color: "default" };
  }

  return { label: status || "Ukendt", color: "default" };
}

// Sammenlign kun felter, der bruges på denne oversigt.
// uptime og last_seen ændres ofte via heartbeat, men vises ikke her.
function isClientListEqual(a = [], b = []) {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    const ca = a[i] || {};
    const cb = b[i] || {};

    if (
      ca.id !== cb.id ||
      ca.name !== cb.name ||
      ca.hostname !== cb.hostname ||
      ca.locality !== cb.locality ||
      ca.location !== cb.location ||
      ca.status !== cb.status ||
      ca.sort_order !== cb.sort_order ||
      ca.isOnline !== cb.isOnline ||
      String(getClientSchoolId(ca)) !== String(getClientSchoolId(cb)) ||

      // Felter vist for ikke-godkendte/enrollment klienter
      ca.wifi_ip_address !== cb.wifi_ip_address ||
      ca.lan_ip_address !== cb.lan_ip_address ||
      ca.wifi_mac_address !== cb.wifi_mac_address ||
      ca.lan_mac_address !== cb.lan_mac_address ||
      ca.machine_id !== cb.machine_id ||
      ca.created_at !== cb.created_at
    ) {
      return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Sub-komponenter
// ---------------------------------------------------------------------------

const CopyIconButton = memo(function CopyIconButton({
  value,
  disabled,
  iconSize = 16,
}) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    if (disabled || value === null || value === undefined || value === "") return;
    const text = String(value);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  return (
    <Tooltip title={copied ? "Kopieret!" : "Kopiér"}>
      <span>
        <IconButton
          size="small"
          onClick={handleCopy}
          sx={{ ml: 0.5, p: 0.2 }}
          disabled={disabled}
        >
          <ContentCopyIcon
            sx={{ fontSize: iconSize * 0.96 }}
            color={copied ? "success" : "inherit"}
          />
        </IconButton>
      </span>
    </Tooltip>
  );
});

const ClientStatusCell = memo(function ClientStatusCell({ isOnline }) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 48,
        height: 20,
        borderRadius: "12px",
        bgcolor: isOnline
          ? theme.palette.success.main
          : theme.palette.error.main,
        color: "#fff",
        fontWeight: 400,
        fontSize: 13,
        boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
      }}
    >
      {isOnline ? "online" : "offline"}
    </Box>
  );
});

const EnrollmentIdentityCell = memo(function EnrollmentIdentityCell({ client }) {
  const locality = getClientLocality(client);
  const machineId = client?.machine_id || "";

  return (
    <Stack spacing={0.35}>
      <Stack direction="row" spacing={0.75} alignItems="center">
        <DevicesIcon sx={{ fontSize: 17, color: "primary.main" }} />
        <Typography sx={{ fontWeight: 700 }}>
          {getClientDisplayName(client)}
        </Typography>
      </Stack>

      <Stack direction="row" spacing={0.75} alignItems="center">
        <LocationOnIcon sx={{ fontSize: 16, color: "text.secondary" }} />
        <Typography variant="body2" color={locality ? "text.primary" : "text.secondary"}>
          {locality || "Ingen lokation angivet"}
        </Typography>
      </Stack>

      {machineId && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ wordBreak: "break-all" }}
        >
          Machine ID: {machineId}
          <CopyIconButton value={machineId} iconSize={13} />
        </Typography>
      )}
    </Stack>
  );
});

// ---------------------------------------------------------------------------
// Hoved-komponent
// ---------------------------------------------------------------------------

export default function ClientInfoPage() {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [clients, setClients] = useState([]);
  const [schools, setSchools] = useState([]);
  const [schoolSelections, setSchoolSelections] = useState({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dragClients, setDragClients] = useState([]);
  const [savingSort, setSavingSort] = useState(false);

  const [removingClientId, setRemovingClientId] = useState(null);
  const [approvingClientId, setApprovingClientId] = useState(null);

  const lastFetchedClients = useRef([]);
  const isDraggingRef = useRef(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmClientId, setConfirmClientId] = useState(null);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const showSnackbar = useCallback((message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const handleCloseSnackbar = useCallback(() => {
    setSnackbar({ open: false, message: "", severity: "success" });
  }, []);

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const selectedClientForRemoval =
    clients.find((client) => client.id === confirmClientId) || null;

  // ---------------------------------------------------------------------------
  // Data-hentning
  // ---------------------------------------------------------------------------

  const fetchClients = useCallback(
    async (forceUpdate = false, showLoading = false) => {
      if (isDraggingRef.current) return;

      if (showLoading) setLoading(true);
      try {
        const data =
          user?.role === "bruger"
            ? await getMyClients()
            : await getClients();

        if (
          forceUpdate ||
          !isClientListEqual(data, lastFetchedClients.current)
        ) {
          setClients(data);
          lastFetchedClients.current = data;
        }
      } catch (err) {
        if (forceUpdate || showLoading) {
          showSnackbar("Fejl: " + (err?.message || err), "error");
        }
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [user?.role, showSnackbar]
  );

  // Initial load + polling hvert 5s
  useEffect(() => {
    fetchClients(false, true);
    const timer = setInterval(() => {
      fetchClients(false, false);
    }, 5000);
    return () => clearInterval(timer);
  }, [fetchClients]);

  // Hent skoler
  useEffect(() => {
    getSchools()
      .then(setSchools)
      .catch(() => setSchools([]));
  }, []);

  // Opdater dragClients når clients ændres
  useEffect(() => {
    if (isDraggingRef.current) return;

    const approved = clients
      .filter((c) => c.status === "approved")
      .slice()
      .sort((a, b) => {
        const aHas =
          a.sort_order !== null && a.sort_order !== undefined;
        const bHas =
          b.sort_order !== null && b.sort_order !== undefined;
        if (aHas && bHas) return a.sort_order - b.sort_order;
        if (aHas) return -1;
        if (bHas) return 1;
        return a.id - b.id;
      });

    setDragClients(approved);
  }, [clients]);

  // Pending/enrollment-klienter: nyeste først.
  const unapprovedClients = clients
    .filter((c) => c.status !== "approved")
    .slice()
    .sort((a, b) => {
      const byCreated = getTimestampMs(b.created_at) - getTimestampMs(a.created_at);
      if (byCreated !== 0) return byCreated;
      return (b.id || 0) - (a.id || 0);
    });

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchClients(true, true);
      showSnackbar("Opdateret!", "success");
    } finally {
      setRefreshing(false);
    }
  }, [fetchClients, showSnackbar]);

  const openRemoveDialog = useCallback((clientId) => {
    setConfirmClientId(clientId);
    setConfirmDeleteText("");
    setConfirmOpen(true);
  }, []);

  const closeRemoveDialog = useCallback(() => {
    if (removingClientId) return;
    setConfirmOpen(false);
    setConfirmClientId(null);
    setConfirmDeleteText("");
  }, [removingClientId]);

  const handleRemoveClient = useCallback(
    async (clientId) => {
      setRemovingClientId(clientId);

      try {
        await removeClient(clientId);

        // Optimistisk fjern fra UI med det samme.
        setClients((prev) => {
          const next = prev.filter((client) => client.id !== clientId);
          lastFetchedClients.current = next;
          return next;
        });
        setDragClients((prev) => prev.filter((client) => client.id !== clientId));

        showSnackbar("Klient fjernet!", "success");
        setConfirmOpen(false);
        setConfirmClientId(null);
        setConfirmDeleteText("");

        // Hent endelig sandhed fra backend.
        await fetchClients(true, false);
      } catch (err) {
        showSnackbar(
          "Kunne ikke fjerne klient: " + (err?.message || err),
          "error"
        );
      } finally {
        setRemovingClientId(null);
      }
    },
    [fetchClients, showSnackbar]
  );

  const confirmRemoveClient = useCallback(async () => {
    if (confirmClientId !== null && confirmClientId !== undefined) {
      await handleRemoveClient(confirmClientId);
    }
  }, [confirmClientId, handleRemoveClient]);

  const onDragStart = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  const onDragEnd = useCallback(
    async (result) => {
      if (!result.destination) {
        isDraggingRef.current = false;
        return;
      }

      if (result.destination.index === result.source.index) {
        isDraggingRef.current = false;
        return;
      }

      const reordered = Array.from(dragClients);
      const [removed] = reordered.splice(result.source.index, 1);
      reordered.splice(result.destination.index, 0, removed);

      // Opdater UI øjeblikkeligt, men hold polling pauset indtil save er færdig.
      setDragClients(reordered);
      setSavingSort(true);

      try {
        await Promise.all(
          reordered.map((client, i) =>
            updateClient(client.id, { sort_order: i + 1 })
          )
        );

        showSnackbar("Sortering opdateret!", "success");

        isDraggingRef.current = false;
        await fetchClients(true, false);
      } catch (err) {
        showSnackbar(
          "Kunne ikke opdatere sortering: " + (err?.message || err),
          "error"
        );

        isDraggingRef.current = false;
        await fetchClients(true, false);
      } finally {
        isDraggingRef.current = false;
        setSavingSort(false);
      }
    },
    [dragClients, fetchClients, showSnackbar]
  );

  const handleSchoolChange = useCallback((clientId, schoolId) => {
    setSchoolSelections((prev) => ({ ...prev, [clientId]: schoolId }));
  }, []);

  const handleApproveClient = useCallback(
    async (clientId) => {
      const school_id = schoolSelections[clientId];

      if (!school_id) {
        showSnackbar("Vælg en skole først!", "warning");
        return;
      }

      setApprovingClientId(clientId);

      try {
        await approveClient(clientId, school_id);
        showSnackbar("Klient godkendt!", "success");

        setSchoolSelections((prev) => {
          const next = { ...prev };
          delete next[clientId];
          return next;
        });

        await fetchClients(true, true);
      } catch (err) {
        showSnackbar(
          "Kunne ikke godkende klient: " + (err?.message || err),
          "error"
        );
      } finally {
        setApprovingClientId(null);
      }
    },
    [schoolSelections, fetchClients, showSnackbar]
  );

  const getSchoolName = useCallback(
    (schoolId) => {
      const school = schools.find((s) => String(s.id) === String(schoolId));
      return school ? (
        school.name
      ) : (
        <span style={{ color: "#888" }}>Ingen skole</span>
      );
    },
    [schools]
  );

  // ---------------------------------------------------------------------------
  // Mobil-række renderer
  // ---------------------------------------------------------------------------
  const renderMobileRow = useCallback(
    (client, _idx, provided, snapshot) => (
      <TableRow
        ref={provided?.innerRef}
        {...(provided ? provided.draggableProps : {})}
        style={{
          ...provided?.draggableProps?.style,
          background: snapshot?.isDragging ? "#e3f2fd" : undefined,
        }}
        hover
      >
        {isAdmin && <TableCell>{client.id}</TableCell>}
        <TableCell>
          <Stack direction="column" spacing={0.5}>
            <Typography sx={{ fontWeight: 600 }}>{client.name}</Typography>
            {client.locality && (
              <Typography sx={{ fontSize: "0.92em", color: "#888" }}>
                {client.locality}
              </Typography>
            )}
            <Typography sx={{ fontSize: "0.92em" }}>
              {getSchoolName(getClientSchoolId(client))}
            </Typography>
          </Stack>
        </TableCell>
        <TableCell align="center">
          <ClientStatusCell isOnline={client.isOnline} />
        </TableCell>
        <TableCell align="center">
          <Tooltip title="Info">
            <IconButton
              component={Link}
              to={`/clients/${client.id}`}
              color="primary"
              size="small"
            >
              <InfoIcon />
            </IconButton>
          </Tooltip>
        </TableCell>
        {isAdmin && (
          <TableCell align="center">
            <Tooltip title="Fjern klient">
              <span>
                <IconButton
                  color="error"
                  onClick={() => openRemoveDialog(client.id)}
                  size="small"
                  disabled={removingClientId === client.id}
                >
                  {removingClientId === client.id ? (
                    <CircularProgress size={18} />
                  ) : (
                    <DeleteIcon />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          </TableCell>
        )}
        <TableCell
          align="right"
          {...provided?.dragHandleProps}
          sx={{ cursor: "grab", width: 45 }}
        >
          <span style={{ fontSize: 20 }}>☰</span>
        </TableCell>
      </TableRow>
    ),
    [isAdmin, getSchoolName, openRemoveDialog, removingClientId]
  );

  const removalRequiresTypedId =
    !!selectedClientForRemoval &&
    (
      selectedClientForRemoval.status === "approved" ||
      selectedClientForRemoval.isOnline
    );

  const removalTypedIdMatches =
    !removalRequiresTypedId ||
    String(confirmDeleteText).trim() === String(selectedClientForRemoval?.id ?? "");

  const canConfirmRemoval =
    !!selectedClientForRemoval &&
    !removingClientId &&
    removalTypedIdMatches;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const colSpanApproved = isAdmin ? (isMobile ? 6 : 8) : isMobile ? 4 : 6;

  return (
    <Box
      sx={{
        maxWidth: 1500,
        mx: "auto",
        mt: { xs: 1, sm: 4 },
        position: "relative",
        minHeight: "60vh",
        px: { xs: 0.5, sm: 2 },
      }}
    >
      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4200}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <MuiAlert
          elevation={6}
          variant="filled"
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </MuiAlert>
      </Snackbar>

      {/* Bekræftelsesdialog */}
      <Dialog open={confirmOpen} onClose={closeRemoveDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Fjern klient?</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            <MuiAlert severity="warning">
              Dette sletter kun klienten i backend. Den fysiske Ubuntu-maskine
              bliver ikke nulstillet, og hvis den skal bruges igen, skal den
              enrolles/installationsregistreres på ny.
            </MuiAlert>

            {selectedClientForRemoval && (
              <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "rgba(0,0,0,0.02)" }}>
                <Typography sx={{ fontWeight: 700 }}>
                  #{selectedClientForRemoval.id} · {getClientDisplayName(selectedClientForRemoval)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Status: {selectedClientForRemoval.status || "ukendt"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Online: {selectedClientForRemoval.isOnline ? "Ja" : "Nej"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Lokation: {getClientLocality(selectedClientForRemoval) || "ikke angivet"}
                </Typography>
              </Paper>
            )}

            {selectedClientForRemoval?.isOnline && (
              <MuiAlert severity="error">
                Klienten ser ud til at være online. Slet kun en online klient,
                hvis du er sikker på, at den skal fjernes fra driften.
              </MuiAlert>
            )}

            {selectedClientForRemoval?.status === "approved" && (
              <MuiAlert severity="info">
                Klienten er godkendt. Hvis den slettes ved en fejl, skal den
                oprettes igen med en ny installationskode og godkendes på ny.
              </MuiAlert>
            )}

            {removalRequiresTypedId && selectedClientForRemoval && (
              <TextField
                size="small"
                fullWidth
                label={`Skriv klient-ID ${selectedClientForRemoval.id} for at bekræfte`}
                value={confirmDeleteText}
                onChange={(e) => setConfirmDeleteText(e.target.value)}
                disabled={!!removingClientId}
                error={!!confirmDeleteText && !removalTypedIdMatches}
                helperText={
                  removalTypedIdMatches
                    ? " "
                    : "Klient-ID matcher ikke."
                }
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRemoveDialog} disabled={!!removingClientId}>
            Annullér
          </Button>
          <Button
            onClick={confirmRemoveClient}
            color="error"
            variant="contained"
            disabled={!canConfirmRemoval}
            startIcon={
              removingClientId ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <DeleteIcon />
              )
            }
          >
            {removingClientId ? "Fjerner..." : "Fjern klient"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Header */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2, gap: 1 }}
      >
        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            fontSize: { xs: "1.1rem", sm: "1.4rem" },
          }}
        >
          Godkendte klienter
        </Typography>
        <Tooltip title="Opdater klientdata">
          <span>
            <Button
              startIcon={
                refreshing ? (
                  <CircularProgress size={20} />
                ) : (
                  <RefreshIcon />
                )
              }
              onClick={handleRefresh}
              disabled={refreshing || savingSort}
              sx={{
                minWidth: { xs: "unset", sm: 0 },
                fontWeight: 500,
                textTransform: "none",
                width: { xs: "100%", sm: "auto" },
              }}
            >
              {refreshing ? "Opdaterer..." : "Opdater"}
            </Button>
          </span>
        </Tooltip>
      </Stack>

      {/* Godkendte klienter */}
      <Paper sx={{ mb: 4, px: { xs: 0.5, sm: 0 } }}>
        <TableContainer style={{ position: "relative" }}>
          {(loading || savingSort) && (
            <Box
              sx={{
                position: "absolute",
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
                background: "rgba(255,255,255,0.7)",
                display: "flex",
                flexDirection: "column",
                gap: 1,
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
              }}
            >
              <CircularProgress />
              {savingSort && (
                <Typography variant="body2">
                  Gemmer sortering...
                </Typography>
              )}
            </Box>
          )}

          <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <Droppable droppableId="clients-droppable">
              {(provided) => (
                <Table
                  size="small"
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  sx={{
                    minWidth: 300,
                    "& td, & th": {
                      py: { xs: 1, sm: 1.2 },
                      px: { xs: 0.5, sm: 2 },
                      fontSize: { xs: "0.98em", sm: "0.875rem" },
                    },
                  }}
                >
                  <TableHead>
                    <TableRow
                      sx={{
                        background: "#f6f9fc",
                        "& th": {
                          fontWeight: 700,
                          fontSize: { xs: "1em", sm: "0.875rem" },
                          whiteSpace: { xs: "nowrap", sm: "normal" },
                        },
                      }}
                    >
                      {isMobile ? (
                        [
                          ...(isAdmin ? ["ID"] : []),
                          "Klientnavn",
                          "Status",
                          "Info",
                          ...(isAdmin ? ["Fjern"] : []),
                          "Sort",
                        ].map((header, idx) => (
                          <TableCell key={header + idx}>{header}</TableCell>
                        ))
                      ) : (
                        <>
                          {isAdmin && <TableCell>Klient ID</TableCell>}
                          <TableCell>Klientnavn</TableCell>
                          <TableCell>Lokalitet</TableCell>
                          <TableCell sx={{ textAlign: "center" }}>
                            Status
                          </TableCell>
                          <TableCell sx={{ textAlign: "center" }}>
                            Skole
                          </TableCell>
                          <TableCell sx={{ textAlign: "center" }}>
                            Info
                          </TableCell>
                          {isAdmin && (
                            <TableCell sx={{ textAlign: "center" }}>
                              Fjern
                            </TableCell>
                          )}
                          <TableCell
                            sx={{ width: 60, textAlign: "right" }}
                          >
                            Sortering
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dragClients.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={colSpanApproved}
                          align="center"
                        >
                          Ingen godkendte klienter.
                        </TableCell>
                      </TableRow>
                    ) : (
                      dragClients.map((client, idx) => (
                        <Draggable
                          key={client.id}
                          draggableId={String(client.id)}
                          index={idx}
                          isDragDisabled={savingSort || !!removingClientId}
                        >
                          {(provided, snapshot) =>
                            isMobile
                              ? renderMobileRow(
                                  client,
                                  idx,
                                  provided,
                                  snapshot
                                )
                              : (
                                <TableRow
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  style={{
                                    ...provided.draggableProps.style,
                                    background: snapshot.isDragging
                                      ? "#e3f2fd"
                                      : undefined,
                                  }}
                                  hover
                                >
                                  {isAdmin && (
                                    <TableCell>{client.id}</TableCell>
                                  )}
                                  <TableCell>{client.name}</TableCell>
                                  <TableCell>
                                    {client.locality || (
                                      <span style={{ color: "#888" }}>
                                        Ingen lokalitet
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell align="center">
                                    <ClientStatusCell
                                      isOnline={client.isOnline}
                                    />
                                  </TableCell>
                                  <TableCell align="center">
                                    {getSchoolName(getClientSchoolId(client))}
                                  </TableCell>
                                  <TableCell align="center">
                                    <Tooltip title="Info">
                                      <IconButton
                                        component={Link}
                                        to={`/clients/${client.id}`}
                                        color="primary"
                                      >
                                        <InfoIcon />
                                      </IconButton>
                                    </Tooltip>
                                  </TableCell>
                                  {isAdmin && (
                                    <TableCell align="center">
                                      <Tooltip title="Fjern klient">
                                        <span>
                                          <IconButton
                                            color="error"
                                            onClick={() =>
                                              openRemoveDialog(client.id)
                                            }
                                            disabled={removingClientId === client.id}
                                          >
                                            {removingClientId === client.id ? (
                                              <CircularProgress size={20} />
                                            ) : (
                                              <DeleteIcon />
                                            )}
                                          </IconButton>
                                        </span>
                                      </Tooltip>
                                    </TableCell>
                                  )}
                                  <TableCell
                                    align="right"
                                    {...provided.dragHandleProps}
                                    sx={{ cursor: "grab", width: 60 }}
                                  >
                                    <span style={{ fontSize: 20 }}>☰</span>
                                  </TableCell>
                                </TableRow>
                              )
                          }
                        </Draggable>
                      ))
                    )}
                    {provided.placeholder}
                  </TableBody>
                </Table>
              )}
            </Droppable>
          </DragDropContext>
        </TableContainer>
      </Paper>

      {/* Ikke-godkendte klienter — kun admin */}
      {isAdmin && (
        <>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
            sx={{ mb: 2, gap: 1 }}
          >
            <Box>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  fontSize: { xs: "1.1rem", sm: "1.4rem" },
                }}
              >
                Ikke godkendte klienter
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Nye klienter fra installationskode vises her. Vælg skole og godkend, når du har identificeret skærmen.
              </Typography>
            </Box>

            <Chip
              icon={<PendingActionsIcon />}
              label={`${unapprovedClients.length} afventer`}
              color={unapprovedClients.length ? "warning" : "default"}
              variant={unapprovedClients.length ? "filled" : "outlined"}
            />
          </Stack>

          <Paper sx={{ px: { xs: 0.5, sm: 0 } }}>
            <TableContainer>
              <Table
                size="small"
                sx={{
                  minWidth: 300,
                  "& td, & th": {
                    py: { xs: 1, sm: 1.2 },
                    px: { xs: 0.5, sm: 2 },
                    fontSize: { xs: "0.98em", sm: "0.875rem" },
                  },
                }}
              >
                <TableHead>
                  <TableRow
                    sx={{
                      background: "#f6f9fc",
                      "& th": {
                        fontWeight: 700,
                        fontSize: { xs: "1em", sm: "0.875rem" },
                        whiteSpace: { xs: "nowrap", sm: "normal" },
                      },
                    }}
                  >
                    <TableCell>Klient ID</TableCell>
                    <TableCell>Installationsoplysninger</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>IP-adresser</TableCell>
                    <TableCell>MAC-adresser</TableCell>
                    <TableCell>Tilføjet</TableCell>
                    <TableCell>Skole</TableCell>
                    <TableCell sx={{ textAlign: "center" }}>
                      Godkend
                    </TableCell>
                    <TableCell sx={{ textAlign: "center" }}>
                      Fjern
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {unapprovedClients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center">
                        Ingen ikke-godkendte klienter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    unapprovedClients.map((client) => {
                      const statusChip = getClientStatusChipProps(client.status);
                      const isApproving = approvingClientId === client.id;
                      const isRemoving = removingClientId === client.id;

                      return (
                        <TableRow key={client.id} hover>
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <Typography sx={{ fontWeight: 700 }}>
                                {client.id}
                              </Typography>
                              <CopyIconButton value={client.id} iconSize={14} />
                            </Stack>
                          </TableCell>

                          <TableCell>
                            <EnrollmentIdentityCell client={client} />
                          </TableCell>

                          <TableCell>
                            <Chip
                              size="small"
                              color={statusChip.color}
                              label={statusChip.label}
                            />
                          </TableCell>

                          <TableCell>
                            <Stack spacing={0.25}>
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <b>WiFi:</b>&nbsp;
                                <span>
                                  {client.wifi_ip_address || "ukendt"}
                                </span>
                                <CopyIconButton
                                  value={client.wifi_ip_address || ""}
                                  disabled={!client.wifi_ip_address}
                                  iconSize={14}
                                />
                              </Box>
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <b>LAN:</b>&nbsp;
                                <span>
                                  {client.lan_ip_address || "ukendt"}
                                </span>
                                <CopyIconButton
                                  value={client.lan_ip_address || ""}
                                  disabled={!client.lan_ip_address}
                                  iconSize={14}
                                />
                              </Box>
                            </Stack>
                          </TableCell>

                          <TableCell>
                            <Stack spacing={0.25}>
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <b>WiFi:</b>&nbsp;
                                <span>
                                  {client.wifi_mac_address || "ukendt"}
                                </span>
                                <CopyIconButton
                                  value={client.wifi_mac_address || ""}
                                  disabled={!client.wifi_mac_address}
                                  iconSize={14}
                                />
                              </Box>
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <b>LAN:</b>&nbsp;
                                <span>
                                  {client.lan_mac_address || "ukendt"}
                                </span>
                                <CopyIconButton
                                  value={client.lan_mac_address || ""}
                                  disabled={!client.lan_mac_address}
                                  iconSize={14}
                                />
                              </Box>
                            </Stack>
                          </TableCell>

                          <TableCell>
                            {(() => {
                              const ts = formatTimestamp(client.created_at);
                              return (
                                <span style={{ whiteSpace: "pre-line" }}>
                                  {ts.date || "-"}
                                  {ts.time ? `\n${ts.time}` : ""}
                                </span>
                              );
                            })()}
                          </TableCell>

                          <TableCell>
                            <Select
                              size="small"
                              value={schoolSelections[client.id] || ""}
                              displayEmpty
                              onChange={(e) =>
                                handleSchoolChange(client.id, e.target.value)
                              }
                              disabled={isApproving || isRemoving}
                              sx={{
                                minWidth: { xs: 95, sm: 140 },
                                fontSize: { xs: "0.97em", sm: "0.875rem" },
                              }}
                            >
                              <MenuItem value="">Vælg skole</MenuItem>
                              {schools.map((school) => (
                                <MenuItem key={school.id} value={school.id}>
                                  {school.name}
                                </MenuItem>
                              ))}
                            </Select>
                          </TableCell>

                          <TableCell align="center">
                            <Button
                              variant="contained"
                              color="success"
                              size="small"
                              startIcon={
                                isApproving ? (
                                  <CircularProgress size={16} color="inherit" />
                                ) : (
                                  <AddIcon />
                                )
                              }
                              onClick={() => handleApproveClient(client.id)}
                              disabled={isApproving || isRemoving}
                              sx={{
                                minWidth: 44,
                                fontSize: { xs: "0.97em", sm: "0.875rem" },
                              }}
                            >
                              {isApproving ? "Godkender..." : "Godkend"}
                            </Button>
                          </TableCell>

                          <TableCell align="center">
                            <Tooltip title="Fjern klient">
                              <span>
                                <IconButton
                                  color="error"
                                  onClick={() => openRemoveDialog(client.id)}
                                  size="small"
                                  disabled={isApproving || isRemoving}
                                >
                                  {isRemoving ? (
                                    <CircularProgress size={18} />
                                  ) : (
                                    <DeleteIcon />
                                  )}
                                </IconButton>
                              </span>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}
    </Box>
  );
}
