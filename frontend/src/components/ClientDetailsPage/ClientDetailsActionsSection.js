import React, { useState } from "react";
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
import DesktopWindowsIcon from "@mui/icons-material/DesktopWindows";
import TerminalIcon from "@mui/icons-material/Terminal";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import NightlightIcon from "@mui/icons-material/Nightlight";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import { useTheme } from "@mui/material/styles";
import { clientAction } from "../../api";
import { useAuth } from "../../auth/authcontext";

export default function ClientDetailsActionsSection({
  clientId,
  handleOpenTerminal,
  handleOpenRemoteDesktop,
}) {
  const [actionLoading, setActionLoading] = useState({});
  const [shutdownDialogOpen, setShutdownDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { user } = useAuth();

  // Smallere og centrerede knapper, stadig 4 pr række
  const actionBtnStyle = {
    minWidth: 0,
    maxWidth: 150,         // <--- Gør knappen smallere (fx 140-170 afh. af smag)
    height: 38,
    textTransform: "none",
    fontWeight: 500,
    fontSize: "0.87rem",
    lineHeight: 1.1,
    py: 0.25,
    px: 1.1,
    m: "0 auto",           // <--- Centrer knappen i gridcellen
    whiteSpace: "nowrap",
    display: "inline-flex",
    justifyContent: "center",
    borderRadius: 2,
    boxShadow: 1,
  };

  // Main action handler
  async function handleClientAction(action) {
    setActionLoading(prev => ({ ...prev, [action]: true }));
    try {
      await clientAction(clientId, action);
      setSnackbar({ open: true, message: 'Handling udført!', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: 'Fejl: ' + (err?.message || 'Kunne ikke udføre handling'), severity: 'error' });
    } finally {
      setActionLoading(prev => ({ ...prev, [action]: false }));
    }
  }

  // Wrapper for Tooltip så den ikke vises på mobil
  const MaybeTooltip = ({ title, children }) =>
    isMobile ? children : <Tooltip title={title}>{children}</Tooltip>;

  // --- Admin: 2 rækker af 4 knapper i ønsket rækkefølge ---
  const adminFirstRow = [
    {
      key: "chrome-start",
      label: "Start kiosk browser",
      icon: <ChromeReaderModeIcon />,
      color: "primary",
      variant: "outlined",
      onClick: () => handleClientAction("chrome-start"),
      loading: actionLoading["chrome-start"],
      tooltip: "Start kiosk browser",
    },
    {
      key: "chrome-shutdown",
      label: "Luk kiosk browser",
      icon: <PowerSettingsNewIcon />,
      color: "secondary",
      variant: "outlined",
      onClick: () => handleClientAction("chrome-shutdown"),
      loading: actionLoading["chrome-shutdown"],
      tooltip: "Luk kiosk browser",
    },
    {
      key: "sleep",
      label: "Sæt i dvale",
      icon: <NightlightIcon />,
      color: "info",
      variant: "outlined",
      onClick: () => handleClientAction("sleep"),
      loading: actionLoading["sleep"],
      tooltip: "Sæt klient i dvale",
    },
    {
      key: "wakeup",
      label: "Væk fra dvale",
      icon: <WbSunnyIcon />,
      color: "success",
      variant: "outlined",
      onClick: () => handleClientAction("wakeup"),
      loading: actionLoading["wakeup"],
      tooltip: "Væk klient fra dvale",
    },
  ];

  const adminSecondRow = [
    {
      key: "desktop",
      label: "Fjernskrivebord",
      icon: <DesktopWindowsIcon />,
      color: "primary",
      variant: "outlined",
      onClick: handleOpenRemoteDesktop,
      tooltip: "Fjernskrivebord på klient",
    },
    {
      key: "terminal",
      label: "Terminal på klient",
      icon: <TerminalIcon />,
      color: "inherit",
      variant: "outlined",
      onClick: handleOpenTerminal,
      tooltip: "Terminal på klient",
    },
    {
      key: "restart",
      label: "Genstart klient",
      icon: <RestartAltIcon />,
      color: "warning",
      variant: "contained",
      onClick: () => handleClientAction("restart"),
      loading: actionLoading["restart"],
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
      tooltip: "Sluk klient",
    },
  ];

  // --- Bruger: 1 række á 4 knapper, 2. række kun "Genstart klient" ---
  const userFirstRow = [
    adminFirstRow[0],
    adminFirstRow[1],
    adminFirstRow[2],
    adminFirstRow[3],
  ];
  const userSecondRow = [
    {
      key: "restart",
      label: "Genstart klient",
      icon: <RestartAltIcon />,
      color: "warning",
      variant: "contained",
      onClick: () => handleClientAction("restart"),
      loading: actionLoading["restart"],
      tooltip: "Genstart klient",
    }
  ];

  const renderButton = btn => (
    <Grid item xs={12} sm={6} md={3} key={btn.key}>
      <MaybeTooltip title={btn.tooltip}>
        <span style={{ display: "flex", justifyContent: "center" }}>
          <Button
            variant={btn.variant}
            color={btn.color}
            startIcon={btn.icon}
            disabled={!!btn.loading}
            onClick={btn.onClick}
            sx={actionBtnStyle}
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

  return (
    <Card elevation={2} sx={{ borderRadius: 2, mb: 2 }}>
      <CardContent sx={{ px: isMobile ? 1 : 2 }}>
        {user?.role === "admin" ? (
          <>
            <Grid container spacing={2} alignItems="center" justifyContent="center">
              {adminFirstRow.map(renderButton)}
            </Grid>
            <Box sx={{ height: 10 }} />
            <Grid container spacing={2} alignItems="center" justifyContent="center">
              {adminSecondRow.map(renderButton)}
            </Grid>
          </>
        ) : (
          <>
            <Grid container spacing={2} alignItems="center" justifyContent="center">
              {userFirstRow.map(renderButton)}
            </Grid>
            <Box sx={{ height: 10 }} />
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
                await handleClientAction("shutdown");
              }}
              color="error"
              variant="contained"
            >
              Ja, sluk klienten
            </Button>
          </DialogActions>
        </Dialog>
        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={() => setSnackbar(s => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={() => setSnackbar(s => ({ ...s, open: false }))}
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </CardContent>
    </Card>
  );
}
