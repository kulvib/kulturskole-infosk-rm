import React from "react";
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
} from "@mui/material";
import ChromeReaderModeIcon from "@mui/icons-material/ChromeReaderMode";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import DesktopWindowsIcon from "@mui/icons-material/DesktopWindows";
import TerminalIcon from "@mui/icons-material/Terminal";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import NightlightIcon from "@mui/icons-material/Nightlight"; // Dvale ikon
import WbSunnyIcon from "@mui/icons-material/WbSunny"; // Væk ikon

export default function ClientDetailsActionsSection({
  actionLoading,
  handleClientAction,
  handleOpenTerminal,
  handleOpenRemoteDesktop,
  shutdownDialogOpen,
  setShutdownDialogOpen,
}) {
  const actionBtnStyle = {
    minWidth: 200,
    maxWidth: 200,
    height: 36,
    textTransform: "none",
    fontWeight: 500,
    fontSize: "0.95rem",
    lineHeight: 1.1,
    py: 0,
    px: 1,
    m: 0,
    whiteSpace: "nowrap",
    display: "inline-flex",
    justifyContent: "center"
  };

  return (
    <Card elevation={2} sx={{ borderRadius: 2, mb: 2 }}>
      <CardContent sx={{ px: 2 }}>
        {/* Første række: Kiosk + dvale/væk */}
        <Box sx={{ 
          display: "flex", 
          flexDirection: "row", 
          alignItems: "center", 
          justifyContent: "center", 
          width: "100%", 
          mb: 2,
          gap: "20px"
        }}>
          <Tooltip title="Start kiosk browser">
            <span>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<ChromeReaderModeIcon />}
                disabled={actionLoading["chrome-start"]}
                onClick={() => handleClientAction("chrome-start")}
                sx={actionBtnStyle}
              >
                {actionLoading["chrome-start"] ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                Start kiosk browser
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Luk kiosk browser">
            <span>
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<PowerSettingsNewIcon />}
                disabled={actionLoading["chrome-shutdown"]}
                onClick={() => handleClientAction("chrome-shutdown")}
                sx={actionBtnStyle}
              >
                {actionLoading["chrome-shutdown"] ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                Luk kiosk browser
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Sæt klient i dvale">
            <span>
              <Button
                variant="outlined"
                color="info"
                startIcon={<NightlightIcon />}
                disabled={actionLoading["sleep"]}
                onClick={() => handleClientAction("sleep")}
                sx={actionBtnStyle}
              >
                {actionLoading["sleep"] ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                Sæt i dvale
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Væk klient fra dvale">
            <span>
              <Button
                variant="outlined"
                color="success"
                startIcon={<WbSunnyIcon />}
                disabled={actionLoading["wakeup"]}
                onClick={() => handleClientAction("wakeup")}
                sx={actionBtnStyle}
              >
                {actionLoading["wakeup"] ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                Væk fra dvale
              </Button>
            </span>
          </Tooltip>
        </Box>
        {/* Anden række: system og remote */}
        <Box sx={{ 
          display: "flex", 
          flexDirection: "row", 
          alignItems: "center", 
          justifyContent: "center", 
          width: "100%",
          gap: "20px"
        }}>
          <Tooltip title="Fjernskrivebord på klient">
            <span>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<DesktopWindowsIcon />}
                onClick={handleOpenRemoteDesktop}
                sx={actionBtnStyle}
              >
                Fjernskrivebord
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Terminal på klient">
            <span>
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<TerminalIcon />}
                onClick={handleOpenTerminal}
                sx={actionBtnStyle}
              >
                Terminal på klient
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Genstart klient">
            <span>
              <Button
                variant="contained"
                color="warning"
                startIcon={<RestartAltIcon />}
                disabled={actionLoading["restart"]}
                onClick={() => handleClientAction("restart")}
                sx={actionBtnStyle}
              >
                {actionLoading["restart"] ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                Genstart klient
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Sluk klient">
            <span>
              <Button
                variant="contained"
                color="error"
                startIcon={<PowerSettingsNewIcon />}
                disabled={actionLoading["shutdown"]}
                onClick={() => setShutdownDialogOpen(true)}
                sx={actionBtnStyle}
              >
                {actionLoading["shutdown"] ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                Sluk klient
              </Button>
            </span>
          </Tooltip>
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
