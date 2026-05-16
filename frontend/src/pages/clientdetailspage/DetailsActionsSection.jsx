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

/*
  DetailsActionsSection.jsx

  FIX:
  - MUI crash "Cannot read properties of undefined (reading 'main')" skyldtes
    ugyldige color-props som "default" på Button i MUI v5.
  - Alle button colors er nu ændret til gyldige MUI-farver:
      primary, secondary, success, error, warning, info, inherit
  - Det forhindrer render-crash og gør at sektionen kan opdatere korrekt.
*/

const BUSY_CHROME_STEPS = new Set([
  "clear_cookies",
  "terminate_chrome",
  "kill_chrome",
  "countdown",
]);

const SYSTEM_LOCK_STEPS = new Set([
  "system_reboot_countdown",
  "system_rebooting",
  "system_shutting_down",
  "system_wake",
]);

const SYSTEM_SLEEP_STEPS = new Set([
  "system_sleep",
  "system_sleep_complete",
]);

const CHROME_RUNNING_STEPS = new Set([
  "start_chrome",
  "chrome_opened_manual",
]);

const CHROME_STOPPED_STEPS = new Set([
  "chrome_closed_programmatically",
  "chrome_closed_manual",
  "shutdown_chrome",
  "kill_chrome",
  "system_sleep",
  "system_sleep_complete",
  "system_rebooting",
  "system_shutting_down",
]);

