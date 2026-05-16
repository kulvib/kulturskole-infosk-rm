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
  DialogActions,
  DialogContentText,
  Alert,
  Snackbar,
} from "@mui/material";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import NightlightIcon from "@mui/icons-material/Nightlight";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import ChromeReaderModeIcon from "@mui/icons-material/ChromeReaderMode";
import StopIcon from "@mui/icons-material/Stop";
import TerminalIcon from "@mui/icons-material/Terminal";
import DesktopWindowsIcon from "@mui/icons-material/DesktopWindows";
import { useTheme } from "@mui/material/styles";
import { useAuth } from "../../auth/authcontext";
import { getClient, apiUrl } from "../../api";

/*
  DetailsActionsSection.jsx

  Fix: pollUntilConfirmed checker nu BÅDE pending_chrome_action OG chrome-status
  for at forhindre at låsen frigives mens klienten stadig er i countdown/startup-flow.
*/

const POLL_INTERVAL_MS = 1500;
const POLL_MAX_WAIT_MS = 60_000;

// Trin der indikerer at klienten er optaget — lås skal holdes
const BUSY_CHROME_STEPS = new Set([
  "countdown",
  "clear_cookies",
  "system_reboot_countdown",
]);

const ACTIONS_NEEDING_CONFIRMATION = new Set(["shutdown"]);
const ACTIONS_NEEDING_POLLING = new Set(["start", "stop", "sleep", "wakeup", "reboot"]);

const actionBtnStyle = {
  minWidth: 0,
  width: "100%",
  height: 38,
  fontSize: "0.95rem",
  textTransform: "none",
  fontWeight: 500,
  lineHeight: 1.18,
  py: 0.75,
  px: 1.25,
  m: 0,
  whiteSpace: "nowrap",
  display: "inline-flex",
  justifyContent: "center",
  borderRadius: 2.8,
  boxShadow: 1,
};

