import React, { useState, useCallback, useEffect } from "react";
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
import SystemUpdateAltIcon from "@mui/icons-material/SystemUpdateAlt";
import { useTheme } from "@mui/material/styles";
import { useAuth } from "../../auth/authcontext";
import { getClientflowUpdateStatus, requestClientflowUpdate } from "../../api";

/*
  DetailsActionsSection.jsx

  FIX:
  - MUI crash "Cannot read properties of undefined (reading 'main')" skyldtes
    ugyldige color-props som "default" på Button i MUI v5.
  - Alle button colors er nu ændret til gyldige MUI-farver:
      primary, secondary, success, error, warning, info, inherit
  - Det forhindrer render-crash og gør at sektionen kan opdatere korrekt.

  KNAP-LOGIK:
  - Kiosk/system-knapper låses under igangværende actions.
  - Terminal og Fjernskrivebord låses ikke af almindelige kiosk-actions.
    De er supportværktøjer og skal kunne bruges til fejlfinding, mens fx
    "Start kiosk browser" eller "Stop kiosk browser" kører.
  - Terminal og Fjernskrivebord låses stadig, hvis klienten er offline,
    i en systemkritisk overgang som reboot/shutdown, eller mens ClientFlow
    opdateres.
*/

const BUSY_CHROME_STEPS = new Set([
  "clear_cookies",
  "terminate_chrome",
  "kill_chrome",
  "countdown",
  "display_sleep_countdown",
]);

const SYSTEM_LOCK_STEPS = new Set([
  "system_reboot_countdown",
  "system_rebooting",
  "system_shutting_down",
]);

const SYSTEM_SLEEP_STEPS = new Set([
  "system_sleep",
  "system_sleep_complete",
  "display_sleep",
  "display_sleep_complete",
  "display_sleep",
  "display_sleep_complete",
]);

// Kun reboot/shutdown-statusboksen skal auto-skjules efter 10 sekunder.
// Alle andre statusbeskeder bliver vist som før.
const AUTO_HIDE_BANNER_STEPS = new Set([
  "system_reboot_countdown",
  "system_rebooting",
  "system_shutting_down",
]);

const PENDING_BANNER_AUTO_HIDE_MS = 10_000;

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
  "display_sleep",
  "display_sleep_complete",
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
  if (s === "display_sleep_countdown") return "Skærm slukkes om lidt…";
  if (s === "system_reboot_countdown") return "Genstarter om lidt…";
  if (s === "system_rebooting") return "Genstarter maskinen…";
  if (s === "system_shutting_down") return "Lukker maskinen ned…";
  if (s === "start_chrome") return "Browser startet";
  if (s === "chrome_closed_programmatically") return "Browser lukket";
  if (s === "chrome_closed_manual") return "Browser lukket manuelt";
  if (s === "system_sleep" || s === "display_sleep") return "Skærm slukkes…";
  if (s === "system_sleep_complete" || s === "display_sleep_complete") return "Skærm slukket";
  if (s === "system_wake" || s === "display_wake") return "Skærm tændes…";
  if (s === "system_wake_complete" || s === "display_wake_complete") return "Skærm tændt";
  if (s === "error") return "Der opstod en fejl";
  return null;
}

const CLIENTFLOW_UPDATE_STEPS = [
  { key: "requested", label: "Afventer klient", description: "Backend har registreret opdateringen. Klienten henter den ved næste sync." },
  { key: "starting", label: "Starter opdatering", description: "Klienten har modtaget opdateringen og starter update-flowet." },
  { key: "preparing", label: "Klargør", description: "Klienten forbereder opdateringen og tjekker miljøet." },
  { key: "fetching_manifest", label: "Henter versionsinfo", description: "Klienten henter manifest og versionsinfo." },
  { key: "downloading", label: "Downloader", description: "Klienten downloader den nye ClientFlow-pakke." },
  { key: "verifying", label: "Verificerer", description: "Klienten verificerer download og indhold." },
  { key: "installing", label: "Installerer", description: "Klienten installerer den nye version." },
  { key: "stopping_services", label: "Genstarter services", description: "ClientFlow-services genstartes for at aktivere opdateringen." },
];

const CLIENTFLOW_UPDATE_BUSY_STEPS = new Set(CLIENTFLOW_UPDATE_STEPS.map((s) => s.key));

function normalizeUpdateStatus(status) {
  return String(status || "ready").trim().toLowerCase();
}

