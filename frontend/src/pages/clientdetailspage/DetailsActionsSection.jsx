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
  FIX #4: pendingLabel viser "liveChromeStatus · stepLabel" når begge har værdi.
  FIX #5 (Løsning 2): REBOOT_SHUTDOWN_STEPS — låser knapper OG viser banner
    under system_rebooting / system_shutting_down. Banneret forsvinder naturligt
    når klienten kommer tilbage og skriver et nyt step. Ingen hang fordi et nyt
    step altid skrives ved opstart efter reboot/shutdown.

  BUSY_CHROME_STEPS (låser knapper + viser banner — kun MENS handling kører):
    clear_cookies            — rydder cookies
    terminate_chrome         — SIGTERM til Chrome
    kill_chrome              — SIGKILL til Chrome
    countdown                — nedtælling før start eller sleep
    system_reboot_countdown  — nedtælling før reboot efter wake

  REBOOT_SHUTDOWN_STEPS (FIX #5 — låser knapper + viser banner indtil nyt step):
    system_rebooting         — reboot igangsat, klient ikke klar endnu
    system_shutting_down     — shutdown igangsat, klient ikke klar endnu

  CHROME_RUNNING_STEPS (Chrome er oppe):
    start_chrome
    chrome_opened_manual

  CHROME_STOPPED_STEPS (Chrome er nede):
    chrome_closed_programmatically
    chrome_closed_manual
    shutdown_chrome
    kill_chrome
    system_sleep
    system_rebooting
    system_shutting_down
*/

// Låser knapper + viser banner mens aktiv handling kører
const BUSY_CHROME_STEPS = new Set([
  "clear_cookies",
  "terminate_chrome",
  "kill_chrome",
  "countdown",
  "system_reboot_countdown",
]);

// FIX #5 (Løsning 2): Låser knapper + viser banner under reboot/shutdown.
// Banneret forsvinder når klienten skriver et nyt step efter opstart.
// Ingen hang: klienten skriver altid chrome_closed_programmatically ved opstart.
const REBOOT_SHUTDOWN_STEPS = new Set([
  "system_rebooting",
  "system_shutting_down",
]);

// Steps der bekræfter Chrome kører
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

  const liveStepNorm   = String(liveStep ?? "").toLowerCase();
  const isLiveStepBusy = BUSY_CHROME_STEPS.has(liveStepNorm);

  // FIX #5 (Løsning 2): system_rebooting / system_shutting_down låser knapper
  // og viser banner. Banneret forsvinder automatisk når klienten skriver nyt step.
  const isRebootShutdownStep = REBOOT_SHUTDOWN_STEPS.has(liveStepNorm);

  const chromeIsRunning = CHROME_RUNNING_STEPS.has(liveStepNorm)
    ? true
    : CHROME_STOPPED_STEPS.has(liveStepNorm)
    ? false
    : null;

  const anyLoading = Object.values(actionLoading).some(Boolean);

  // FIX #5: isRebootShutdownStep medtaget i anyBusy
  const anyBusy =
    anyLoading ||
    !!refreshing ||
    clientActionPending ||
    hasPendingAction ||
    isLiveStepBusy ||
    isRebootShutdownStep;

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
  // FIX #4: Kombinér liveChromeStatus og stepLabel.
  // FIX #5 (Løsning 2): isRebootShutdownStep medtaget — banner vises under
  //   reboot/shutdown selv efter clientActionPending=false.
  // ---------------------------------------------------------------------------
  const pendingLabel = (() => {
    if (
      !clientActionPending &&
      !hasPendingAction &&
      !isLiveStepBusy &&
      !isRebootShutdownStep  // FIX #5
    ) return null;

    const stepLabel = getStepLabel(liveStep);
    if (stepLabel) {
      return liveChromeStatus
        ? `${liveChromeStatus} · ${stepLabel}`
        : stepLabel;
    }
    if (liveChromeStatus) return liveChromeStatus;
    const actionName =
      normalizedPendingAction !== "none" ? normalizedPendingAction : "handling";
    return `Afventer klient: ${actionName}`;
  })();

  // ---------------------------------------------------------------------------
  // Knap-definitioner — Række 1
  // ---------------------------------------------------------------------------
  const row1 = [
    {
      key: "start",
      label: "Start kiosk browser",
      tooltip: "Start kiosk browseren på klienten",
      icon: <ChromeReaderModeIcon fontSize="small" />,
      variant: "contained",
      color: "success",
      loading: !!actionLoading["start"],
      disabled: isDisabledByState("start"),
      onClick: () => doAction("start"),
    },
    {
      key: "stop",
      label: "Stop kiosk browser",
      tooltip: "Stop kiosk browseren på klienten",
      icon: <StopIcon fontSize="small" />,
      variant: "contained",
      color: "error",
      loading: !!actionLoading["stop"],
      disabled: isDisabledByState("stop"),
      onClick: () => doAction("stop"),
    },
  ];

  // ---------------------------------------------------------------------------
  // Knap-definitioner — Række 2
  // ---------------------------------------------------------------------------
  const row2 = [
    {
      key: "sleep",
      label: "Sæt i dvale",
      tooltip: "Sæt klienten i dvale (sluk skærm, stop browser)",
      icon: <NightlightIcon fontSize="small" />,
      variant: "outlined",
      color: "primary",
      loading: !!actionLoading["sleep"],
      disabled: isDisabledByState("sleep"),
      onClick: () => doAction("sleep"),
    },
    {
      key: "wakeup",
      label: "Væk klient",
      tooltip: "Væk klienten fra dvale",
      icon: <WbSunnyIcon fontSize="small" />,
      variant: "outlined",
      color: "warning",
      loading: !!actionLoading["wakeup"],
      disabled: isDisabledByState("wakeup"),
      onClick: () => doAction("wakeup"),
    },
  ];

  // ---------------------------------------------------------------------------
  // Knap-definitioner — Række 3 (kun admin)
  // ---------------------------------------------------------------------------
  const row3Admin = [
    {
      key: "reboot",
      label: "Genstart",
      tooltip: "Genstart klientens styresystem",
      icon: <RestartAltIcon fontSize="small" />,
      variant: "outlined",
      color: "warning",
      loading: !!actionLoading["reboot"],
      disabled: isDisabledByState("reboot"),
      onClick: () => doAction("reboot"),
    },
    {
      key: "shutdown",
      label: "Luk ned",
      tooltip: "Luk klientens styresystem ned",
      icon: <PowerSettingsNewIcon fontSize="small" />,
      variant: "outlined",
      color: "error",
      loading: !!actionLoading["shutdown"],
      disabled: isDisabledByState("shutdown"),
      onClick: () => setShutdownDialogOpen(true),
    },
    {
      key: "terminal",
      label: "Terminal",
      tooltip: "Åbn terminal til klienten",
      icon: <TerminalIcon fontSize="small" />,
      variant: "outlined",
      color: "inherit",
      loading: false,
      disabled: clientOnline === false,
      onClick: () => handleOpenTerminal && handleOpenTerminal(),
    },
    {
      key: "remote",
      label: "Skrivebord",
      tooltip: "Åbn fjernskrivebord til klienten",
      icon: <DesktopWindowsIcon fontSize="small" />,
      variant: "outlined",
      color: "inherit",
      loading: false,
      disabled: clientOnline === false,
      onClick: () => handleOpenRemoteDesktop && handleOpenRemoteDesktop(),
    },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent sx={{ pb: "12px !important" }}>

        {/* Banner — vises ved aktiv handling ELLER reboot/shutdown (FIX #5) */}
        {pendingLabel && (
          <Alert
            severity="info"
            sx={{ mb: 1.5, py: 0.5, fontSize: "0.875rem" }}
          >
            {pendingLabel}
          </Alert>
        )}

        {/* Række 1: Start / Stop */}
        <Grid container spacing={1} sx={{ mb: 1 }}>
          {row1.map((btn) => (
            <Grid item xs={6} key={btn.key}>
              <ActionButton btn={btn} isMobile={isMobile} anyBusy={anyBusy} />
            </Grid>
          ))}
        </Grid>

        {/* Række 2: Dvale / Vækk */}
        <Grid container spacing={1} sx={{ mb: isAdmin ? 1 : 0 }}>
          {row2.map((btn) => (
            <Grid item xs={6} key={btn.key}>
              <ActionButton btn={btn} isMobile={isMobile} anyBusy={anyBusy} />
            </Grid>
          ))}
        </Grid>

        {/* Række 3: Admin-knapper */}
        {isAdmin && (
          <Grid container spacing={1}>
            {row3Admin.map((btn) => (
              <Grid item xs={6} sm={3} key={btn.key}>
                <ActionButton btn={btn} isMobile={isMobile} anyBusy={anyBusy} />
              </Grid>
            ))}
          </Grid>
        )}
      </CardContent>

      {/* Shutdown-bekræftelsesdialog */}
      <Dialog
        open={shutdownDialogOpen}
        onClose={() => setShutdownDialogOpen(false)}
      >
        <DialogTitle>Bekræft nedlukning</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Er du sikker på, at du vil lukke klienten ned? Den skal tændes
            manuelt igen bagefter.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShutdownDialogOpen(false)}>Annuller</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              setShutdownDialogOpen(false);
              doAction("shutdown");
            }}
          >
            Luk ned
          </Button>
        </DialogActions>
      </Dialog>

      {/* Lokal snackbar-fallback (bruges når showSnackbar-prop mangler) */}
      <Snackbar
        open={localSnackbar.open}
        autoHideDuration={4000}
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
