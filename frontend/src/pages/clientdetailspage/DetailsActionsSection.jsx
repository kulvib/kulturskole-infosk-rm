import React, { useState, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Tooltip,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Divider,
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

  Layout: To rækker med gruppeoverskrifter
    Række 1 — Browser:  Start browser | Stop browser | Genstart browser
    Række 1 — Dvale:    Sæt i dvale   | Væk klient
    Række 2 — Maskine:  Genstart maskine | Sluk maskine        (kun admin)
    Række 2 — Værktøjer: Terminal | Fjernskrivebord            (kun admin)

  FIX: Alle knapper er disabled når pendingChromeAction IKKE er "none"/"null"
  — forhindrer at flere processer køres parallelt på klienten.
*/

const ACTION_LABELS = {
  start:    "Start browser",
  stop:     "Stop browser",
  restart:  "Genstart browser",
  sleep:    "Sæt i dvale",
  wakeup:   "Væk klient",
  reboot:   "Genstart maskine",
  shutdown: "Sluk maskine",
};

const ACTION_ICONS = {
  start:    <OpenInBrowserIcon fontSize="small" />,
  stop:     <CloseIcon fontSize="small" />,
  restart:  <RestartAltIcon fontSize="small" />,
  sleep:    <HotelIcon fontSize="small" />,
  wakeup:   <WbSunnyIcon fontSize="small" />,
  reboot:   <RestartAltIcon fontSize="small" />,
  shutdown: <PowerSettingsNewIcon fontSize="small" />,
};

const ACTION_COLORS = {
  start:    "success",
  stop:     "error",
  restart:  "secondary",
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
    body: "Er du sikker på at du vil slukke maskinen? Den skal tændes fysisk igen efterfølgende.",
  },
  reboot: {
    title: "Bekræft genstart",
    body: "Er du sikker på at du vil genstarte maskinen?",
  },
};

// Er der en aktiv pending action på klienten (sendt fra backend)?
function hasPendingAction(pendingChromeAction) {
  if (!pendingChromeAction) return false;
  const pca = String(pendingChromeAction).toLowerCase().trim();
  return pca !== "" && pca !== "none";
}

