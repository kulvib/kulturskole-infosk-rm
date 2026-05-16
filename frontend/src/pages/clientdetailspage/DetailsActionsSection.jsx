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
import { getClient } from "../../api";

/*
  DetailsActionsSection.jsx

  - Viser handlingsknapper for en klient: start/stop browser, sleep/wake, reboot, shutdown.
  - Kun admin/superadmin ser reboot, shutdown, terminal og remote desktop.
  - "Genstart browser" knap er fjernet.
  - FIX: Efter en handling polles backend hvert sekund indtil pending_chrome_action === "none".
    Under polling vises "Venter på bekræftelse fra klient…" på knappen.
  - FIX: Alle knapper er disabled mens en handling kører (actionLoading guard).
  - FIX: Shutdown-bekræftelsesdialog er robust mod manglende showSnackbar prop.
  - FIX: clientOnline bruges til at disable knapper når klienten er offline.
*/

const POLL_INTERVAL_MS = 1000;
const POLL_MAX_WAIT_MS = 30_000;

// Handlinger der skal vente på pending_chrome_action === "none"
const ACTIONS_NEEDING_CONFIRMATION = new Set(["start", "stop"]);

const ACTION_LABELS = {
  start: "Start browser",
  stop: "Stop browser",
  sleep: "Sæt i dvale",
  wakeup: "Væk klient",
  reboot: "Genstart maskine",
  shutdown: "Sluk maskine",
};

const ACTION_ICONS = {
  start: <OpenInBrowserIcon fontSize="small" />,
  stop: <CloseIcon fontSize="small" />,
  sleep: <HotelIcon fontSize="small" />,
  wakeup: <WbSunnyIcon fontSize="small" />,
  reboot: <RestartAltIcon fontSize="small" />,
  shutdown: <PowerSettingsNewIcon fontSize="small" />,
};

const ACTION_COLORS = {
  start: "success",
  stop: "error",
  sleep: "primary",
  wakeup: "warning",
  reboot: "warning",
  shutdown: "error",
};

// Knapper der kræver admin
const ADMIN_ONLY_ACTIONS = new Set(["reboot", "shutdown"]);

// Knapper der kræver bekræftelse
const CONFIRM_ACTIONS = new Set(["shutdown", "reboot"]);

const CONFIRM_TEXTS = {
  shutdown: {
    title: "Bekræft nedlukning",
    body: "Er du sikker på at du vil slukke maskinen? Den skal tændes fysisk igen efterfølgende.",
  },
  reboot: {
    title: "Bekræft genstart",
    body: "Er du sikker på at du vil genstarte maskinen?",
  },
};

function ActionButton({
  action,
  onClick,
  loading,
  waiting,
  disabled,
  isMobile,
  isAdmin,
}) {
  if (ADMIN_ONLY_ACTIONS.has(action) && !isAdmin) return null;

  const label = ACTION_LABELS[action] ?? action;
  const icon = ACTION_ICONS[action] ?? null;
  const color = ACTION_COLORS[action] ?? "primary";

  let buttonLabel;
  if (waiting) {
    buttonLabel = "Venter på bekræftelse fra klient…";
  } else if (loading) {
    buttonLabel = "Arbejder...";
  } else {
    buttonLabel = label;
  }

  const isActive = loading || waiting;

  return (
    <Tooltip title={disabled && !isActive ? "Ikke tilgængelig" : label} arrow>
      <span style={{ width: "100%" }}>
        <Button
          variant="outlined"
          color={color}
          size={isMobile ? "small" : "medium"}
          startIcon={
            isActive
              ? <CircularProgress size={isMobile ? 13 : 16} color="inherit" />
              : icon
          }
          onClick={onClick}
          disabled={disabled || isActive}
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
          {buttonLabel}
        </Button>
      </span>
    </Tooltip>
  );
}

