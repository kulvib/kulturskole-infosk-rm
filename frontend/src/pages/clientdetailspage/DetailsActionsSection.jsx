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

/*
  DetailsActionsSection.jsx

  - Viser handlingsknapper for en klient: start/stop browser, sleep/wake, reboot, shutdown.
  - Kun admin/superadmin ser reboot, shutdown, terminal og remote desktop.
  - FIX: Alle knapper er disabled mens en handling kører (actionLoading guard).
  - FIX: Shutdown-bekræftelsesdialog er robust mod manglende showSnackbar prop.
  - FIX: clientOnline bruges til at disable knapper når klienten er offline.
  - pending_chrome_action og clientState bruges til at vise korrekt knap-tilstand.
*/

const ACTION_LABELS = {
  start: "Start browser",
  stop: "Stop browser",
  sleep: "Sæt i dvale",
  wakeup: "Væk klient",
  restart: "Genstart browser",
  reboot: "Genstart maskine",
  shutdown: "Sluk maskine",
};

const ACTION_ICONS = {
  start: <OpenInBrowserIcon fontSize="small" />,
  stop: <CloseIcon fontSize="small" />,
  sleep: <HotelIcon fontSize="small" />,
  wakeup: <WbSunnyIcon fontSize="small" />,
  restart: <RestartAltIcon fontSize="small" />,
  reboot: <RestartAltIcon fontSize="small" />,
  shutdown: <PowerSettingsNewIcon fontSize="small" />,
};

const ACTION_COLORS = {
  start: "success",
  stop: "error",
  sleep: "primary",
  wakeup: "warning",
  restart: "secondary",
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
  disabled,
  isMobile,
  isAdmin,
}) {
  if (ADMIN_ONLY_ACTIONS.has(action) && !isAdmin) return null;

  const label = ACTION_LABELS[action] ?? action;
  const icon = ACTION_ICONS[action] ?? null;
  const color = ACTION_COLORS[action] ?? "primary";

  return (
    <Tooltip title={disabled && !loading ? "Ikke tilgængelig" : label} arrow>
      <span style={{ width: "100%" }}>
        <Button
          variant="outlined"
          color={color}
          size={isMobile ? "small" : "medium"}
          startIcon={loading ? <CircularProgress size={isMobile ? 13 : 16} color="inherit" /> : icon}
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

  const [actionLoading, setActionLoading] = useState({});
  const [confirmDialog, setConfirmDialog] = useState({ open: false, action: null });

  const isSleeping = typeof clientState === "string" &&
    clientState.toLowerCase().startsWith("sleep");

  const isOffline = clientOnline === false;

  // FIX: Alle knapper disabled mens én handling kører
  const anyLoading = Object.values(actionLoading).some(Boolean);

  const safeShowSnackbar = useCallback((opts) => {
    if (typeof showSnackbar === "function") {
      showSnackbar(opts);
    } else {
      console.warn("[snackbar]", opts?.message);
    }
  }, [showSnackbar]);

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
        message: "Fejl ved handling: " + (err?.message || String(err)),
        severity: "error",
      });
    } finally {
      setActionLoading(prev => ({ ...prev, [action]: false }));
    }
  }, [confirmDialog.action, handleClientAction, safeShowSnackbar]);

  const onCancelConfirm = useCallback(() => {
    setConfirmDialog({ open: false, action: null });
  }, []);

  // Beregn hvilke knapper der er disabled
  const isDisabled = useCallback((action) => {
    if (anyLoading) return true;
    if (refreshing) return true;

    // Sleep/wake afhænger ikke af online-status (de er netværkskommandoer)
    if (action === "sleep") return isSleeping;
    if (action === "wakeup") return !isSleeping;

    // Reboot og shutdown kræver ikke nødvendigvis online
    if (action === "reboot" || action === "shutdown") return false;

    // Resten kræver online
    if (isOffline) return true;

    if (action === "start") {
      // Disabled hvis browser allerede starter/kører
      const pca = typeof pendingChromeAction === "string"
        ? pendingChromeAction.toLowerCase()
        : "";
      return pca === "start" || pca === "none" === false;
    }
    if (action === "stop") return false;
    if (action === "restart") return isOffline;

    return false;
  }, [anyLoading, refreshing, isSleeping, isOffline, pendingChromeAction]);

  // Bruger-synlige handlinger i rækkefølge
  const userActions = ["start", "stop", "restart", "sleep", "wakeup"];
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
            <Grid item xs={6} sm={4} md={2} key={action}>
              <ActionButton
                action={action}
                onClick={() => onAction(action)}
                loading={!!actionLoading[action]}
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
              <Grid item xs={6} sm={4} md={2} key={action}>
                <ActionButton
                  action={action}
                  onClick={() => onAction(action)}
                  loading={!!actionLoading[action]}
                  disabled={isDisabled(action)}
                  isMobile={isMobile}
                  isAdmin={isAdmin}
                />
              </Grid>
            ))}

            {/* Terminal */}
            <Grid item xs={6} sm={4} md={2}>
              <Tooltip title="Åbn terminal" arrow>
                <span style={{ width: "100%" }}>
                  <Button
                    variant="outlined"
                    color="inherit"
                    size={isMobile ? "small" : "medium"}
                    startIcon={<TerminalIcon fontSize="small" />}
                    onClick={handleOpenTerminal}
                    disabled={isOffline || anyLoading}
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
            <Grid item xs={6} sm={4} md={2}>
              <Tooltip title="Åbn fjernskrivebord" arrow>
                <span style={{ width: "100%" }}>
                  <Button
                    variant="outlined"
                    color="inherit"
                    size={isMobile ? "small" : "medium"}
                    startIcon={<DesktopWindowsIcon fontSize="small" />}
                    onClick={handleOpenRemoteDesktop}
                    disabled={isOffline || anyLoading}
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