function getStepLabel(step) {
  if (!step) return null;
  const s = String(step).toLowerCase();
  if (s === "clear_cookies") return "Rydder cookies…";
  if (s === "terminate_chrome") return "Lukker browser…";
  if (s === "kill_chrome") return "Tvangslukker browser…";
  if (s === "shutdown_chrome") return "Browser lukket";
  if (s === "countdown") return "Tæller ned…";
  if (s === "system_reboot_countdown") return "Genstarter om lidt…";
  if (s === "system_rebooting") return "Genstarter maskinen…";
  if (s === "system_shutting_down") return "Lukker maskinen ned…";
  if (s === "start_chrome") return "Browser startet";
  if (s === "chrome_closed_programmatically") return "Browser lukket";
  if (s === "chrome_closed_manual") return "Browser lukket manuelt";
  if (s === "system_sleep") return "Klient i dvale";
  if (s === "system_sleep_complete") return "Klient sat i dvale";
  if (s === "system_wake") return "Klient vækkes…";
  if (s === "system_wake_complete") return "Klient vækket";
  if (s === "error") return "Der opstod en fejl";
  return null;
}

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
  const isActive = !!btn.loading;
  const isDisabled = isActive || anyBusy || !!btn.disabled;

  const button = (
    <span style={{ width: "100%" }}>
      <Button
        variant={btn.variant}
        color={btn.color}
        startIcon={
          isActive ? <CircularProgress size={16} color="inherit" /> : btn.icon
        }
        disabled={isDisabled}
        onClick={btn.onClick}
        sx={actionBtnStyle}
        fullWidth
      >
        {btn.loading ? "Arbejder..." : btn.label}
      </Button>
    </span>
  );

  if (isMobile) return button;

  return (
    <Tooltip
      title={isDisabled && !isActive ? "Ikke tilgængelig" : (btn.tooltip || "")}
      arrow
    >
      {button}
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
  showSnackbar: showSnackbarProp,
  clientOnline = true,
  clientActionPending = false,
  liveStep = null,
  liveChromeStatus = null,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { user } = useAuth();

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const [actionLoading, setActionLoading] = useState({});
  const [shutdownDialogOpen, setShutdownDialogOpen] = useState(false);
  const [localSnackbar, setLocalSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const normalizedClientState = String(clientState || "").trim().toLowerCase();
  const normalizedPendingAction = String(pendingChromeAction || "").trim().toLowerCase();
  const hasPendingAction = !!normalizedPendingAction && normalizedPendingAction !== "none";
  const isOffline = clientOnline === false;

  const liveStepNorm = String(liveStep ?? "").trim().toLowerCase();

  // System-level handlinger må låse hele knap-panelet.
  // pending_reboot/pending_shutdown cleares hurtigt på klienten, så frontend
  // skal bruge liveStep som sandhed under selve reboot/shutdown-flowet.
  const stateLooksSystemLocked =
    normalizedClientState.startsWith("reboot") ||
    normalizedClientState.startsWith("shut");

  const isSystemLocked =
    SYSTEM_LOCK_STEPS.has(liveStepNorm) ||
    ((clientActionPending || hasPendingAction) && stateLooksSystemLocked);

  // Dvale skal ikke låse hele panelet; den skal kun efterlade "Væk fra dvale" aktiv.
  const isSleeping =
    normalizedClientState.startsWith("sleep") || SYSTEM_SLEEP_STEPS.has(liveStepNorm);

  const isLiveStepBusy = !isOffline && (BUSY_CHROME_STEPS.has(liveStepNorm) || isSystemLocked);

  const chromeIsRunning = CHROME_RUNNING_STEPS.has(liveStepNorm)
    ? true
    : CHROME_STOPPED_STEPS.has(liveStepNorm)
    ? false
    : null;

  const anyLoading = Object.values(actionLoading).some(Boolean);
  const anyBusy =
    !isOffline &&
    (anyLoading ||
      !!refreshing ||
      clientActionPending ||
      hasPendingAction ||
      isLiveStepBusy);

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

  const doAction = useCallback(
    async (action) => {
      if (isOffline) {
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
      } finally {
        setActionLoading((prev) => ({ ...prev, [action]: false }));
      }
    },
    [isOffline, handleClientAction, notify]
  );

  const isDisabledByState = useCallback(
    (key) => {
      if (isOffline) return true;
      if (isSystemLocked) return true;
      if (isSleeping) return key !== "wakeup";
      if (key === "wakeup") return true;
      if (key === "start" && chromeIsRunning === true) return true;
      if (key === "stop" && chromeIsRunning === false) return true;
      return false;
    },
    [isOffline, isSystemLocked, isSleeping, chromeIsRunning]
  );

  const pendingLabel = (() => {
    // Når klienten er offline under reboot/shutdown, skal den blå
    // “Klient genstarter…”-tekst ikke blive hængende oven på offline-visningen.
    if (isOffline) return null;
    if (!clientActionPending && !hasPendingAction && !isLiveStepBusy) return null;
    const stepLabel = getStepLabel(liveStep);
    if (stepLabel) {
      return liveChromeStatus ? `${liveChromeStatus} · ${stepLabel}` : stepLabel;
    }
    if (liveChromeStatus) return liveChromeStatus;
    const actionName =
      normalizedPendingAction !== "none" ? normalizedPendingAction : "handling";
    return `Afventer klient: ${actionName}`;
  })();

  const row1 = [
    {
      key: "start",
      label: "Start kiosk browser",
      icon: <ChromeReaderModeIcon />,
      color: "primary",
      variant: "outlined",
      onClick: () => doAction("start"),
      loading: !!actionLoading["start"],
      disabled: isDisabledByState("start"),
      tooltip:
        chromeIsRunning === true
          ? "Kiosk browser kører allerede"
          : "Start kiosk browser",
    },
    {
      key: "stop",
      label: "Stop kiosk browser",
      icon: <StopIcon />,
      color: "secondary",
      variant: "outlined",
      onClick: () => doAction("stop"),
      loading: !!actionLoading["stop"],
      disabled: isDisabledByState("stop"),
      tooltip:
        chromeIsRunning === false
          ? "Kiosk browser er allerede stoppet"
          : "Stop kiosk browser",
    },
    {
      key: "sleep",
      label: "Sæt i dvale",
      icon: <NightlightIcon />,
      color: "info",
      variant: "outlined",
      onClick: () => doAction("sleep"),
      loading: !!actionLoading["sleep"],
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
      disabled: isDisabledByState("wakeup"),
      tooltip: "Væk klient fra dvale",
    },
  ];

  const row2Admin = [
    {
      key: "reboot",
      label: "Genstart klient",
      icon: <RestartAltIcon />,
      color: "warning",
      variant: "contained",
      onClick: () => doAction("reboot"),
      loading: !!actionLoading["reboot"],
      disabled: isOffline,
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
      disabled: isOffline,
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
      disabled: isOffline,
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
      disabled: isOffline,
      tooltip: "Åbn fjernskrivebord",
    },
  ];

  const cardStyle = isOffline ? { opacity: 0.85 } : {};

  return (
    <Card elevation={2} sx={{ borderRadius: 2, mb: 2, ...cardStyle }}>
      <CardContent sx={{ px: isMobile ? 1 : 2 }}>
        {pendingLabel && (
          <Alert
            severity="info"
            sx={{ mb: 1.5 }}
            icon={<CircularProgress size={16} />}
          >
            {pendingLabel}
          </Alert>
        )}

        <Grid container spacing={2} alignItems="center" justifyContent="center">
          {row1.map((btn) => (
            <Grid item xs={12} sm={6} md={3} key={btn.key}>
              <ActionButton btn={btn} isMobile={isMobile} anyBusy={anyBusy} />
            </Grid>
          ))}
        </Grid>

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

        {isOffline && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 1.5, fontSize: isMobile ? 11 : 13 }}
          >
            Klienten er offline — handlinger er ikke tilgængelige.
          </Typography>
        )}

        {isSleeping && !isOffline && (
          <Typography
            variant="body2"
            color="primary"
            sx={{ mt: 1.5, fontSize: isMobile ? 11 : 13 }}
          >
            Klienten er i dvale — brug "Væk fra dvale" for at aktivere den.
          </Typography>
        )}
      </CardContent>

      <Dialog
        open={shutdownDialogOpen}
        onClose={() => setShutdownDialogOpen(false)}
      >
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
            disabled={isOffline || anyBusy}
          >
            Ja, sluk klienten
          </Button>
        </DialogActions>
      </Dialog>

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
