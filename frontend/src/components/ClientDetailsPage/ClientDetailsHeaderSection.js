import React from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Tooltip,
  Snackbar,
  Alert as MuiAlert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  TextField,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RefreshIcon from "@mui/icons-material/Refresh";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useNavigate } from "react-router-dom";

function CopyIconButton({ value, disabled, iconSize = 16 }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {}
  };

  return (
    <Tooltip title={copied ? "Kopieret!" : "Kopiér"}>
      <span>
        <Button
          size="small"
          onClick={handleCopy}
          style={{
            minWidth: 24,
            maxWidth: 24,
            minHeight: 24,
            maxHeight: 24,
            padding: 0,
            margin: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            verticalAlign: "middle",
          }}
          disabled={disabled}
        >
          <ContentCopyIcon style={{ fontSize: iconSize }} color={copied ? "success" : "inherit"} />
        </Button>
      </span>
    </Tooltip>
  );
}

function ClientStatusIcon({ isOnline }) {
  return (
    <Box sx={{
      display: "inline-flex",
      alignItems: "center",
      fontFamily: "Roboto, Helvetica, Arial, sans-serif",
      fontSize: 13,
      fontWeight: 400,
      ml: 2,
    }}>
      <Box sx={{
        width: 14,
        height: 14,
        borderRadius: "50%",
        bgcolor: isOnline ? "#43a047" : "#e53935",
        boxShadow: "0 0 2px rgba(0,0,0,0.12)",
        border: "1px solid #ddd",
      }} />
      <span style={{ marginLeft: 6 }}>{isOnline ? "online" : "offline"}</span>
    </Box>
  );
}

function StateBadge({ state }) {
  let dotColor = "grey.400";
  let text = state || "Ukendt";
  if (state) {
    switch (state.toLowerCase()) {
      case "normal":
        dotColor = "#43a047";
        break;
      case "sleep":
        dotColor = "#1976d2";
        break;
      case "maintenance":
        dotColor = "#ffa000";
        break;
      case "error":
        dotColor = "#e53935";
        break;
      case "offline":
        dotColor = "#757575";
        break;
      default:
        dotColor = "grey.400";
    }
  }
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", ml: 3 }}>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 700,
          fontSize: "0.9rem",
          mr: 1,
        }}
      >
        Drifttilstand:
      </Typography>
      <Box
        sx={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          bgcolor: dotColor,
          boxShadow: "0 0 2px rgba(0,0,0,0.12)",
          border: "1px solid #ddd",
          mr: 1,
        }}
      />
      <Typography
        variant="body2"
        sx={{
          fontWeight: 400,
          fontSize: "0.9rem",
        }}
      >
        {text}
      </Typography>
    </Box>
  );
}

function ChromeStatusIcon({ status, color }) {
  let fallbackColor = "grey.400";
  let text = status || "Ukendt";
  let dotColor = color || fallbackColor;

  if (!color && typeof status === "string") {
    const s = status.toLowerCase();
    if (s === "running") {
      dotColor = "#43a047";
      text = "Åben";
    } else if (s === "stopped" || s === "closed") {
      dotColor = "#e53935";
      text = "Lukket";
    } else if (s === "unknown") {
      dotColor = "grey.400";
      text = "Ukendt";
    } else if (s.includes("kører")) {
      dotColor = "#43a047";
      text = status;
    } else if (s.includes("lukket")) {
      dotColor = "#e53935";
      text = status;
    }
  }

  return (
    <Box sx={{ display: "inline-flex", alignItems: "center" }}>
      <Box sx={{
        width: 14,
        height: 14,
        borderRadius: "50%",
        bgcolor: dotColor,
        boxShadow: "0 0 2px rgba(0,0,0,0.12)",
        border: "1px solid #ddd",
        mr: 1,
      }} />
      <Typography variant="body2" sx={{ fontWeight: 400 }}>{text}</Typography>
    </Box>
  );
}