export default function ClientDetailsActionsSection({
  clientId,
  clientState,
  pendingChromeAction,
  handleClientAction,
  handleOpenTerminal,
  handleOpenRemoteDesktop,
  refreshing,
  showSnackbar,
  clientOnline,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { user } = useAuth();

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  // actionLoading: true mens API-kaldet er i gang
  const [actionLoading, setActionLoading] = useState({});
  // waitingAction: hvilken action vi venter på bekræftelse for (polling)
  const [waitingAction, setWaitingAction] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, action: null });

  const isSleeping = typeof clientState === "string" &&
    clientState.toLowerCase().startsWith("sleep");

  const isOffline = clientOnline === false;

  // Alle knapper disabled mens én handling kører eller vi venter på bekræftelse
  const anyLoading = Object.values(actionLoading).some(Boolean);
  const anyWaiting = waitingAction !== null;
  const anyBusy = anyLoading || anyWaiting;

  const safeShowSnackbar = useCallback((opts) => {
    if (typeof showSnackbar === "function") {
      showSnackbar(opts);
    } else {
      console.warn("[snackbar]", opts?.message);
    }
  }, [showSnackbar]);

  // Poll backend hvert sekund indtil pending_chrome_action === "none" (eller timeout)
  const pollUntilConfirmed = useCallback(async (action) => {
    if (!ACTIONS_NEEDING_CONFIRMATION.has(action)) return;
    if (!clientId) return;

    setWaitingAction(action);
    const start = Date.now();

    try {
      while (Date.now() - start < POLL_MAX_WAIT_MS) {
        await new Promise(res => setTimeout(res, POLL_INTERVAL_MS));
        try {
          const data = await getClient(clientId);
          const pca = data?.pending_chrome_action;
          if (!pca || pca === "none") {
            return;
          }
        } catch {
          // Ignorer poll-fejl — prøv igen ved næste interval
        }
      }
      // Timeout — vi stopper polling uden fejl
      console.warn("[DetailsActionsSection] pollUntilConfirmed: timeout");
    } finally {
      setWaitingAction(null);
    }
  }, [clientId]);

  const onAction = useCallback(async (action) => {
    if (!clientId) return;

    // Bekræftelsesdialog for farlige handlinger
    if (CONFIRM_ACTIONS.has(action)) {
      setConfirmDialog({ open: true, action });
      return;
    }

    setActionLoading(prev => ({ ...prev, [action]: true }));
    try {
      await handleClientAction(action);
    } catch (err) {
      safeShowSnackbar({
        message: "Fejl ved handling: " + (err?.message || String(err)),
        severity: "error",
      });
      return;
    } finally {
      setActionLoading(prev => ({ ...prev, [action]: false }));
    }

    // Poll indtil bekræftet
    await pollUntilConfirmed(action);
  }, [clientId, handleClientAction, safeShowSnackbar, pollUntilConfirmed]);

  const onConfirmAction = useCallback(async () => {
    const action = confirmDialog.action;
    setConfirmDialog({ open: false, action: null });
    if (!action) return;

    setActionLoading(prev => ({ ...prev, [action]: true }));
    try {
      await handleClientAction(action);
    } catch (err) {
      safeShowSnackbar({
        message: "Fejl ved handling: " + (err?.message || String(err)),
        severity: "error",
      });
      return;
    } finally {
      setActionLoading(prev => ({ ...prev, [action]: false }));
    }

    await pollUntilConfirmed(action);
  }, [confirmDialog.action, handleClientAction, safeShowSnackbar, pollUntilConfirmed]);

  const onCancelConfirm = useCallback(() => {
    setConfirmDialog({ open: false, action: null });
  }, []);

  // Beregn hvilke knapper der er disabled
  const isDisabled = useCallback((action) => {
    if (anyBusy) return true;
    if (refreshing) return true;

    // Sleep/wake afhænger ikke af online-status
    if (action === "sleep") return isSleeping;
    if (action === "wakeup") return !isSleeping;

    // Reboot og shutdown kræver ikke nødvendigvis online
    if (action === "reboot" || action === "shutdown") return false;

    // Resten kræver online
    if (isOffline) return true;

    return false;
  }, [anyBusy, refreshing, isSleeping, isOffline]);

  // Bruger-synlige handlinger — "restart" er fjernet
  const userActions = ["start", "stop", "sleep", "wakeup"];
  const adminActions = ["reboot", "shutdown"];

  const confirmInfo = confirmDialog.action
    ? (CONFIRM_TEXTS[confirmDialog.action] ?? { title: "Bekræft", body: "Er du sikker?" })
    : { title: "", body: "" };

  return (
    <Card elevation={2} sx={{ borderRadius: isMobile ? 1 : 2 }}>
      <CardContent sx={{ px: isMobile ? 1 : 2, py: isMobile ? 1 : 2 }}>
        <Typography
          variant="h6"
          sx={{ fontWeight: 700, mb: isMobile ? 0.5 : 1, fontSize: isMobile ? 16 : undefined }}
        >
          Handlinger
        </Typography>

        {/* Bruger-handlinger */}
        <Grid container spacing={isMobile ? 0.5 : 1} sx={{ mb: isMobile ? 0.5 : 1 }}>
          {userActions.map(action => (
            <Grid item xs={6} sm={4} md={3} key={action}>
              <ActionButton
                action={action}
                onClick={() => onAction(action)}
                loading={!!actionLoading[action]}
                waiting={waitingAction === action}
                disabled={isDisabled(action)}
                isMobile={isMobile}
                isAdmin={isAdmin}
              />
            </Grid>
          ))}
        </Grid>

        {/* Admin-handlinger */}
        {isAdmin && (
          <Grid container spacing={isMobile ? 0.5 : 1} sx={{ mb: isMobile ? 0.5 : 1 }}>
            {adminActions.map(action => (
              <Grid item xs={6} sm={4} md={3} key={action}>
                <ActionButton
                  action={action}
                  onClick={() => onAction(action)}
                  loading={!!actionLoading[action]}
                  waiting={waitingAction === action}
                  disabled={isDisabled(action)}
                  isMobile={isMobile}
                  isAdmin={isAdmin}
                />
              </Grid>
            ))}

            {/* Terminal */}
            <Grid item xs={6} sm={4} md={3}>
              <Tooltip title="Åbn terminal" arrow>
                <span style={{ width: "100%" }}>
                  <Button
                    variant="outlined"
                    color="inherit"
                    size={isMobile ? "small" : "medium"}
                    startIcon={<TerminalIcon fontSize="small" />}
                    onClick={handleOpenTerminal}
                    disabled={isOffline || anyBusy}
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

            {/* Remote Desktop */}
            <Grid item xs={6} sm={4} md={3}>
              <Tooltip title="Åbn fjernskrivebord" arrow>
                <span style={{ width: "100%" }}>
                  <Button
                    variant="outlined"
                    color="inherit"
                    size={isMobile ? "small" : "medium"}
                    startIcon={<DesktopWindowsIcon fontSize="small" />}
                    onClick={handleOpenRemoteDesktop}
                    disabled={isOffline || anyBusy}
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
        )}

        {/* Offline-besked */}
        {isOffline && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 1, fontSize: isMobile ? 11 : 13 }}
          >
            Klienten er offline — nogle handlinger er ikke tilgængelige.
          </Typography>
        )}

        {/* Dvale-besked */}
        {isSleeping && !isOffline && (
          <Typography
            variant="body2"
            color="primary"
            sx={{ mt: 1, fontSize: isMobile ? 11 : 13 }}
          >
            Klienten er i dvale — brug "Væk klient" for at aktivere den.
          </Typography>
        )}
      </CardContent>

      {/* Bekræftelsesdialog */}
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
          <Button
            onClick={onConfirmAction}
            color="error"
            variant="contained"
            autoFocus
          >
            Bekræft
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
