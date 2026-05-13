import React, { useState, useCallback, useEffect } from "react";
import {
  Card,
  CardContent,
  Box,
  Button,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  useMediaQuery,
  Grid,
  Snackbar,
  Alert
} from "@mui/material";
import ChromeReaderModeIcon from "@mui/icons-material/ChromeReaderMode";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import NightlightIcon from "@mui/icons-material/Nightlight";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import { useTheme } from "@mui/material/styles";
import { clientAction } from "../../api";
import { useAuth } from "../../auth/authcontext";

// Denne komponent opdateres ikke via polling eller client-objekt – kun via props ændret af brugerhandlinger!
// Ændring: bruger wrapperens showSnackbar hvis den er tilgængelig; fallback til lokal snackbar ellers.
// Også: nulstil lokal actionLoading når clientId ændrer sig eller når optional prop `refreshing` skifter til false.
// Rettet: hvis parent sender handleClientAction, benyttes den; ellers fallback til intern clientAction.
// NYT: respectér clientOnline === false og deaktiver knapper/visuelt nedtonet karton.

function ClientDetailsActionsSection({
  clientId,
  clientState,
  pendingChromeAction,
  handleOpenTerminal,
  handleOpenRemoteDesktop,
  refreshing, // optional: hvis wrapper sender refreshing-flag kan vi rydde loading når refresh er færdig
  showSnackbar, // optional: funktion fra wrapper til at vise snackbar centrally
  handleClientAction: parentHandleClientAction, // optional: parent kan håndtere action
  clientOnline = true // NEW: hvis false => alle handlinger disabled / greyed out
}) {
  const [actionLoading, setActionLoading] = useState({});
  const [shutdownDialogOpen, setShutdownDialogOpen] = useState(false);
  const [localSnackbar, setLocalSnackbar] = useState({ open: false, message: "", severity: "success" });

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { user } = useAuth();
  const normalizedClientState = String(clientState || "").trim().toLowerCase();
  const isSleeping = normalizedClientState.startsWith("sleep");
  const normalizedPendingAction = String(pendingChromeAction || "").trim().toLowerCase();
  const hasPendingAction = !!normalizedPendingAction && normalizedPendingAction !== "none";

  // Nulstil lokale loading-states når clientId skifter (fx ved navigation) for at undgå fastlåst UI
  useEffect(() => {
    setActionLoading({});
  }, [clientId]);

  // Hvis parent sender refreshing, ryd også loading når refreshing går fra true -> false
  useEffect(() => {
    if (typeof refreshing !== "undefined") {
      if (!refreshing) {
        setActionLoading({});
      }
    }
  }, [refreshing]);

  // Helper: centraliseret notifikation (brug wrapper hvis tilgængelig, ellers lokal snackbar)
  const notify = useCallback((msgObj) => {
    if (typeof showSnackbar === "function") {
      try {
        showSnackbar(msgObj);
      } catch (e) {
        // Fallback til lokal snackbar hvis wrapper-fejl
        setLocalSnackbar({ open: true, message: msgObj.message || "", severity: msgObj.severity || "success" });
      }
    } else {
      setLocalSnackbar({ open: true, message: msgObj.message || "", severity: msgObj.severity || "success" });
    }
  }, [showSnackbar]);

  // Intern fallback handler (bruges hvis parent ikke leverer handleClientAction)
  const internalHandleClientAction = useCallback(async (action) => {
    setActionLoading(prev => ({ ...prev, [action]: true }));
    try {
      await clientAction(clientId, action);
      notify({ message: 'Handling udført!', severity: 'success' });
    } catch (err) {
      notify({ message: 'Fejl: ' + (err?.message || 'Kunne ikke udføre handling'), severity: 'error' });
      throw err;
    } finally {
      setActionLoading(prev => ({ ...prev, [action]: false }));
    }
  }, [clientId, notify]);

  // Højere-niveau wrapper der bruger parent's handler hvis tilgængelig, ellers fallback til intern
  const doClientAction = useCallback(async (action) => {
    // If client explicitly offline, disallow actions
    if (clientOnline === false) {
      notify({ message: "Klienten er offline — handling afvist", severity: "warning" });
      return;
    }

    setActionLoading(prev => ({ ...prev, [action]: true }));
    try {
      if (typeof parentHandleClientAction === "function") {
        // parent forventes at returnere et Promise
        await parentHandleClientAction(action);
        // antag at parent selv viser snackbar; hvis ikke, vis success fallback
        notify({ message: 'Handling udført!', severity: 'success' });
      } else {
        await internalHandleClientAction(action);
      }
    } catch (err) {
      // Sørg for at forwardere fejlmeddelelse via notify (hvis parent ikke gjorde det)
      notify({ message: 'Fejl: ' + (err?.message || 'Kunne ikke udføre handling'), severity: 'error' });
    } finally {
      setActionLoading(prev => ({ ...prev, [action]: false }));
    }
  }, [parentHandleClientAction, internalHandleClientAction, notify, clientOnline]);

  // Wrapper for Tooltip så den ikke vises på mobil
  const MaybeTooltip = ({ title, children }) =>
    isMobile ? children : <Tooltip title={title}>{children}</Tooltip>;

  // Tilpasset knapstyle: height: 38px og harmoniske værdier
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

  const isDisabledByState = useCallback((actionKey) => {
    if (clientOnline === false || hasPendingAction) return true;
    if (isSleeping) {
      return actionKey !== "wakeup";
    }
    return actionKey === "wakeup";
  }, [clientOnline, hasPendingAction, isSleeping]);

  // --- Admin: 2 rækker af 4 knapper i ønsket rækkefølge ---
  const adminFirstRow = [
    {
      key: "chrome-start",
      label: "Start kiosk browser",
      icon: <ChromeReaderModeIcon />,
      color: "primary",
      variant: "outlined",
      onClick: () => doClientAction("chrome-start"),
      loading: actionLoading["chrome-start"],
      disabled: isDisabledByState("chrome-start"),
      tooltip: "Start kiosk browser",
    },
    {
      key: "chrome-stop",
      label: "Stop kiosk browser",
      icon: <PowerSettingsNewIcon />,
      color: "secondary",
      variant: "outlined",
      onClick: () => doClientAction("chrome-stop"),
      loading: actionLoading["chrome-stop"],
      disabled: isDisabledByState("chrome-stop"),
      tooltip: "Stop kiosk browser",
    },
    {
      key: "sleep",
      label: "Sæt i dvale",
      icon: <NightlightIcon />,
      color: "info",
      variant: "outlined",
      onClick: () => doClientAction("sleep"),
      loading: actionLoading["sleep"],
      disabled: isDisabledByState("sleep"),
      tooltip: "Sæt klient i dvale",
    },
    {
      key: "wakeup",
      label: "Væk fra dvale",
      icon: <WbSunnyIcon />,
      color: "success",
      variant: "outlined",
      onClick: () => doClientAction("wakeup"),
      loading: actionLoading["wakeup"],
      disabled: isDisabledByState("wakeup"),
      tooltip: "Væk klient fra dvale",
    },
  ];

  const adminSecondRow = [
    {
      key: "restart",
      label: "Genstart klient",
      icon: <RestartAltIcon />,
      color: "warning",
      variant: "contained",
      onClick: () => doClientAction("restart"),
      loading: actionLoading["restart"],
      disabled: isDisabledByState("restart"),
      tooltip: "Genstart klient",
    },
    {
      key: "shutdown",
      label: "Sluk klient",
      icon: <PowerSettingsNewIcon />,
      color: "error",
      variant: "contained",
      onClick: () => setShutdownDialogOpen(true),
      loading: actionLoading["shutdown"],
      disabled: isDisabledByState("shutdown"),
      tooltip: "Sluk klient",
    },
    {
      key: "livestream_start",
      label: "Start livestream",
      icon: <PlayArrowIcon />,
      color: "success",
      variant: "outlined",
      onClick: () => doClientAction("livestream_start"),
      loading: actionLoading["livestream_start"],
      disabled: isDisabledByState("livestream_start"),
      tooltip: "Start livestream",
    },
    {
      key: "livestream_stop",
      label: "Stop livestream",
      icon: <StopIcon />,
      color: "error",
      variant: "outlined",
      onClick: () => doClientAction("livestream_stop"),
      loading: actionLoading["livestream_stop"],
      disabled: isDisabledByState("livestream_stop"),
      tooltip: "Stop livestream",
    },
  ];

  // --- Bruger: samme handlinger ---
  const userFirstRow = [
    adminFirstRow[0],
    adminFirstRow[1],
    adminFirstRow[2],
    adminFirstRow[3],
  ];
  const userSecondRow = adminSecondRow;

  const renderButton = btn => (
    <Grid item xs={12} sm={6} md={3} key={btn.key}>
      <MaybeTooltip title={btn.tooltip}>
        <span style={{ width: "100%" }}>
          <Button
            variant={btn.variant}
            color={btn.color}
            startIcon={btn.icon}
            disabled={!!btn.loading || !!btn.disabled}
            onClick={btn.onClick}
            sx={actionBtnStyle}
            fullWidth
          >
            {btn.loading ? (
              <CircularProgress size={16} sx={{ mr: 1 }} />
            ) : null}
            {btn.label}
          </Button>
        </span>
      </MaybeTooltip>
    </Grid>
  );

  // Visual hint for offline (not blocking pointerEvents so dialogs/controls still work)
  const cardStyle = clientOnline === false ? { opacity: 0.85 } : {};

  return (
    <Card elevation={2} sx={{ borderRadius: 2, mb: 2, ...cardStyle }}>
      <CardContent sx={{ px: isMobile ? 1 : 2 }}>
        {(user?.role === "admin" || user?.role === "superadmin") ? (
          <>
            {hasPendingAction && (
              <Alert severity="info" sx={{ mb: 1.5 }}>
                Afventer klient: {normalizedPendingAction}
              </Alert>
            )}
            <Grid container spacing={2} alignItems="center" justifyContent="center">
              {adminFirstRow.map(renderButton)}
            </Grid>
            <Box sx={{ height: 12 }} />
            <Grid container spacing={2} alignItems="center" justifyContent="center">
              {adminSecondRow.map(renderButton)}
            </Grid>
          </>
        ) : (
          <>
            {hasPendingAction && (
              <Alert severity="info" sx={{ mb: 1.5 }}>
                Afventer klient: {normalizedPendingAction}
              </Alert>
            )}
            <Grid container spacing={2} alignItems="center" justifyContent="center">
              {userFirstRow.map(renderButton)}
            </Grid>
            <Box sx={{ height: 12 }} />
            <Grid container spacing={2} alignItems="center" justifyContent="center">
              {userSecondRow.map(renderButton)}
            </Grid>
          </>
        )}
        <Dialog open={shutdownDialogOpen} onClose={() => setShutdownDialogOpen(false)}>
          <DialogTitle>Bekræft slukning af klient</DialogTitle>
          <DialogContent>
            <Typography>
              <strong>Ved dette valg skal klienten startes manuelt lokalt.</strong>
              <br />
              Er du sikker på, at du vil slukke klienten?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShutdownDialogOpen(false)} color="primary">
              Annuller
            </Button>
            <Button
              onClick={async () => {
                setShutdownDialogOpen(false);
                await doClientAction("shutdown");
              }}
              color="error"
              variant="contained"
              disabled={isDisabledByState("shutdown")}
            >
              Ja, sluk klienten
            </Button>
          </DialogActions>
        </Dialog>

        {/* Lokal snackbar fallback hvis wrapper ikke leverer showSnackbar */}
        <Snackbar
          open={localSnackbar.open}
          autoHideDuration={3000}
          onClose={() => setLocalSnackbar(s => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={() => setLocalSnackbar(s => ({ ...s, open: false }))}
            severity={localSnackbar.severity}
            sx={{ width: '100%' }}
          >
            {localSnackbar.message}
          </Alert>
        </Snackbar>
      </CardContent>
    </Card>
  );
}

// Memoize for kun at re-rendre på prop-skift
export default React.memo(ClientDetailsActionsSection);