export default function ClientDetailsHeaderSection({
  client,
  locality,
  localityDirty,
  savingLocality,
  handleLocalityChange,
  handleLocalitySave,
  kioskUrl,
  kioskUrlDirty,
  savingKioskUrl,
  handleKioskUrlChange,
  handleKioskUrlSave,
  liveChromeStatus,
  liveChromeColor,
  refreshing,
  handleRefresh,
  snackbar,
  handleCloseSnackbar,
}) {
  const navigate = useNavigate();

  const inputStyle = {
    width: 300,
    height: 32,
    "& .MuiInputBase-input": { fontSize: "0.95rem", height: "32px", boxSizing: "border-box", padding: "8px 14px" },
    "& .MuiInputBase-root": { height: "32px" },
  };
  const kioskInputStyle = {
    width: 550,
    height: 32,
    "& .MuiInputBase-input": { fontSize: "0.95rem", height: "32px", boxSizing: "border-box", padding: "8px 14px" },
    "& .MuiInputBase-root": { height: "32px" },
  };

  // Lidt mindre padding-left på value-celler for mere kompakt udseende
  const valueCellStyle = {
    border: 0,
    pl: 0.2, // mindre padding-left end standard
    py: 0,
    verticalAlign: "middle",
    height: 40,
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", mt: 3 }}>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <MuiAlert elevation={6} variant="filled" onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </MuiAlert>
      </Snackbar>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/clients")}
          sx={{
            textTransform: "none",
            fontWeight: 500,
            minWidth: 0,
            px: 2,
          }}
        >
          Tilbage til klientoversigt
        </Button>
        <Tooltip title="Opdater klient">
          <span>
            <Button
              startIcon={refreshing ? <CircularProgress size={18} /> : <RefreshIcon fontSize="medium" />}
              disabled={refreshing}
              color="primary"
              onClick={handleRefresh}
              sx={{ fontWeight: 500, textTransform: "none", minWidth: 0, mr: 1, px: 2 }}
            >
              {refreshing ? "Opdaterer..." : "Opdater"}
            </Button>
          </span>
        </Tooltip>
      </Box>
      <Card elevation={2} sx={{ borderRadius: 2, mb: 2 }}>
        <CardContent>
          {/* TOP: Klientnavn, online/offline og drifttilstand i én række */}
          <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: 0.5,
                fontSize: { xs: "1rem", sm: "1.15rem", md: "1.25rem" },
              }}
            >
              {client.name}
            </Typography>
            <ClientStatusIcon isOnline={client.isOnline} />
            <StateBadge state={client.state} />
          </Box>
          <Box mt={2}>
            <TableContainer>
              <Table size="small" aria-label="client-details">
                <TableBody>
                  <TableRow sx={{ height: 40 }}>
                    <TableCell
                      sx={{
                        border: 0,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        pr: 0.5,
                        py: 0,
                        verticalAlign: "middle",
                        height: 40,
                      }}
                    >
                      Klient ID:
                    </TableCell>
                    <TableCell sx={valueCellStyle}>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "text.primary",
                          fontWeight: 700,
                          fontSize: "0.9rem",
                          display: "inline",
                        }}
                      >
                        {client.id}
                      </Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ height: 40 }}>
                    <TableCell sx={{ border: 0, fontWeight: 600, whiteSpace: "nowrap", pr: 0.5, py: 0, verticalAlign: "middle", height: 40 }}>
                      Lokation:
                    </TableCell>
                    <TableCell sx={valueCellStyle}>
                      <Box sx={{
                        display: "flex",
                        alignItems: "center",
                        lineHeight: "40px",
                        gap: "8px"
                      }}>
                        <TextField
                          size="small"
                          value={locality}
                          onChange={handleLocalityChange}
                          sx={inputStyle}
                          disabled={savingLocality}
                        />
                        <CopyIconButton value={locality} disabled={!locality} iconSize={15} />
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={handleLocalitySave}
                          disabled={savingLocality}
                          sx={{ minWidth: 44, maxWidth: 44 }}
                        >
                          {savingLocality ? <CircularProgress size={16} /> : "Gem"}
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                  {/* Byttet om: Kiosk browser status først, derefter Kiosk URL */}
                  <TableRow sx={{ height: 40 }}>
                    <TableCell sx={{ border: 0, fontWeight: 600, whiteSpace: "nowrap", pr: 0.5, py: 0, verticalAlign: "middle", height: 40 }}>
                      Kiosk browser status:
                    </TableCell>
                    <TableCell sx={valueCellStyle}>
                      <Box sx={{ display: "inline-flex", alignItems: "center", verticalAlign: "middle", lineHeight: "40px" }}>
                        <ChromeStatusIcon status={liveChromeStatus} color={liveChromeColor} />
                      </Box>
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ height: 40 }}>
                    <TableCell sx={{ border: 0, fontWeight: 600, whiteSpace: "nowrap", pr: 0.5, py: 0, verticalAlign: "middle", height: 40 }}>
                      Kiosk URL:
                    </TableCell>
                    <TableCell sx={valueCellStyle}>
                      <Box sx={{
                        display: "flex",
                        alignItems: "center",
                        lineHeight: "40px",
                        gap: "8px"
                      }}>
                        <TextField
                          size="small"
                          value={kioskUrl}
                          onChange={handleKioskUrlChange}
                          sx={kioskInputStyle}
                          disabled={savingKioskUrl}
                        />
                        <CopyIconButton value={kioskUrl} disabled={!kioskUrl} iconSize={15} />
                        <Button
                          size="small"
                          variant="outlined"
                          color="primary"
                          onClick={handleKioskUrlSave}
                          disabled={savingKioskUrl}
                          sx={{ minWidth: 44, maxWidth: 44 }}
                        >
                          {savingKioskUrl ? <CircularProgress size={16} /> : "Gem"}
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                  {/* --- */}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
