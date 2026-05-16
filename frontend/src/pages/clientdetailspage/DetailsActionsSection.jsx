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
  - Ingen intern pollUntilConfirmed — ClientDetailsPage ejer den logik.
*/

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
        startIcon={isActive ? <CircularProgress size={16} color="inherit" /> : btn.icon}
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
    <Tooltip title={isDisabled && !isActive ? "Ikke tilgængelig" : btn.tooltip} arrow>
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
  // Prop fra ClientDetailsPage — true mens handling afventer klient-bekræftelse
  clientActionPending = false,
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
  const isSleeping = normalizedClientState.startsWith("sleep");

  const normalizedPendingAction = String(pendingChromeAction || "").trim().toLowerCase();
  const hasPendingAction =
    !!normalizedPendingAction && normalizedPendingAction !== "none";

  const anyLoading = Object.values(actionLoading).some(Boolean);
  // Lås alle knapper hvis: loading, refreshing, handling afventer klient, eller pending action
  const anyBusy = anyLoading || !!refreshing || clientActionPending || hasPendingAction;

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
  // Kør handling — ingen intern polling (ClientDetailsPage håndterer det)
  // ---------------------------------------------------------------------------
  const doAction = useCallback(
    async (action) => {
      if (clientOnline === false) {
        notify({ message: "Klienten er offline — handling afvist", severity: "warning" });
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
      return key === "wakeup";
    },
    [clientOnline, isSleeping]
  );

  // ---------------------------------------------------------------------------
  // Pending-label til info-banner
  // ---------------------------------------------------------------------------
  const pendingLabel = clientActionPending
    ? `Afventer klient: ${normalizedPendingAction !== "none" ? normalizedPendingAction : "handling"}`
    : hasPendingAction
    ? `Afventer klient: ${normalizedPendingAction}`
    : null;

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

        {/* Pending / waiting indicator */}
        {pendingLabel && (
          <Alert severity="info" sx={{ mb: 1.5 }} icon={<CircularProgress size={16} />}>
            {pendingLabel}
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