function getClientflowUpdateStepMeta(status) {
  const st = normalizeUpdateStatus(status);
  if (st === "ready") {
    return { label: "Klar", description: "Klienten er klar til opdatering.", index: -1, progress: 0 };
  }
  if (st === "success") {
    return { label: "Opdateret", description: "ClientFlow-opdateringen er gennemført.", index: CLIENTFLOW_UPDATE_STEPS.length, progress: 100 };
  }
  if (st === "error") {
    return { label: "Fejl", description: "ClientFlow-opdateringen fejlede.", index: -1, progress: 100 };
  }

  const index = CLIENTFLOW_UPDATE_STEPS.findIndex((step) => step.key === st);
  if (index >= 0) {
    const step = CLIENTFLOW_UPDATE_STEPS[index];
    return {
      ...step,
      index,
      progress: Math.round(((index + 1) / CLIENTFLOW_UPDATE_STEPS.length) * 100),
    };
  }

  return { label: st || "Ukendt", description: "Ukendt opdateringsstatus fra klienten.", index: -1, progress: 0 };
}

function formatUpdateDateTime(value) {
  if (!value) return null;
  const raw = String(value);
  const d = new Date(raw.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw}Z`);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
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

function ActionButton({ btn, isMobile, busy }) {
  const isActive = !!btn.loading;
  const lockDuringBusy = btn.lockDuringBusy !== false;
  const isDisabled = isActive || !!btn.disabled || (lockDuringBusy && !!busy);

  const tooltipText =
    isDisabled && !isActive
      ? btn.disabledTooltip || btn.tooltip || "Ikke tilgængelig"
      : btn.tooltip || "";

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
    <Tooltip title={tooltipText} arrow>
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
  const isSuperadmin = user?.role === "superadmin";

  const [actionLoading, setActionLoading] = useState({});
  const [shutdownDialogOpen, setShutdownDialogOpen] = useState(false);
  const [localSnackbar, setLocalSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [pendingBannerHidden, setPendingBannerHidden] = useState(false);
  const [clientflowUpdateStatus, setClientflowUpdateStatus] = useState(null);
  const [clientflowUpdatePolling, setClientflowUpdatePolling] = useState(false);

  const normalizedClientState = String(clientState || "").trim().toLowerCase();
  const normalizedPendingAction = String(pendingChromeAction || "").trim().toLowerCase();
  const hasPendingAction = !!normalizedPendingAction && normalizedPendingAction !== "none";

  const liveStepNorm = String(liveStep ?? "").trim().toLowerCase();

  const updateStatus = normalizeUpdateStatus(clientflowUpdateStatus?.client_update_status);
  const updateStepMeta = getClientflowUpdateStepMeta(updateStatus);
  const updateInProgress = CLIENTFLOW_UPDATE_BUSY_STEPS.has(updateStatus);
  const updateIsFinished = updateStatus === "success" || updateStatus === "error";
  const showClientflowUpdatePanel =
    updateInProgress ||
    updateIsFinished ||
    normalizedPendingAction === "clientflow_update" ||
    !!actionLoading["clientflow_update"];

  const updateStatusSeverity =
    updateStatus === "error" ? "error" :
    updateStatus === "success" ? "success" :
    "info";

  const updateRequestedAt = formatUpdateDateTime(clientflowUpdateStatus?.client_update_requested_at);
  const updateStartedAt = formatUpdateDateTime(clientflowUpdateStatus?.client_update_started_at);
  const updateFinishedAt = formatUpdateDateTime(clientflowUpdateStatus?.client_update_finished_at);
  const updateError = clientflowUpdateStatus?.client_update_error;
  const updateMessage = clientflowUpdateStatus?.client_update_message;
  const updateVersion = clientflowUpdateStatus?.client_version;

  // ClientFlow-opdatering er en software-/serviceopdatering på selve klienten.
  // Den skal derfor låse øvrige handlinger, også Terminal og Fjernskrivebord,
  // fordi de kan blive afbrudt når klientens services genstartes.
  const clientflowUpdateBusy =
    updateInProgress || normalizedPendingAction === "clientflow_update";

  const clientflowBusyTooltip =
    "ClientFlow opdateres — vent til opdateringen er færdig";

  const ubuntuUpdateBusy =
    normalizedClientState === "updating" || normalizedPendingAction === "os_update";

  const ubuntuUpdateBusyTooltip =
    "Ubuntu opdateres — vent til opdateringen er færdig";

  const shouldAutoHidePendingBanner = AUTO_HIDE_BANNER_STEPS.has(liveStepNorm);

  // System-level handlinger må låse hele knap-panelet.
  // pending_reboot/pending_shutdown cleares hurtigt på klienten, så frontend
  // skal bruge liveStep som sandhed under selve reboot/shutdown-flowet.
  const isSystemLocked =
    SYSTEM_LOCK_STEPS.has(liveStepNorm) ||
    normalizedClientState.startsWith("reboot") ||
    normalizedClientState.startsWith("shut");

  // Dvale skal ikke låse hele panelet; den skal kun efterlade "Væk fra dvale" aktiv.
  const isSleeping =
    normalizedClientState.startsWith("sleep") || SYSTEM_SLEEP_STEPS.has(liveStepNorm);

  const isLiveStepBusy = BUSY_CHROME_STEPS.has(liveStepNorm) || isSystemLocked;

  const chromeIsRunning = CHROME_RUNNING_STEPS.has(liveStepNorm)
    ? true
    : CHROME_STOPPED_STEPS.has(liveStepNorm)
    ? false
    : null;

  const anyLoading = Object.values(actionLoading).some(Boolean);

  // Almindelige kiosk/system-handlinger må låse hinanden for at undgå
  // kolliderende handlinger som start+stop, sleep+reboot osv.
  const actionPanelBusy =
    anyLoading ||
    !!refreshing ||
    clientActionPending ||
    hasPendingAction ||
    isLiveStepBusy ||
    clientflowUpdateBusy ||
    ubuntuUpdateBusy;

  // Supportværktøjer må ikke låses af almindelige kiosk-handlinger.
  // Terminal/fjernskrivebord er netop nyttige, når start/stop hænger.
  // De låses dog under ClientFlow-opdatering, fordi terminal-/remote-agenter
  // kan blive genstartet som en del af opdateringen.
  const supportToolsDisabled =
    clientOnline === false || isSystemLocked || clientflowUpdateBusy || ubuntuUpdateBusy;

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
      if (clientOnline === false) {
        notify({
          message: "Klienten er offline — handling afvist",
          severity: "warning",
        });
        return;
      }

      if (clientflowUpdateBusy) {
        notify({
          message: clientflowBusyTooltip,
          severity: "warning",
        });
        return;
      }

      if (ubuntuUpdateBusy) {
        notify({
          message: ubuntuUpdateBusyTooltip,
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
    [
      clientOnline,
      clientflowUpdateBusy,
      clientflowBusyTooltip,
      ubuntuUpdateBusy,
      ubuntuUpdateBusyTooltip,
      handleClientAction,
      notify,
    ]
  );

  const doClientflowUpdate = useCallback(async () => {
    if (clientOnline === false) {
      notify({
        message: "Klienten er offline — ClientFlow-opdatering afvist",
        severity: "warning",
      });
      return;
    }

    if (clientflowUpdateBusy) {
      notify({
        message: clientflowBusyTooltip,
        severity: "warning",
      });
      return;
    }

    if (ubuntuUpdateBusy) {
      notify({
        message: ubuntuUpdateBusyTooltip,
        severity: "warning",
      });
      return;
    }

    setActionLoading((prev) => ({ ...prev, clientflow_update: true }));
    try {
      const res = await requestClientflowUpdate(clientId);
      setClientflowUpdateStatus({
        client_update_status: res?.client_update_status || "requested",
        client_update_message: res?.client_update_message || res?.message || "Opdatering sendt til klienten",
        client_update_requested_at: res?.client_update_requested_at || null,
      });
      setClientflowUpdatePolling(true);
      notify({
        message: "ClientFlow-opdatering er sendt til klienten",
        severity: "success",
      });
    } catch (err) {
      notify({
        message: "Fejl: " + (err?.message || "Kunne ikke starte ClientFlow-opdatering"),
        severity: "error",
      });
    } finally {
      setActionLoading((prev) => ({ ...prev, clientflow_update: false }));
    }
  }, [
    clientId,
    clientOnline,
    clientflowUpdateBusy,
    clientflowBusyTooltip,
    ubuntuUpdateBusy,
    ubuntuUpdateBusyTooltip,
    notify,
  ]);

  const isDisabledByState = useCallback(
    (key) => {
      if (clientOnline === false) return true;
      if (isSystemLocked) return true;
      if (ubuntuUpdateBusy) return true;
      if (isSleeping) return key !== "wakeup";
      if (key === "wakeup") return true;
      if (key === "start" && chromeIsRunning === true) return true;
      if (key === "stop" && chromeIsRunning === false) return true;
      return false;
    },
    [clientOnline, isSystemLocked, ubuntuUpdateBusy, isSleeping, chromeIsRunning]
  );

  const pendingLabel = (() => {
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

  const hasPendingLabel = !!pendingLabel;
  const pendingBannerKey = [
    liveStepNorm,
    normalizedPendingAction,
    liveChromeStatus || "",
    pendingLabel || "",
  ].join("|");

  useEffect(() => {
    if (!hasPendingLabel) {
      setPendingBannerHidden(false);
      return undefined;
    }

    if (!shouldAutoHidePendingBanner) {
      setPendingBannerHidden(false);
      return undefined;
    }

    setPendingBannerHidden(false);
    const timer = window.setTimeout(() => {
      setPendingBannerHidden(true);
    }, PENDING_BANNER_AUTO_HIDE_MS);

    return () => window.clearTimeout(timer);
  }, [pendingBannerKey, hasPendingLabel, shouldAutoHidePendingBanner]);

  const visiblePendingLabel =
    pendingBannerHidden && shouldAutoHidePendingBanner ? null : pendingLabel;

  const refreshClientflowUpdateStatus = useCallback(async () => {
    if (!clientId) return null;
    try {
      const data = await getClientflowUpdateStatus(clientId);
      setClientflowUpdateStatus(data);
      return data;
    } catch {
      return null;
    }
  }, [clientId]);

  useEffect(() => {
    if (!clientId || clientOnline === false) return undefined;
    let stopped = false;
    (async () => {
      const data = await refreshClientflowUpdateStatus();
      const st = normalizeUpdateStatus(data?.client_update_status);
      if (!stopped && CLIENTFLOW_UPDATE_BUSY_STEPS.has(st)) {
        setClientflowUpdatePolling(true);
      }
    })();
    return () => { stopped = true; };
  }, [clientId, clientOnline, refreshClientflowUpdateStatus]);

  useEffect(() => {
    if (!clientflowUpdatePolling || !clientId) return undefined;
    let stopped = false;
    const timer = window.setInterval(async () => {
      const data = await refreshClientflowUpdateStatus();
      const st = normalizeUpdateStatus(data?.client_update_status);
      if (!CLIENTFLOW_UPDATE_BUSY_STEPS.has(st)) {
        if (!stopped) setClientflowUpdatePolling(false);
      }
    }, 2500);
    refreshClientflowUpdateStatus();
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [clientflowUpdatePolling, clientId, refreshClientflowUpdateStatus]);

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
      lockDuringBusy: true,
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
      lockDuringBusy: true,
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
      lockDuringBusy: true,
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
      lockDuringBusy: true,
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
      disabled: clientOnline === false || isSystemLocked || ubuntuUpdateBusy,
      lockDuringBusy: true,
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
      disabled: clientOnline === false || isSystemLocked || ubuntuUpdateBusy,
      lockDuringBusy: true,
      tooltip: "Sluk klient — kræver fysisk tænding bagefter",
    },
  ];

  const row2Superadmin = [
    {
      key: "terminal",
      label: "Terminal",
      icon: <TerminalIcon />,
      color: "inherit",
      variant: "outlined",
      onClick: handleOpenTerminal,
      loading: false,
      disabled: supportToolsDisabled,
      lockDuringBusy: false,
      disabledTooltip:
        clientflowUpdateBusy
          ? clientflowBusyTooltip
          : ubuntuUpdateBusy
          ? ubuntuUpdateBusyTooltip
          : clientOnline === false
          ? "Klienten er offline"
          : isSystemLocked
          ? "Klienten genstarter eller lukker ned"
          : "Ikke tilgængelig",
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
      disabled: supportToolsDisabled,
      lockDuringBusy: false,
      disabledTooltip:
        clientflowUpdateBusy
          ? clientflowBusyTooltip
          : ubuntuUpdateBusy
          ? ubuntuUpdateBusyTooltip
          : clientOnline === false
          ? "Klienten er offline"
          : isSystemLocked
          ? "Klienten genstarter eller lukker ned"
          : "Ikke tilgængelig",
      tooltip: "Åbn fjernskrivebord",
    },
    {
      key: "clientflow_update",
      label: "Opdater ClientFlow",
      icon: <SystemUpdateAltIcon />,
      color: "info",
      variant: "outlined",
      onClick: doClientflowUpdate,
      loading: !!actionLoading["clientflow_update"],
      disabled: supportToolsDisabled || clientflowUpdateBusy,
      lockDuringBusy: false,
      disabledTooltip:
        clientflowUpdateBusy
          ? clientflowBusyTooltip
          : ubuntuUpdateBusy
          ? ubuntuUpdateBusyTooltip
          : clientOnline === false
          ? "Klienten er offline"
          : isSystemLocked
          ? "Klienten genstarter eller lukker ned"
          : "Ikke tilgængelig",
      tooltip: "Opdater ClientFlow på klienten",
    },
  ];

  const cardStyle = clientOnline === false ? { opacity: 0.85 } : {};

  return (
    <Card elevation={2} sx={{ borderRadius: 2, mb: 2, ...cardStyle }}>
      <CardContent sx={{ px: isMobile ? 1 : 2 }}>
        {visiblePendingLabel && (
          <Alert
            severity="info"
            sx={{ mb: 1.5 }}
            icon={<CircularProgress size={16} />}
          >
            {visiblePendingLabel}
          </Alert>
        )}

        {showClientflowUpdatePanel && (
          <Alert
            severity={updateStatusSeverity}
            sx={{ mb: 1.5 }}
            icon={updateInProgress ? <CircularProgress size={16} /> : undefined}
          >
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  ClientFlow-opdatering: {updateStepMeta.label}
                  {updateVersion ? ` · v${updateVersion}` : ""}
                </Typography>
                {updateInProgress && (
                  <Typography variant="caption" color="text.secondary">
                    Trin {Math.max(updateStepMeta.index + 1, 1)} / {CLIENTFLOW_UPDATE_STEPS.length}
                  </Typography>
                )}
              </Box>

              <Typography variant="body2">
                {updateMessage || updateStepMeta.description}
              </Typography>

              {(updateInProgress || updateStatus === "success") && (
                <Box
                  sx={{
                    height: 7,
                    borderRadius: 999,
                    bgcolor: "rgba(0,0,0,0.12)",
                    overflow: "hidden",
                  }}
                >
                  <Box
                    sx={{
                      height: "100%",
                      width: `${Math.max(6, Math.min(100, updateStepMeta.progress || 6))}%`,
                      bgcolor: updateStatus === "success" ? "success.main" : "info.main",
                      transition: "width 250ms ease",
                    }}
                  />
                </Box>
              )}

              <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                {updateRequestedAt && (
                  <Typography variant="caption" color="text.secondary">Bestilt: {updateRequestedAt}</Typography>
                )}
                {updateStartedAt && (
                  <Typography variant="caption" color="text.secondary">Startet: {updateStartedAt}</Typography>
                )}
                {updateFinishedAt && (
                  <Typography variant="caption" color="text.secondary">Færdig: {updateFinishedAt}</Typography>
                )}
              </Box>

              {(updateError || updateStatus === "error") && (
                <Typography variant="body2" color="error.main">
                  Fejl: {updateError || updateMessage || "Klienten rapporterede en fejl under opdateringen."}
                </Typography>
              )}

              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 0.25 }}>
                <Button size="small" variant="outlined" onClick={refreshClientflowUpdateStatus}>
                  Opdater status
                </Button>
                {updateStatus === "error" && clientOnline !== false && !ubuntuUpdateBusy && (
                  <Button size="small" variant="contained" color="info" onClick={doClientflowUpdate}>
                    Prøv igen
                  </Button>
                )}
              </Box>
            </Box>
          </Alert>
        )}

        {clientflowUpdateBusy && !showClientflowUpdatePanel && (
          <Alert
            severity="info"
            sx={{ mb: 1.5 }}
            icon={<CircularProgress size={16} />}
          >
            ClientFlow opdateres — handlinger er midlertidigt deaktiveret.
          </Alert>
        )}

        {ubuntuUpdateBusy && !clientflowUpdateBusy && (
          <Alert
            severity="info"
            sx={{ mb: 1.5 }}
            icon={<CircularProgress size={16} />}
          >
            Ubuntu opdateres — handlinger er midlertidigt deaktiveret.
          </Alert>
        )}

        <Grid container spacing={2} alignItems="center" justifyContent="center">
          {row1.map((btn) => (
            <Grid item xs={12} sm={6} md={3} key={btn.key}>
              <ActionButton btn={btn} isMobile={isMobile} busy={actionPanelBusy} />
            </Grid>
          ))}
        </Grid>

        {isAdmin && (
          <>
            <Box sx={{ height: 12 }} />
            <Grid container spacing={2} alignItems="center" justifyContent="center">
              {row2Admin.map((btn) => (
                <Grid item xs={12} sm={6} md={isSuperadmin ? 3 : 6} key={btn.key}>
                  <ActionButton btn={btn} isMobile={isMobile} busy={actionPanelBusy} />
                </Grid>
              ))}

              {isSuperadmin && row2Superadmin.map((btn) => (
                <Grid item xs={12} sm={6} md={3} key={btn.key}>
                  <ActionButton btn={btn} isMobile={isMobile} busy={actionPanelBusy} />
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

        {isSleeping && clientOnline !== false && !ubuntuUpdateBusy && (
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
            disabled={clientOnline === false || actionPanelBusy}
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
