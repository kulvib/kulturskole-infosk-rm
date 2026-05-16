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

  Ansvar:
  - Viser handlingsknapper og håndterer klik.
  - Al polling og lock-logik ligger i ClientDetailsPage (undgår blinking).
  - clientActionPending (prop) låser alle knapper mens en handling afventer klient.
  - isLiveStepBusy låser knapper + viser banner hvis liveStep er et aktivt
    busy-step — banneret følger headeren 1:1.
  - Ingen intern polling overhovedet.

  FIX #1: "shutdown_chrome" er fjernet fra BUSY_CHROME_STEPS.
  FIX #2: isDisabledByState bruger chromeIsRunning (udledt fra liveStep).
  FIX #3: "system_rebooting" og "system_shutting_down" er fjernet fra
    BUSY_CHROME_STEPS og flyttet til CHROME_STOPPED_STEPS.
  FIX #4: pendingLabel viser "liveChromeStatus · stepLabel" når begge har værdi,
    så headeren altid viser baseline-status + aktiv handling-tekst kombineret.

  BUSY_CHROME_STEPS (låser knapper + viser banner — kun MENS handling kører):
    clear_cookies            — rydder cookies
    terminate_chrome         — SIGTERM til Chrome
    kill_chrome              — SIGKILL til Chrome
    countdown                — nedtælling før start eller sleep
    system_reboot_countdown  — nedtælling før reboot efter wake

  TERMINAL_CHROME_STEPS (låser IKKE — processen er færdig):
    shutdown_chrome                — chrome shutdown bekræftet
    start_chrome                   — start-handling færdig
    chrome_closed_programmatically — stop/sleep-handling færdig
    chrome_closed_manual           — Chrome lukket manuelt
    system_sleep                   — sleep-handling færdig
    system_wake                    — wake-handling færdig
    system_rebooting               — reboot igangsat (terminal for reboot-action)
    system_shutting_down           — shutdown igangsat (terminal for shutdown-action)
    error                          — scenario fejlede

  CHROME_RUNNING_STEPS (Chrome er oppe):
    start_chrome
    chrome_opened_manual

  CHROME_STOPPED_STEPS (Chrome er nede):
    chrome_closed_programmatically
    chrome_closed_manual
    shutdown_chrome
    kill_chrome
    system_sleep
    system_rebooting       ← FIX #3: Chrome kører ikke under/efter reboot
    system_shutting_down   ← FIX #3: Chrome kører ikke under/efter shutdown
*/

const BUSY_CHROME_STEPS = new Set([
  "clear_cookies",
  "terminate_chrome",
  "kill_chrome",
  "countdown",
  "system_reboot_countdown",
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
  "system_rebooting",
  "system_shutting_down",
]);