function ActionButton({ btn, isMobile, anyBusy }) {
  const isActive = !!btn.loading || !!btn.waiting;
  const isDisabled = isActive || anyBusy || !!btn.disabled;

  const button = (
    <span style={{ width: "100%" }}>
      <Button
        variant={btn.variant}
        color={btn.color}
        startIcon={isActive ? <CircularProgress size={16} color="inherit" /> : btn.icon}
        disabled={isDisabled}
        onClick={btn.onClick}
        sx={actionBtnStyle}
        fullWidth
      >
        {btn.waiting
          ? "Venter på klient…"
          : btn.loading
          ? "Arbejder..."
          : btn.label}
      </Button>
    </span>
  );

  if (isMobile) return button;
  return (
    <Tooltip title={isDisabled && !isActive ? "Ikke tilgængelig" : btn.tooltip} arrow>
      {button}
    </Tooltip>
  );
}

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function ClientDetailsActionsSection({
  clientId,
  clientState,
  pendingChromeAction,
  handleClientAction,
  handleOpenTerminal,
  handleOpenRemoteDesktop,
  refreshing,
  showSnackbar: showSnackbarProp,
  clientOnline = true,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { user } = useAuth();

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const [actionLoading, setActionLoading] = useState({});
  const [waitingAction, setWaitingAction] = useState(null);
  const [waitingLabel, setWaitingLabel] = useState("");
  const [shutdownDialogOpen, setShutdownDialogOpen] = useState(false);
  const [localSnackbar, setLocalSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const normalizedClientState = String(clientState || "").trim().toLowerCase();
  const isSleeping = normalizedClientState.startsWith("sleep");
  const normalizedPendingAction = String(pendingChromeAction || "").trim().toLowerCase();
  const hasPendingAction =
    !!normalizedPendingAction && normalizedPendingAction !== "none";

  const anyLoading = Object.values(actionLoading).some(Boolean);
  const anyWaiting = waitingAction !== null;
  const anyBusy = anyLoading || anyWaiting || !!refreshing;

  // ---------------------------------------------------------------------------
  // Snackbar
  // ---------------------------------------------------------------------------
  const notify = useCallback(
    (opts) => {
      if (typeof showSnackbarProp === "function") {
        showSnackbarProp(opts);
      } else {
        setLocalSnackbar({
          open: true,
          message: opts?.message ?? "",
          severity: opts?.severity ?? "success",
        });
      }
    },
    [showSnackbarProp]
  );

  // ---------------------------------------------------------------------------
  // Hent chrome-status og tjek om klienten stadig er i et aktivt trin
  // ---------------------------------------------------------------------------
  const isChromeStatusBusy = useCallback(async () => {
    if (!clientId) return false;
    try {
      const resp = await fetch(
        `${apiUrl}/api/clients/${clientId}/chrome-status`,
        { headers: getAuthHeaders(), signal: AbortSignal.timeout(4000) }
      );
      if (!resp.ok) return false;
      const data = await resp.json();
      const stepName = data?.step?.step ?? "";
      return BUSY_CHROME_STEPS.has(String(stepName).toLowerCase());
    } catch {
      return false;
    }
  }, [clientId]);

  // ---------------------------------------------------------------------------
  // Poll backend indtil:
  //   1) pending_chrome_action === "none"  OG
  //   2) chrome-status ikke er i et aktivt trin (countdown osv.)
  // ---------------------------------------------------------------------------
  const pollUntilConfirmed = useCallback(
    async (action) => {
      if (!ACTIONS_NEEDING_POLLING.has(action)) return;
      if (!clientId) return;

      setWaitingAction(action);
      setWaitingLabel("Venter på klient…");
      const start = Date.now();

      try {
        while (Date.now() - start < POLL_MAX_WAIT_MS) {
          await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));

          // Trin 1: pending_chrome_action skal være "none"
          let pcaClear = false;
          try {
            const data = await getClient(clientId);
            const pca = String(data?.pending_chrome_action || "").toLowerCase();
            pcaClear = !pca || pca === "none";
          } catch {
            // ignorer poll-fejl
          }

          if (!pcaClear) {
            setWaitingLabel("Afventer klient…");
            continue;
          }

          // Trin 2: chrome-status må ikke vise et aktivt trin (fx countdown)
          const stillBusy = await isChromeStatusBusy();
          if (stillBusy) {
            setWaitingLabel("Starter browser…");
            continue;
          }

          // Alt OK — frigiv låsen
          return;
        }
      } finally {
        setWaitingAction(null);
        setWaitingLabel("");
      }
    },
    [clientId, isChromeStatusBusy]
  );

  // ---------------------------------------------------------------------------
  // Kør handling
  // ---------------------------------------------------------------------------
  const doAction = useCallback(
    async (action) => {
      if (clientOnline === false) {
        notify({
          message: "Klienten er offline — handling afvist",
          severity: "warning",
        });
        return;
      }

      setActionLoading((prev) => ({ ...prev, [action]: true }));
      try {
        await handleClientAction(action);
      } catch (err) {
        notify({
          message: "Fejl: " + (err?.message || "Kunne ikke udføre handling"),
          severity: "error",
        });
        return;
      } finally {
        setActionLoading((prev) => ({ ...prev, [action]: false }));
      }

      await pollUntilConfirmed(action);
    },
    [clientOnline, handleClientAction, notify, pollUntilConfirmed]
  );

  // ---------------------------------------------------------------------------
  // Disabled-logik per knap
  // ---------------------------------------------------------------------------
  const isDisabledByState = useCallback(
    (key) => {
      if (clientOnline === false) return true;
      if (hasPendingAction) return true;
      if (isSleeping) return key !== "wakeup";
      return key === "wakeup";
    },
    [clientOnline, hasPendingAction, isSleeping]
  );

  // ---------------------------------------------------------------------------
  // Knap-definitioner — Række 1 (alle brugere)
  // ---------------------------------------------------------------------------
  const row1 = [
    {
      key: "start",
      label: "Start kiosk browser",
      icon: <ChromeReaderModeIcon />,
      color: "primary",
      variant: "outlined",
      onClick: () => doAction("start"),
      loading: !!actionLoading["start"],
      waiting: waitingAction === "start",
      disabled: isDisabledByState("start"),
      tooltip: "Start kiosk browser",
    },
    {
      key: "stop",
      label: "Stop kiosk browser",
      icon: <StopIcon />,
      color: "secondary",
      variant: "outlined",
      onClick: () => doAction("stop"),
      loading: !!actionLoading["stop"],
      waiting: waitingAction === "stop",
      disabled: isDisabledByState("stop"),
      tooltip: "Stop kiosk browser",
    },
    {
      key: "sleep",
      label: "Sæt i dvale",
      icon: <NightlightIcon />,
      color: "info",
      variant: "outlined",
      onClick: () => doAction("sleep"),
      loading: !!actionLoading["sleep"],
      waiting: waitingAction === "sleep",
      disabled: isDisabledByState("sleep"),
      tooltip: "Sæt klient i dvale",
    },
    {
      key: "wakeup",
      label: "Væk fra dvale",
      icon: <WbSunnyIcon />,
      color: "success",
      variant: "outlined",
      onClick: () => doAction("wakeup"),
      loading: !!actionLoading["wakeup"],
      waiting: waitingAction === "wakeup",
      disabled: isDisabledByState("wakeup"),
      tooltip: "Væk klient fra dvale",
    },
  ];

  // ---------------------------------------------------------------------------
  // Knap-definitioner — Række 2 (kun admin)
  // ---------------------------------------------------------------------------
  const row2Admin = [
    {
      key: "reboot",
      label: "Genstart klient",
      icon: <RestartAltIcon />,
      color: "warning",
      variant: "contained",
      onClick: () => doAction("reboot"),
      loading: !!actionLoading["reboot"],
      waiting: waitingAction === "reboot",
      disabled: clientOnline === false,
      tooltip: "Genstart klient",
    },
    {
      key: "shutdown",
      label: "Sluk klient",
      icon: <PowerSettingsNewIcon />,
      color: "error",
      variant: "contained",
      onClick: () => setShutdownDialogOpen(true),
      loading: !!actionLoading["shutdown"],
      waiting: false,
      disabled: clientOnline === false,
      tooltip: "Sluk klient — kræver fysisk tænding bagefter",
    },
    {
      key: "terminal",
      label: "Terminal",
      icon: <TerminalIcon />,
      color: "inherit",
      variant: "outlined",
      onClick: handleOpenTerminal,
      loading: false,
      waiting: false,
      disabled: clientOnline === false,
      tooltip: "Åbn terminal",
    },
    {
      key: "remote",
      label: "Fjernskrivebord",
      icon: <DesktopWindowsIcon />,
      color: "inherit",
      variant: "outlined",
      onClick: handleOpenRemoteDesktop,
      loading: false,
      waiting: false,
      disabled: clientOnline === false,
      tooltip: "Åbn fjernskrivebord",
    },
  ];

  const cardStyle = clientOnline === false ? { opacity: 0.85 } : {};

  return (
    <Card elevation={2} sx={{ borderRadius: 2, mb: 2, ...cardStyle }}>
      <CardContent sx={{ px: isMobile ? 1 : 2 }}>

        {/* Pending / waiting indicator */}
        {(hasPendingAction || anyWaiting) && (
          <Alert severity="info" sx={{ mb: 1.5 }}>
            {anyWaiting
              ? waitingLabel || `Venter på bekræftelse fra klient: ${waitingAction}`
              : `Afventer klient: ${normalizedPendingAction}`}
          </Alert>
        )}

        {/* Række 1 — alle brugere */}
        <Grid container spacing={2} alignItems="center" justifyContent="center">
          {row1.map((btn) => (
            <Grid item xs={12} sm={6} md={3} key={btn.key}>
              <ActionButton btn={btn} isMobile={isMobile} anyBusy={anyBusy} />
            </Grid>
          ))}
        </Grid>

        {/* Række 2 — kun admin */}
        {isAdmin && (
          <>
            <Box sx={{ height: 12 }} />
            <Grid container spacing={2} alignItems="center" justifyContent="center">
              {row2Admin.map((btn) => (
                <Grid item xs={12} sm={6} md={3} key={btn.key}>
                  <ActionButton btn={btn} isMobile={isMobile} anyBusy={anyBusy} />
                </Grid>
              ))}
            </Grid>
          </>
        )}

        {/* Offline-besked */}
        {clientOnline === false && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 1.5, fontSize: isMobile ? 11 : 13 }}
          >
            Klienten er offline — handlinger er ikke tilgængelige.
          </Typography>
        )}

        {/* Dvale-besked */}
        {isSleeping && clientOnline !== false && (
          <Typography
            variant="body2"
            color="primary"
            sx={{ mt: 1.5, fontSize: isMobile ? 11 : 13 }}
          >
            Klienten er i dvale — brug "Væk fra dvale" for at aktivere den.
          </Typography>
        )}
      </CardContent>

      {/* Bekræftelsesdialog — sluk */}
      <Dialog open={shutdownDialogOpen} onClose={() => setShutdownDialogOpen(false)}>
        <DialogTitle>Bekræft slukning af klient</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <strong>Ved dette valg skal klienten startes manuelt lokalt.</strong>
            <br />
            Er du sikker på, at du vil slukke klienten?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShutdownDialogOpen(false)} color="primary">
            Annuller
          </Button>
          <Button
            onClick={async () => {
              setShutdownDialogOpen(false);
              await doAction("shutdown");
            }}
            color="error"
            variant="contained"
            disabled={clientOnline === false || anyBusy}
          >
            Ja, sluk klienten
          </Button>
        </DialogActions>
      </Dialog>

      {/* Lokal snackbar fallback */}
      <Snackbar
        open={localSnackbar.open}
        autoHideDuration={3000}
        onClose={() => setLocalSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setLocalSnackbar((s) => ({ ...s, open: false }))}
          severity={localSnackbar.severity}
          sx={{ width: "100%" }}
        >
          {localSnackbar.message}
        </Alert>
      </Snackbar>
    </Card>
  );
}
