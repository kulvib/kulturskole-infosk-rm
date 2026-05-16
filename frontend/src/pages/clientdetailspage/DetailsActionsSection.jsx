import React, { useState, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Tooltip,
  Grid,
  Divider,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import HotelIcon from "@mui/icons-material/Hotel";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import OpenInBrowserIcon from "@mui/icons-material/OpenInBrowser";
import CloseIcon from "@mui/icons-material/Close";
import TerminalIcon from "@mui/icons-material/Terminal";
import DesktopWindowsIcon from "@mui/icons-material/DesktopWindows";
import { useTheme } from "@mui/material/styles";
import { useAuth } from "../../auth/authcontext";

/*
  DetailsActionsSection.jsx

  Gruppering:
    1. Browser      — Start browser, Stop browser
    2. Dvale        — Sæt i dvale, Væk klient
    3. Maskine      — Genstart maskine, Sluk maskine       (kun admin)
    4. Værktøjer    — Terminal, Fjernskrivebord            (kun admin)

  "Genstart browser" er fjernet.

  Disabled-logik (tre lag):
    Lag 1 — anyLoading / refreshing (frontend-guard)
    Lag 2 — client.state / pending_chrome_action / pending_reboot / pending_shutdown
    Lag 3 — clientOnline

  Gyldige state-værdier fra backend:
    normal | sleeping | wakeup | shutdown | error | updating

  Gyldige pending_chrome_action-værdier fra backend:
    start | stop | sleep | wakeup | shutdown | none |
    livestream_start | livestream_stop | os_update | restart
*/

// ---------------------------------------------------------------------------
// Konstanter
// ---------------------------------------------------------------------------
const ACTION_LABELS = {
  start:    "Start browser",
  stop:     "Stop browser",
  sleep:    "Sæt i dvale",
  wakeup:   "Væk klient",
  reboot:   "Genstart maskine",
  shutdown: "Sluk maskine",
};

const ACTION_ICONS = {
  start:    <OpenInBrowserIcon fontSize="small" />,
  stop:     <CloseIcon fontSize="small" />,
  sleep:    <HotelIcon fontSize="small" />,
  wakeup:   <WbSunnyIcon fontSize="small" />,
  reboot:   <RestartAltIcon fontSize="small" />,
  shutdown: <PowerSettingsNewIcon fontSize="small" />,
};

const ACTION_COLORS = {
  start:    "success",
  stop:     "error",
  sleep:    "primary",
  wakeup:   "warning",
  reboot:   "warning",
  shutdown: "error",
};

const ADMIN_ONLY_ACTIONS = new Set(["reboot", "shutdown"]);
const CONFIRM_ACTIONS    = new Set(["shutdown", "reboot"]);

const CONFIRM_TEXTS = {
  shutdown: {
    title: "Bekræft nedlukning",
    body:  "Er du sikker på at du vil slukke maskinen? Den skal tændes fysisk igen efterfølgende.",
  },
  reboot: {
    title: "Bekræft genstart",
    body:  "Er du sikker på at du vil genstarte maskinen?",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function normalizePca(pca) {
  if (!pca) return "none";
  return String(pca).toLowerCase().trim();
}

function normalizeState(state) {
  if (!state) return "normal";
  return String(state).toLowerCase().trim();
}

// ---------------------------------------------------------------------------
// ActionButton
// ---------------------------------------------------------------------------
function ActionButton({ action, onClick, loading, disabled, disabledReason, isMobile, isAdmin }) {
  if (ADMIN_ONLY_ACTIONS.has(action) && !isAdmin) return null;

  const label  = ACTION_LABELS[action] ?? action;
  const icon   = ACTION_ICONS[action]  ?? null;
  const color  = ACTION_COLORS[action] ?? "primary";
  const tip    = loading ? label : (disabled && disabledReason) ? disabledReason : label;

  return (
    <Tooltip title={tip} arrow>
      <span style={{ width: "100%" }}>
        <Button
          variant="outlined"
          color={color}
          size={isMobile ? "small" : "medium"}
          startIcon={
            loading
              ? <CircularProgress size={isMobile ? 13 : 16} color="inherit" />
              : icon
          }
          onClick={onClick}
          disabled={disabled || loading}
          fullWidth
          sx={{
            textTransform: "none",
            fontWeight: 500,
            fontSize: isMobile ? "0.82rem" : "0.9rem",
            justifyContent: "flex-start",
            px: isMobile ? 1 : 1.5,
            py: isMobile ? 0.5 : 0.75,
            minHeight: isMobile ? 34 : 40,
          }}
        >
          {loading ? "Arbejder..." : label}
        </Button>
      </span>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// Gruppe-header
// ---------------------------------------------------------------------------
function GroupLabel({ label, isMobile }) {
  return (
    <Typography
      variant="caption"
      sx={{
        fontWeight: 600,
        color: "text.secondary",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontSize: isMobile ? 10 : 11,
        mb: 0.5,
        display: "block",
      }}
    >
      {label}
    </Typography>
  );
}

// ---------------------------------------------------------------------------
// Hoved-komponent
// ---------------------------------------------------------------------------
export default function ClientDetailsActionsSection({
  clientId,
  clientState,
  pendingChromeAction,
  pendingReboot,
  pendingShutdown,
  handleClientAction,
  handleOpenTerminal,
  handleOpenRemoteDesktop,
  refreshing,
  showSnackbar,
  clientOnline,
}) {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { user } = useAuth();

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const [actionLoading, setActionLoading] = useState({});
  const [confirmDialog, setConfirmDialog] = useState({ open: false, action: null });

  // Normaliserede state-værdier
  const state      = normalizeState(clientState);
  const pca        = normalizePca(pendingChromeAction);
  const isSleeping = state.startsWith("sleep");
  const isUpdating = state === "updating";
  const isOffline  = clientOnline === false;
  const anyLoading = Object.values(actionLoading).some(Boolean);

  const safeShowSnackbar = useCallback((opts) => {
    if (typeof showSnackbar === "function") {
      showSnackbar(opts);
    } else {
      console.warn("[snackbar]", opts?.message);
    }
  }, [showSnackbar]);

  // ---------------------------------------------------------------------------
  // Disabled-logik pr. knap (lag 1 + 2 + 3)
  // ---------------------------------------------------------------------------
  const getDisabledInfo = useCallback((action) => {
    // Lag 1: global guards
    if (anyLoading)  return { disabled: true, reason: "En handling er allerede i gang" };
    if (refreshing)  return { disabled: true, reason: "Opdaterer..." };

    // Lag 2 + 3 pr. handling
    switch (action) {
      case "start": {
        if (isOffline)   return { disabled: true, reason: "Klienten er offline" };
        if (isSleeping)  return { disabled: true, reason: "Klienten er i dvale — væk den først" };
        if (isUpdating)  return { disabled: true, reason: "Klienten opdaterer" };
        if (pca !== "none" && pca !== "") {
          return { disabled: true, reason: "En browserhandling er allerede i kø" };
        }
        return { disabled: false, reason: "" };
      }
      case "stop": {
        if (isOffline)  return { disabled: true, reason: "Klienten er offline" };
        if (isSleeping) return { disabled: true, reason: "Klienten er i dvale" };
        if (isUpdating) return { disabled: true, reason: "Klienten opdaterer" };
        return { disabled: false, reason: "" };
      }
      case "sleep": {
        if (isUpdating) return { disabled: true, reason: "Klienten opdaterer" };
        if (isSleeping) return { disabled: true, reason: "Klienten er allerede i dvale" };
        return { disabled: false, reason: "" };
      }
      case "wakeup": {
        if (!isSleeping) return { disabled: true, reason: "Klienten er ikke i dvale" };
        return { disabled: false, reason: "" };
      }
      case "reboot": {
        if (isUpdating)    return { disabled: true, reason: "Klienten opdaterer" };
        if (pendingReboot) return { disabled: true, reason: "Genstart er allerede bestilt" };
        return { disabled: false, reason: "" };
      }
      case "shutdown": {
        if (isUpdating)      return { disabled: true, reason: "Klienten opdaterer" };
        if (pendingShutdown) return { disabled: true, reason: "Nedlukning er allerede bestilt" };
        return { disabled: false, reason: "" };
      }
      default:
        return { disabled: false, reason: "" };
    }
  }, [anyLoading, refreshing, isOffline, isSleeping, isUpdating, pca, pendingReboot, pendingShutdown]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const onAction = useCallback(async (action) => {
    if (!clientId) return;

    if (CONFIRM_ACTIONS.has(action)) {
      setConfirmDialog({ open: true, action });
      return;
    }

    setActionLoading(prev => ({ ...prev, [action]: true }));
    try {
      await handleClientAction(action);
    } catch (err) {
      safeShowSnackbar({
        message:  "Fejl ved handling: " + (err?.message || String(err)),
        severity: "error",
      });
    } finally {
      setActionLoading(prev => ({ ...prev, [action]: false }));
    }
  }, [clientId, handleClientAction, safeShowSnackbar]);

  const onConfirmAction = useCallback(async () => {
    const action = confirmDialog.action;
    setConfirmDialog({ open: false, action: null });
    if (!action) return;

    setActionLoading(prev => ({ ...prev, [action]: true }));
    try {
      await handleClientAction(action);
    } catch (err) {
      safeShowSnackbar({
        message:  "Fejl ved handling: " + (err?.message || String(err)),
        severity: "error",
      });
    } finally {
      setActionLoading(prev => ({ ...prev, [action]: false }));
    }
  }, [confirmDialog.action, handleClientAction, safeShowSnackbar]);

  const onCancelConfirm = useCallback(() => {
    setConfirmDialog({ open: false, action: null });
  }, []);

  // ---------------------------------------------------------------------------
  // Hjælper til at rendere én gruppe af knapper
  // ---------------------------------------------------------------------------
  function renderActionButton(action) {
    const { disabled, reason } = getDisabledInfo(action);
    return (
      <Grid item xs={6} sm={4} md={2} key={action}>
        <ActionButton
          action={action}
          onClick={() => onAction(action)}
          loading={!!actionLoading[action]}
          disabled={disabled}
          disabledReason={reason}
          isMobile={isMobile}
          isAdmin={isAdmin}
        />
      </Grid>
    );
  }

  const confirmInfo = confirmDialog.action
    ? (CONFIRM_TEXTS[confirmDialog.action] ?? { title: "Bekræft", body: "Er du sikker?" })
    : { title: "", body: "" };

  // ---------------------------------------------------------------------------
  // Status-beskeder
  // ---------------------------------------------------------------------------
  const statusMessages = [];
  if (isOffline)  statusMessages.push({ text: "Klienten er offline — browser-handlinger er ikke tilgængelige.", color: "text.secondary" });
  if (isSleeping) statusMessages.push({ text: 'Klienten er i dvale — brug "Væk klient" for at aktivere den.', color: "primary.main" });
  if (isUpdating) statusMessages.push({ text: "Klienten opdaterer — handlinger er midlertidigt spærret.", color: "warning.main" });
  if (pendingReboot)   statusMessages.push({ text: "Genstart er bestilt og afventer klienten.", color: "warning.main" });
  if (pendingShutdown) statusMessages.push({ text: "Nedlukning er bestilt og afventer klienten.", color: "error.main" });
  if (pca !== "none" && pca !== "" && !isSleeping && !isUpdating) {
    statusMessages.push({ text: `Afventer browserhandling: "${pca}"`, color: "text.secondary" });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Card elevation={2} sx={{ borderRadius: isMobile ? 1 : 2 }}>
      <CardContent sx={{ px: isMobile ? 1 : 2, py: isMobile ? 1 : 2 }}>
        <Typography
          variant="h6"
          sx={{ fontWeight: 700, mb: isMobile ? 1 : 1.5, fontSize: isMobile ? 16 : undefined }}
        >
          Handlinger
        </Typography>

        {/* ── Gruppe 1: Browser ── */}
        <Box sx={{ mb: isMobile ? 1 : 1.5 }}>
          <GroupLabel label="Browser" isMobile={isMobile} />
          <Grid container spacing={isMobile ? 0.5 : 1}>
            {renderActionButton("start")}
            {renderActionButton("stop")}
          </Grid>
        </Box>

        <Divider sx={{ my: isMobile ? 0.75 : 1 }} />

        {/* ── Gruppe 2: Dvale ── */}
        <Box sx={{ mb: isMobile ? 1 : 1.5 }}>
          <GroupLabel label="Dvale" isMobile={isMobile} />
          <Grid container spacing={isMobile ? 0.5 : 1}>
            {renderActionButton("sleep")}
            {renderActionButton("wakeup")}
          </Grid>
        </Box>

        {/* ── Gruppe 3+4: Admin ── */}
        {isAdmin && (
          <>
            <Divider sx={{ my: isMobile ? 0.75 : 1 }} />

            {/* Maskine */}
            <Box sx={{ mb: isMobile ? 1 : 1.5 }}>
              <GroupLabel label="Maskine" isMobile={isMobile} />
              <Grid container spacing={isMobile ? 0.5 : 1}>
                {renderActionButton("reboot")}
                {renderActionButton("shutdown")}
              </Grid>
            </Box>

            <Divider sx={{ my: isMobile ? 0.75 : 1 }} />

            {/* Værktøjer */}
            <Box>
              <GroupLabel label="Værktøjer" isMobile={isMobile} />
              <Grid container spacing={isMobile ? 0.5 : 1}>

                {/* Terminal */}
                <Grid item xs={6} sm={4} md={2}>
                  <Tooltip title={isOffline ? "Klienten er offline" : "Åbn terminal"} arrow>
                    <span style={{ width: "100%" }}>
                      <Button
                        variant="outlined"
                        color="inherit"
                        size={isMobile ? "small" : "medium"}
                        startIcon={<TerminalIcon fontSize="small" />}
                        onClick={handleOpenTerminal}
                        disabled={isOffline || anyLoading || refreshing}
                        fullWidth
                        sx={{
                          textTransform: "none",
                          fontWeight: 500,
                          fontSize: isMobile ? "0.82rem" : "0.9rem",
                          justifyContent: "flex-start",
                          px: isMobile ? 1 : 1.5,
                          py: isMobile ? 0.5 : 0.75,
                          minHeight: isMobile ? 34 : 40,
                        }}
                      >
                        Terminal
                      </Button>
                    </span>
                  </Tooltip>
                </Grid>

                {/* Fjernskrivebord */}
                <Grid item xs={6} sm={4} md={2}>
                  <Tooltip title={isOffline ? "Klienten er offline" : "Åbn fjernskrivebord"} arrow>
                    <span style={{ width: "100%" }}>
                      <Button
                        variant="outlined"
                        color="inherit"
                        size={isMobile ? "small" : "medium"}
                        startIcon={<DesktopWindowsIcon fontSize="small" />}
                        onClick={handleOpenRemoteDesktop}
                        disabled={isOffline || anyLoading || refreshing}
                        fullWidth
                        sx={{
                          textTransform: "none",
                          fontWeight: 500,
                          fontSize: isMobile ? "0.82rem" : "0.9rem",
                          justifyContent: "flex-start",
                          px: isMobile ? 1 : 1.5,
                          py: isMobile ? 0.5 : 0.75,
                          minHeight: isMobile ? 34 : 40,
                        }}
                      >
                        Fjernskrivebord
                      </Button>
                    </span>
                  </Tooltip>
                </Grid>

              </Grid>
            </Box>
          </>
        )}

        {/* ── Status-beskeder ── */}
        {statusMessages.length > 0 && (
          <Box sx={{ mt: isMobile ? 1 : 1.5, display: "flex", flexDirection: "column", gap: 0.5 }}>
            {statusMessages.map(({ text, color }, i) => (
              <Typography
                key={i}
                variant="body2"
                sx={{ color, fontSize: isMobile ? 11 : 13 }}
              >
                {text}
              </Typography>
            ))}
          </Box>
        )}
      </CardContent>

      {/* ── Bekræftelsesdialog ── */}
      <Dialog
        open={confirmDialog.open}
        onClose={onCancelConfirm}
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <DialogTitle id="confirm-dialog-title">
          {confirmInfo.title}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="confirm-dialog-description">
            {confirmInfo.body}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancelConfirm} color="inherit">
            Annuller
          </Button>
          <Button onClick={onConfirmAction} color="error" variant="contained" autoFocus>
            Bekræft
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