// Oversæt faktiske chrome step-navne til læsbar dansk tekst.
// liveChromeStatus bruges IKKE som fallback her — kombinationen bygges manuelt i pendingLabel.
function getStepLabel(step) {
  if (!step) return null;
  const s = String(step).toLowerCase();
  if (s === "clear_cookies")                   return "Rydder cookies…";
  if (s === "terminate_chrome")                return "Lukker browser…";
  if (s === "kill_chrome")                     return "Tvangslukker browser…";
  if (s === "shutdown_chrome")                 return "Browser lukket";
  if (s === "countdown")                       return "Tæller ned…";
  if (s === "system_reboot_countdown")         return "Genstarter om lidt…";
  if (s === "system_rebooting")                return "Genstarter maskinen…";
  if (s === "system_shutting_down")            return "Lukker maskinen ned…";
  if (s === "start_chrome")                    return "Browser startet";
  if (s === "chrome_closed_programmatically")  return "Browser lukket";
  if (s === "chrome_closed_manual")            return "Browser lukket manuelt";
  if (s === "system_sleep")                    return "Klient i dvale";
  if (s === "system_wake")                     return "Klient vækket";
  if (s === "error")                           return "Der opstod en fejl";
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
  const isActive   = !!btn.loading;
  const isDisabled = isActive || anyBusy || !!btn.disabled;

  const button = (
    <span style={{ width: "100%" }}>
      <Button
        variant={btn.variant}
        color={btn.color}
        startIcon={
          isActive
            ? <CircularProgress size={16} color="inherit" />
            : btn.icon
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
      title={isDisabled && !isActive ? "Ikke tilgængelig" : btn.tooltip}
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
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { user } = useAuth();

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const [actionLoading, setActionLoading]           = useState({});
  const [shutdownDialogOpen, setShutdownDialogOpen] = useState(false);
  const [localSnackbar, setLocalSnackbar]           = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const normalizedClientState   = String(clientState || "").trim().toLowerCase();
  const isSleeping              = normalizedClientState.startsWith("sleep");
  const normalizedPendingAction = String(pendingChromeAction || "").trim().toLowerCase();
  const hasPendingAction        = !!normalizedPendingAction && normalizedPendingAction !== "none";

  const isLiveStepBusy = BUSY_CHROME_STEPS.has(String(liveStep ?? "").toLowerCase());

  const liveStepNorm = String(liveStep ?? "").toLowerCase();
  const chromeIsRunning = CHROME_RUNNING_STEPS.has(liveStepNorm)
    ? true
    : CHROME_STOPPED_STEPS.has(liveStepNorm)
    ? false
    : null;

  const anyLoading = Object.values(actionLoading).some(Boolean);

  const anyBusy = anyLoading || !!refreshing || clientActionPending || hasPendingAction || isLiveStepBusy;

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
      } finally {
        setActionLoading((prev) => ({ ...prev, [action]: false }));
      }
    },
    [clientOnline, handleClientAction, notify]
  );

  // ---------------------------------------------------------------------------
  // Disabled-logik per knap
  // ---------------------------------------------------------------------------
  const isDisabledByState = useCallback(
    (key) => {
      if (clientOnline === false) return true;
      if (isSleeping) return key !== "wakeup";
      if (key === "wakeup") return true;
      if (key === "start" && chromeIsRunning === true) return true;
      if (key === "stop" && chromeIsRunning === false) return true;
      return false;
    },
    [clientOnline, isSleeping, chromeIsRunning]
  );

  // ---------------------------------------------------------------------------
  // Pending-banner tekst
  // FIX #4: Kombinér liveChromeStatus og stepLabel når begge har værdi:
  //   "Chrome kører · Tæller ned…"
  // Hvis kun stepLabel → vis kun stepLabel.
  // Hvis ingen step matcher → vis liveChromeStatus alene eller fallback-tekst.
  // ---------------------------------------------------------------------------
  const pendingLabel = (() => {
    if (!clientActionPending && !hasPendingAction && !isLiveStepBusy) return null;
    const stepLabel = getStepLabel(liveStep);
    if (stepLabel) {
      return liveChromeStatus ? `${liveChromeStatus} · ${stepLabel}` : stepLabel;
    }
    if (liveChromeStatus) return liveChromeStatus;
    const actionName = normalizedPendingAction !== "none"
      ? normalizedPendingAction
      : "handling";
    return `Afventer klient: ${actionName}`;
  })();

  // ---------------------------------------------------------------------------
  // Knap-definitioner — Række 1
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
      disabled: isDisabledByState("start"),
      tooltip: chromeIsRunning === true
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
      tooltip: chromeIsRunning === false
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
      disabled: clientOnline === false,
      tooltip: "Åbn fjernskrivebord",
    },
  ];

  const cardStyle = clientOnline === false ? { opacity: 0.85 } : {};

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

        {clientOnline === false && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 1.5, fontSize: isMobile ? 11 : 13 }}
          >
            Klienten er offline — handlinger er ikke tilgængelige.
          </Typography>
        )}

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
            disabled={clientOnline === false || anyBusy}
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
