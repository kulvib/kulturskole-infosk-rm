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
  useMediaQuery
} from "@mui/material";
import ChromeReaderModeIcon from "@mui/icons-material/ChromeReaderMode";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import DesktopWindowsIcon from "@mui/icons-material/DesktopWindows";
import TerminalIcon from "@mui/icons-material/Terminal";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import NightlightIcon from "@mui/icons-material/Nightlight";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import { useTheme } from "@mui/material/styles";
import { clientAction } from "../../api"; // <-- Brug din api.js funktion!

export default function ClientDetailsActionsSection({
  clientId,
  handleOpenTerminal,
  handleOpenRemoteDesktop,
}) {
  const [actionLoading, setActionLoading] = useState({});
  const [shutdownDialogOpen, setShutdownDialogOpen] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Responsiv knapstyle
  const actionBtnStyle = {
    minWidth: isMobile ? 0 : 200,
    maxWidth: isMobile ? "100%" : 200,
    width: isMobile ? "100%" : 200,
    height: isMobile ? 44 : 36,
    textTransform: "none",
    fontWeight: 500,
    fontSize: isMobile ? "0.99rem" : "0.95rem",
    lineHeight: 1.13,
    py: isMobile ? 1 : 0,
    px: isMobile ? 1.5 : 1,
    m: isMobile ? "0.5rem 0 0 0" : 0,
    whiteSpace: "nowrap",
    display: "inline-flex",
    justifyContent: "center",
    borderRadius: isMobile ? 2.5 : 2,
    boxShadow: isMobile ? 1 : undefined,
  };

  // Main action handler - bruger api.js (clientAction)
  async function handleClientAction(action) {
    setActionLoading(prev => ({ ...prev, [action]: true }));

    try {
      await clientAction(clientId, action); // Kald til backend via api.js
      // Optionelt: show feedback eller refetch data her
    } catch (err) {
      console.error("Fejl ved handling:", err);
      // Optionelt: show error feedback
    } finally {
      setActionLoading(prev => ({ ...prev, [action]: false }));
    }
  }

  // Wrapper for Tooltip så den ikke vises på mobil
  const MaybeTooltip = ({ title, children }) =>
    isMobile ? children : <Tooltip title={title}>{children}</Tooltip>;

  return (
    <Card elevation={2} sx={{ borderRadius: 2, mb: 2 }}>
      <CardContent sx={{ px: isMobile ? 1 : 2 }}>
        {/* Første række: Kiosk + dvale/væk */}
        <Box
          sx={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            mb: isMobile ? 1.5 : 2,
            gap: isMobile ? 1 : "20px",
          }}
        >
          <MaybeTooltip title="Start kiosk browser">
            <span style={{ width: isMobile ? "100%" : undefined }}>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<ChromeReaderModeIcon />}
                disabled={actionLoading["chrome-start"]}
                onClick={() => handleClientAction("chrome-start")}
                sx={actionBtnStyle}
                fullWidth={isMobile}
              >
                {actionLoading["chrome-start"] ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                Start kiosk browser
              </Button>
            </span>
          </MaybeTooltip>
          <MaybeTooltip title="Luk kiosk browser">
            <span style={{ width: isMobile ? "100%" : undefined }}>
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<PowerSettingsNewIcon />}
                disabled={actionLoading["chrome-shutdown"]}
                onClick={() => handleClientAction("chrome-shutdown")}
                sx={actionBtnStyle}
                fullWidth={isMobile}
              >
                {actionLoading["chrome-shutdown"] ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                Luk kiosk browser
              </Button>
            </span>
          </MaybeTooltip>
          <MaybeTooltip title="Sæt klient i dvale">
            <span style={{ width: isMobile ? "100%" : undefined }}>
              <Button
                variant="outlined"
                color="info"
                startIcon={<NightlightIcon />}
                disabled={actionLoading["sleep"]}
                onClick={() => handleClientAction("sleep")}
                sx={actionBtnStyle}
                fullWidth={isMobile}
              >
                {actionLoading["sleep"] ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                Sæt i dvale
              </Button>
            </span>
          </MaybeTooltip>
          <MaybeTooltip title="Væk klient fra dvale">
            <span style={{ width: isMobile ? "100%" : undefined }}>
              <Button
                variant="outlined"
                color="success"
                startIcon={<WbSunnyIcon />}
                disabled={actionLoading["wakeup"]}
                onClick={() => handleClientAction("wakeup")}
                sx={actionBtnStyle}
                fullWidth={isMobile}
              >
                {actionLoading["wakeup"] ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                Væk fra dvale
              </Button>
            </span>
          </MaybeTooltip>
        </Box>
        {/* Anden række: system og remote */}
        <Box
          sx={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            gap: isMobile ? 1 : "20px",
          }}
        >
          <MaybeTooltip title="Fjernskrivebord på klient">
            <span style={{ width: isMobile ? "100%" : undefined }}>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<DesktopWindowsIcon />}
                onClick={handleOpenRemoteDesktop}
                sx={actionBtnStyle}
                fullWidth={isMobile}
              >
                Fjernskrivebord
              </Button>
            </span>
          </MaybeTooltip>
          <MaybeTooltip title="Terminal på klient">
            <span style={{ width: isMobile ? "100%" : undefined }}>
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<TerminalIcon />}
                onClick={handleOpenTerminal}
                sx={actionBtnStyle}
                fullWidth={isMobile}
              >
                Terminal på klient
              </Button>
            </span>
          </MaybeTooltip>
          <MaybeTooltip title="Genstart klient">
            <span style={{ width: isMobile ? "100%" : undefined }}>
              <Button
                variant="contained"
                color="warning"
                startIcon={<RestartAltIcon />}
                disabled={actionLoading["restart"]}
                onClick={() => handleClientAction("restart")}
                sx={actionBtnStyle}
                fullWidth={isMobile}
              >
                {actionLoading["restart"] ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                Genstart klient
              </Button>
            </span>
          </MaybeTooltip>
          <MaybeTooltip title="Sluk klient">
            <span style={{ width: isMobile ? "100%" : undefined }}>
              <Button
                variant="contained"
                color="error"
                startIcon={<PowerSettingsNewIcon />}
                disabled={actionLoading["shutdown"]}
                onClick={() => setShutdownDialogOpen(true)}
                sx={actionBtnStyle}
                fullWidth={isMobile}
              >
                {actionLoading["shutdown"] ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                Sluk klient
              </Button>
            </span>
          </MaybeTooltip>
        </Box>
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
