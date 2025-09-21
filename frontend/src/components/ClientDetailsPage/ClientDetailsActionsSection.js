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

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { user } = useAuth();

  // Responsiv knapstyle
  const actionBtnStyle = {
    minWidth: 0,
    width: "100%",
    height: 44,
    textTransform: "none",
    fontWeight: 500,
    fontSize: "0.99rem",
    lineHeight: 1.13,
    py: 1,
    px: 1.5,
    m: 0,
    whiteSpace: "nowrap",
    display: "inline-flex",
    justifyContent: "center",
    borderRadius: 2.5,
    boxShadow: 1,
  };

  // Main action handler
  async function handleClientAction(action) {
    setActionLoading(prev => ({ ...prev, [action]: true }));
    try {
      await clientAction(clientId, action);
    } catch (err) {
      console.error("Fejl ved handling:", err);
    } finally {
      setActionLoading(prev => ({ ...prev, [action]: false }));
    }
  }

  // Wrapper for Tooltip så den ikke vises på mobil
  const MaybeTooltip = ({ title, children }) =>
    isMobile ? children : <Tooltip title={title}>{children}</Tooltip>;

  // Alle mulige knapper, rækkefølge: 1. række, 2. række (adminOnly markerer hvilke der kun vises til admin)
  const allButtons = [
    // Første række
    {
      key: "chrome-start",
      label: "Start kiosk browser",
      icon: <ChromeReaderModeIcon />,
      color: "primary",
      variant: "outlined",
      onClick: () => handleClientAction("chrome-start"),
      loading: actionLoading["chrome-start"],
      tooltip: "Start kiosk browser",
      adminOnly: false,
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
      adminOnly: false,
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
      adminOnly: false,
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
      adminOnly: false,
    },
    // Anden række
    {
      key: "restart",
      label: "Genstart klient",
      icon: <RestartAltIcon />,
      color: "warning",
      variant: "contained",
      onClick: () => handleClientAction("restart"),
      loading: actionLoading["restart"],
      tooltip: "Genstart klient",
      adminOnly: false,
    },
    {
      key: "desktop",
      label: "Fjernskrivebord",
      icon: <DesktopWindowsIcon />,
      color: "primary",
      variant: "outlined",
      onClick: handleOpenRemoteDesktop,
      tooltip: "Fjernskrivebord på klient",
      adminOnly: true,
    },
    {
      key: "terminal",
      label: "Terminal på klient",
      icon: <TerminalIcon />,
      color: "inherit",
      variant: "outlined",
      onClick: handleOpenTerminal,
      tooltip: "Terminal på klient",
      adminOnly: true,
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
      adminOnly: true,
    },
  ];

  // Filtrer knapper efter rolle
  const visibleButtons = allButtons.filter(
    btn => !btn.adminOnly || user?.role === "admin"
  );

  // To rækker af fire knapper (eller så mange der er)
  const firstRow = visibleButtons.slice(0, 4);
  const secondRow = visibleButtons.slice(4, 8);

  // Knap render
  const renderButton = btn => (
    <Grid item xs={12} sm={6} md={3} key={btn.key}>
      <MaybeTooltip title={btn.tooltip}>
        <span style={{ width: "100%" }}>
          <Button
            variant={btn.variant}
            color={btn.color}
            startIcon={btn.icon}
            disabled={!!btn.loading}
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

  return (
    <Card elevation={2} sx={{ borderRadius: 2, mb: 2 }}>
      <CardContent sx={{ px: isMobile ? 1 : 2 }}>
        <Grid container spacing={2} alignItems="center" justifyContent="center">
          {firstRow.map(renderButton)}
        </Grid>
        <Box sx={{ height: 16 }} />
        <Grid container spacing={2} alignItems="center" justifyContent="center">
          {secondRow.map(renderButton)}
        </Grid>
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
      </CardContent>
    </Card>
  );
}