function ActionButton({ action, onClick, loading, disabled, isMobile, isAdmin, variant = "outlined" }) {
  if (ADMIN_ONLY_ACTIONS.has(action) && !isAdmin) return null;

  const label = ACTION_LABELS[action] ?? action;
  const icon  = ACTION_ICONS[action]  ?? null;
  const color = ACTION_COLORS[action] ?? "primary";

  return (
    <Tooltip title={disabled && !loading ? "Ikke tilgængelig" : label} arrow>
      <span>
        <Button
          variant={variant}
          color={color}
          size={isMobile ? "small" : "medium"}
          startIcon={loading
            ? <CircularProgress size={isMobile ? 13 : 16} color="inherit" />
            : icon}
          onClick={onClick}
          disabled={disabled || loading}
          sx={{
            textTransform: "none",
            fontWeight: 500,
            fontSize: isMobile ? "0.80rem" : "0.88rem",
            px: isMobile ? 1 : 1.5,
            py: isMobile ? 0.4 : 0.65,
            minHeight: isMobile ? 32 : 38,
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "Arbejder..." : label}
        </Button>
      </span>
    </Tooltip>
  );
}

function GroupLabel({ label, isMobile }) {
  return (
    <Typography
      variant="caption"
      sx={{
        fontWeight: 700,
        color: "text.secondary",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        fontSize: isMobile ? 10 : 11,
        mb: 0.5,
        display: "block",
      }}
    >
      {label}
    </Typography>
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
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { user } = useAuth();

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const [actionLoading, setActionLoading]   = useState({});
  const [confirmDialog, setConfirmDialog]   = useState({ open: false, action: null });

  const isSleeping = typeof clientState === "string" &&
    clientState.toLowerCase().startsWith("sleep");

  const isOffline = clientOnline === false;

  // FIX: Alle knapper disabled mens én lokal handling kører
  const anyLocalLoading = Object.values(actionLoading).some(Boolean);

  // FIX: Alle knapper disabled når klienten allerede har en igangværende pending action
  const clientBusy = hasPendingAction(pendingChromeAction);

  // Samlet blokering: lokalt loading, refresh, eller klient er optaget
  const globalBlocked = anyLocalLoading || refreshing || clientBusy;

  const safeShowSnackbar = useCallback((opts) => {
    if (typeof showSnackbar === "function") showSnackbar(opts);
    else console.warn("[snackbar]", opts?.message);
  }, [showSnackbar]);

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

  // Disabled-logik pr. action
  const isDisabled = useCallback((action) => {
    // Global blokering: lokal process, refresh, eller klient har pending action
    if (globalBlocked) return true;

    if (action === "sleep")   return isSleeping;
    if (action === "wakeup")  return !isSleeping;

    // Reboot/shutdown kræver ikke nødvendigvis online
    if (action === "reboot" || action === "shutdown") return false;

    // Alt andet kræver online
    if (isOffline) return true;

    return false;
  }, [globalBlocked, isSleeping, isOffline]);

  const confirmInfo = confirmDialog.action
    ? (CONFIRM_TEXTS[confirmDialog.action] ?? { title: "Bekræft", body: "Er du sikker?" })
    : { title: "", body: "" };

  const rowGap = isMobile ? 0.5 : 1;

  return (
    <Card elevation={2} sx={{ borderRadius: isMobile ? 1 : 2 }}>
      <CardContent sx={{ px: isMobile ? 1 : 2, py: isMobile ? 1 : 2 }}>
        <Typography
          variant="h6"
          sx={{ fontWeight: 700, mb: isMobile ? 0.75 : 1.25, fontSize: isMobile ? 16 : undefined }}
        >
          Handlinger
        </Typography>

        {/* ── Række 1: Browser + Dvale ── */}
        <Box
          sx={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: isMobile ? 1 : 2,
            mb: isMobile ? 1 : 1.5,
            alignItems: isMobile ? "stretch" : "flex-start",
          }}
        >
          {/* Gruppe: Browser */}
          <Box>
            <GroupLabel label="Browser" isMobile={isMobile} />
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: rowGap }}>
              {["start", "stop", "restart"].map(action => (
                <ActionButton
                  key={action}
                  action={action}
                  onClick={() => onAction(action)}
                  loading={!!actionLoading[action]}
                  disabled={isDisabled(action)}
                  isMobile={isMobile}
                  isAdmin={isAdmin}
                />
              ))}
            </Box>
          </Box>

          {!isMobile && (
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          )}

          {/* Gruppe: Dvale */}
          <Box>
            <GroupLabel label="Dvale" isMobile={isMobile} />
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: rowGap }}>
              {["sleep", "wakeup"].map(action => (
                <ActionButton
                  key={action}
                  action={action}
                  onClick={() => onAction(action)}
                  loading={!!actionLoading[action]}
                  disabled={isDisabled(action)}
                  isMobile={isMobile}
                  isAdmin={isAdmin}
                />
              ))}
            </Box>
          </Box>
        </Box>

        {/* ── Række 2: Maskine + Værktøjer (kun admin) ── */}
        {isAdmin && (
          <>
            <Divider sx={{ mb: isMobile ? 1 : 1.25 }} />
            <Box
              sx={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                gap: isMobile ? 1 : 2,
                alignItems: isMobile ? "stretch" : "flex-start",
              }}
            >
              {/* Gruppe: Maskine */}
              <Box>
                <GroupLabel label="Maskine" isMobile={isMobile} />
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: rowGap }}>
                  {["reboot", "shutdown"].map(action => (
                    <ActionButton
                      key={action}
                      action={action}
                      onClick={() => onAction(action)}
                      loading={!!actionLoading[action]}
                      disabled={isDisabled(action)}
                      isMobile={isMobile}
                      isAdmin={isAdmin}
                    />
                  ))}
                </Box>
              </Box>

              {!isMobile && (
                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              )}

              {/* Gruppe: Værktøjer */}
              <Box>
                <GroupLabel label="Værktøjer" isMobile={isMobile} />
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: rowGap }}>
                  <Tooltip title="Åbn terminal" arrow>
                    <span>
                      <Button
                        variant="outlined"
                        color="inherit"
                        size={isMobile ? "small" : "medium"}
                        startIcon={<TerminalIcon fontSize="small" />}
                        onClick={handleOpenTerminal}
                        disabled={isOffline || globalBlocked}
                        sx={{
                          textTransform: "none",
                          fontWeight: 500,
                          fontSize: isMobile ? "0.80rem" : "0.88rem",
                          px: isMobile ? 1 : 1.5,
                          py: isMobile ? 0.4 : 0.65,
                          minHeight: isMobile ? 32 : 38,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Terminal
                      </Button>
                    </span>
                  </Tooltip>

                  <Tooltip title="Åbn fjernskrivebord" arrow>
                    <span>
                      <Button
                        variant="outlined"
                        color="inherit"
                        size={isMobile ? "small" : "medium"}
                        startIcon={<DesktopWindowsIcon fontSize="small" />}
                        onClick={handleOpenRemoteDesktop}
                        disabled={isOffline || globalBlocked}
                        sx={{
                          textTransform: "none",
                          fontWeight: 500,
                          fontSize: isMobile ? "0.80rem" : "0.88rem",
                          px: isMobile ? 1 : 1.5,
                          py: isMobile ? 0.4 : 0.65,
                          minHeight: isMobile ? 32 : 38,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Fjernskrivebord
                      </Button>
                    </span>
                  </Tooltip>
                </Box>
              </Box>
            </Box>
          </>
        )}

        {/* Status-beskeder */}
        {clientBusy && !anyLocalLoading && (
          <Typography
            variant="body2"
            color="warning.main"
            sx={{ mt: 1, fontSize: isMobile ? 11 : 13 }}
          >
            Klienten har en igangværende handling ({pendingChromeAction}) — vent til den er færdig.
          </Typography>
        )}

        {isOffline && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 1, fontSize: isMobile ? 11 : 13 }}
          >
            Klienten er offline — nogle handlinger er ikke tilgængelige.
          </Typography>
        )}

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
        <DialogTitle id="confirm-dialog-title">{confirmInfo.title}</DialogTitle>
        <DialogContent>
          <DialogContentText id="confirm-dialog-description">
            {confirmInfo.body}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancelConfirm} color="inherit">Annuller</Button>
          <Button onClick={onConfirmAction} color="error" variant="contained" autoFocus>
            Bekræft
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
