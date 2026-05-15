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
  useMediaQuery,
  useTheme,
} from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
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

  FIX 1: token fjernet som argument til alle api-kald.
    api.js bruger authHeaders() internt via localStorage —
    token som parameter blev ignoreret og er forvirrende.

  FIX 2: filteredClients fjernet — var blot en alias for clients
    uden nogen filtrering. Bruges nu direkte.

  FIX 3: polling stoppes midlertidigt under aktiv drag
    via isDraggingRef så listen ikke resettes midt i en drag-operation.

  FIX 4: isClientListEqual udvides til også at sammenligne
    chrome_status, uptime og last_seen så UI opdateres
    når disse felter ændres på en klient.

  FIX 5: token destruktureres ikke længere fra useAuth()
    da authcontext ikke eksponerer den.

  FIX 6: renderMobileRow er memoized via memo + useCallback
    så den ikke genskabes ved hvert render.
*/

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(isoDate) {
  if (!isoDate) return { date: "", time: "" };
  const dateObj = new Date(
    isoDate.endsWith("Z") ? isoDate : isoDate + "Z"
  );
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

// FIX 4: Udvider sammenligning til chrome_status, uptime og last_seen
function isClientListEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ca = a[i];
    const cb = b[i];
    if (
      ca.id !== cb.id ||
      ca.name !== cb.name ||
      ca.locality !== cb.locality ||
      ca.status !== cb.status ||
      ca.sort_order !== cb.sort_order ||
      ca.isOnline !== cb.isOnline ||
      ca.school_id !== cb.school_id ||
      ca.chrome_status !== cb.chrome_status ||
      ca.uptime !== cb.uptime ||
      ca.last_seen !== cb.last_seen
    ) {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Sub-komponenter
// ---------------------------------------------------------------------------

// FIX 6: Memoized CopyIconButton
const CopyIconButton = memo(function CopyIconButton({
  value,
  disabled,
  iconSize = 16,
}) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    if (!value) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const ta = document.createElement("textarea");
        ta.value = value;
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

// ---------------------------------------------------------------------------
// Hoved-komponent
// ---------------------------------------------------------------------------

export default function ClientInfoPage() {
  // FIX 5: token fjernet — eksponeres ikke af authcontext
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [clients, setClients] = useState([]);
  const [schools, setSchools] = useState([]);
  const [schoolSelections, setSchoolSelections] = useState({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dragClients, setDragClients] = useState([]);

  const lastFetchedClients = useRef([]);
  // FIX 3: stopper polling under aktiv drag
  const isDraggingRef = useRef(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmClientId, setConfirmClientId] = useState(null);

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

  // ---------------------------------------------------------------------------
  // Data-hentning
  // ---------------------------------------------------------------------------

  // FIX 1: token fjernet som argument
  const fetchClients = useCallback(
    async (forceUpdate = false, showLoading = false) => {
      // FIX 3: undgå polling under drag
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
        showSnackbar("Fejl: " + (err?.message || err), "error");
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

  // Hent skoler — FIX 1: token fjernet
  useEffect(() => {
    getSchools()
      .then(setSchools)
      .catch(() => setSchools([]));
  }, []);

  // Opdater dragClients når clients ændres
  // FIX 3: opdater ikke dragClients under aktiv drag
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

  const unapprovedClients = clients
    .filter((c) => c.status !== "approved")
    .slice()
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchClients(true, true);
    setRefreshing(false);
    showSnackbar("Opdateret!", "success");
  }, [fetchClients, showSnackbar]);

  const openRemoveDialog = useCallback((clientId) => {
    setConfirmClientId(clientId);
    setConfirmOpen(true);
  }, []);

  const closeRemoveDialog = useCallback(() => {
    setConfirmOpen(false);
    setConfirmClientId(null);
  }, []);

  // FIX 1: token fjernet
  const handleRemoveClient = useCallback(
    async (clientId) => {
      try {
        await removeClient(clientId);
        showSnackbar("Klient fjernet!", "success");
        fetchClients(true, true);
      } catch (err) {
        showSnackbar(
          "Kunne ikke fjerne klient: " + (err?.message || err),
          "error"
        );
      }
    },
    [fetchClients, showSnackbar]
  );

  const confirmRemoveClient = useCallback(async () => {
    if (confirmClientId) {
      await handleRemoveClient(confirmClientId);
      closeRemoveDialog();
    }
  }, [confirmClientId, handleRemoveClient, closeRemoveDialog]);

  // FIX 3: sæt isDraggingRef ved drag start/slut
  const onDragStart = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  // FIX 1: token fjernet
  const onDragEnd = useCallback(
    async (result) => {
      isDraggingRef.current = false;

      if (!result.destination) return;
      if (result.destination.index === result.source.index) return;

      const reordered = Array.from(dragClients);
      const [removed] = reordered.splice(result.source.index, 1);
      reordered.splice(result.destination.index, 0, removed);

      // Opdater UI øjeblikkeligt
      setDragClients(reordered);

      try {
        await Promise.all(
          reordered.map((client, i) =>
            updateClient(client.id, { sort_order: i + 1 })
          )
        );
        showSnackbar("Sortering opdateret!", "success");
        fetchClients(true, false);
      } catch (err) {
        showSnackbar(
          "Kunne ikke opdatere sortering: " + (err?.message || err),
          "error"
        );
      }
    },
    [dragClients, fetchClients, showSnackbar]
  );

  const handleSchoolChange = useCallback((clientId, schoolId) => {
    setSchoolSelections((prev) => ({ ...prev, [clientId]: schoolId }));
  }, []);

  // FIX 1: token fjernet
  const handleApproveClient = useCallback(
    async (clientId) => {
      const school_id = schoolSelections[clientId];
      if (!school_id) {
        showSnackbar("Vælg en skole først!", "warning");
        return;
      }
      try {
        await approveClient(clientId, school_id);
        showSnackbar("Klient godkendt!", "success");
        fetchClients(true, true);
      } catch (err) {
        showSnackbar(
          "Kunne ikke godkende klient: " + (err?.message || err),
          "error"
        );
      }
    },
    [schoolSelections, fetchClients, showSnackbar]
  );

  const getSchoolName = useCallback(
    (schoolId) => {
      const school = schools.find((s) => s.id === schoolId);
      return school ? (
        school.name
      ) : (
        <span style={{ color: "#888" }}>Ingen skole</span>
      );
    },
    [schools]
  );

  // ---------------------------------------------------------------------------
  // FIX 6: Memoized mobil-række renderer
  // ---------------------------------------------------------------------------
  const renderMobileRow = useCallback(
    (client, idx, provided, snapshot) => (
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
              {getSchoolName(client.school_id)}
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
              <IconButton
                color="error"
                onClick={() => openRemoveDialog(client.id)}
                size="small"
              >
                <DeleteIcon />
              </IconButton>
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
    [isAdmin, getSchoolName, openRemoveDialog]
  );

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
        autoHideDuration={3400}
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
      <Dialog open={confirmOpen} onClose={closeRemoveDialog}>
        <DialogTitle>Er du sikker?</DialogTitle>
        <DialogContent>
          <Typography>
            Vil du virkelig fjerne denne klient? Dette kan ikke fortrydes.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRemoveDialog}>Annullér</Button>
          <Button
            onClick={confirmRemoveClient}
            color="error"
            variant="contained"
          >
            Fjern
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
              disabled={refreshing}
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
          {loading && (
            <Box
              sx={{
                position: "absolute",
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
                background: "rgba(255,255,255,0.7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
              }}
            >
              <CircularProgress />
            </Box>
          )}

          {/* FIX 3: onDragStart tilføjet */}
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
                                    {getSchoolName(client.school_id)}
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
                                        <IconButton
                                          color="error"
                                          onClick={() =>
                                            openRemoveDialog(client.id)
                                          }
                                        >
                                          <DeleteIcon />
                                        </IconButton>
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
          <Typography
            variant="h5"
            sx={{
              mb: 2,
              fontWeight: 700,
              fontSize: { xs: "1.1rem", sm: "1.4rem" },
            }}
          >
            Ikke godkendte klienter
          </Typography>
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
                    <TableCell sx={{ width: "12.5%" }}>Klient ID</TableCell>
                    <TableCell sx={{ width: "12.5%" }}>Klientnavn</TableCell>
                    <TableCell sx={{ width: "12.5%" }}>IP-adresser</TableCell>
                    <TableCell sx={{ width: "12.5%" }}>MAC-adresser</TableCell>
                    <TableCell sx={{ width: "12.5%" }}>Tilføjet</TableCell>
                    <TableCell sx={{ width: "12.5%" }}>Skole</TableCell>
                    <TableCell sx={{ width: "12.5%", textAlign: "center" }}>
                      Godkend
                    </TableCell>
                    <TableCell sx={{ width: "12.5%", textAlign: "center" }}>
                      Fjern
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {unapprovedClients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        Ingen ikke-godkendte klienter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    unapprovedClients.map((client) => (
                      <TableRow key={client.id} hover>
                        <TableCell>{client.id}</TableCell>
                        <TableCell>
                          {client.name || "Ukendt navn"}
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
                                {ts.date}
                                {"\n"}
                                {ts.time}
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
                            sx={{
                              minWidth: { xs: 70, sm: 120 },
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
                            startIcon={<AddIcon />}
                            onClick={() => handleApproveClient(client.id)}
                            sx={{
                              minWidth: 44,
                              fontSize: { xs: "0.97em", sm: "0.875rem" },
                            }}
                          >
                            Godkend
                          </Button>
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="Fjern klient">
                            <IconButton
                              color="error"
                              onClick={() => openRemoveDialog(client.id)}
                              size="small"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
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
