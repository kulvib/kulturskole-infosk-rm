import React from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  TextField,
  useMediaQuery
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RefreshIcon from "@mui/icons-material/Refresh";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";

// StatusBadge med 2s puls animation hvis animate=true
function StatusBadge({ color, text, animate = false, isMobile = false }) {
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", ml: isMobile ? 1 : 2 }}>
      <Box sx={{
        width: isMobile ? 8 : 10,
        height: isMobile ? 8 : 10,
        borderRadius: "50%",
        bgcolor: color,
        boxShadow: "0 0 2px rgba(0,0,0,0.12)",
        border: "1px solid #ddd",
        mr: 1,
        animation: animate ? "pulsate 2s infinite" : "none"
      }} />
      <Typography variant="body2" sx={{ fontWeight: 400, textTransform: "none", fontSize: isMobile ? 12 : undefined }}>
        {text}
      </Typography>
      {animate && (
        <style>
          {`
            @keyframes pulsate {
              0% {
                transform: scale(1);
                opacity: 1;
              }
              50% {
                transform: scale(1.25);
                opacity: 0.5;
              }
              100% {
                transform: scale(1);
                opacity: 1;
              }
            }
          `}
        </style>
      )}
    </Box>
  );
}

function CopyIconButton({ value, disabled, iconSize = 16, isMobile = false }) {
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
            minWidth: isMobile ? 20 : 24,
            maxWidth: isMobile ? 20 : 24,
            minHeight: isMobile ? 20 : 24,
            maxHeight: isMobile ? 20 : 24,
            padding: 0,
            margin: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            verticalAlign: "middle",
          }}
          disabled={disabled}
        >
          <ContentCopyIcon style={{ fontSize: isMobile ? 13 : iconSize }} color={copied ? "success" : "inherit"} />
        </Button>
      </span>
    </Tooltip>
  );
}

// ChromeStatusIcon med badge og 2s puls (animeret hvis browser kører)
function ChromeStatusIcon({ status, color, isMobile = false }) {
  let fallbackColor = "grey.400";
  let text = status || "Ukendt";
  let dotColor = color || fallbackColor;
  let animate = false;

  if (!color && typeof status === "string") {
    const s = status.toLowerCase();
    if (s === "running") {
      dotColor = "#43a047";
      text = "Åben";
      animate = true;
    } else if (s === "stopped" || s === "closed") {
      dotColor = "#e53935";
      text = "Lukket";
      animate = false;
    } else if (s === "unknown") {
      dotColor = "grey.400";
      text = "Ukendt";
      animate = false;
    } else if (s.includes("kører")) {
      dotColor = "#43a047";
      text = status;
      animate = true;
    } else if (s.includes("lukket")) {
      dotColor = "#e53935";
      text = status;
      animate = false;
    }
  }

  return <StatusBadge color={dotColor} text={text} animate={animate} isMobile={isMobile} />;
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
  handleRefresh
  // snackbar og handleCloseSnackbar ER FJERNET
}) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const inputStyle = {
    width: isMobile ? "100%" : 300,
    height: 32,
    "& .MuiInputBase-input": {
      fontSize: isMobile ? "0.90rem" : "0.95rem",
      height: isMobile ? "30px" : "32px",
      boxSizing: "border-box",
      padding: isMobile ? "6px 10px" : "8px 14px"
    },
    "& .MuiInputBase-root": { height: isMobile ? "30px" : "32px" },
  };
  const kioskInputStyle = {
    width: isMobile ? "100%" : 550,
    height: 32,
    "& .MuiInputBase-input": {
      fontSize: isMobile ? "0.90rem" : "0.95rem",
      height: isMobile ? "30px" : "32px",
      boxSizing: "border-box",
      padding: isMobile ? "6px 10px" : "8px 14px"
    },
    "& .MuiInputBase-root": { height: isMobile ? "30px" : "32px" },
  };

  const valueCellStyle = {
    border: 0,
    pl: 0,
    py: 0,
    verticalAlign: "middle",
    height: isMobile ? 32 : 40,
    fontSize: isMobile ? 13 : 14,
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", mt: isMobile ? 1 : 3 }}>
      <Box sx={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", mb: 1, gap: isMobile ? 1 : 0 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon sx={{ fontSize: isMobile ? 19 : undefined }} />}
          onClick={() => navigate("/clients")}
          sx={{
            textTransform: "none",
            fontWeight: 500,
            minWidth: 0,
            px: isMobile ? 1.2 : 2,
            fontSize: isMobile ? "0.93rem" : undefined,
            mb: isMobile ? 0.5 : 0,
          }}
        >
          Tilbage til klientoversigt
        </Button>
        <Tooltip title="Opdater klient">
          <span>
            <Button
              startIcon={refreshing ? <CircularProgress size={isMobile ? 15 : 18} /> : <RefreshIcon fontSize={isMobile ? "small" : "medium"} />}
              disabled={refreshing}
              color="primary"
              onClick={handleRefresh}
              sx={{
                fontWeight: 500,
                textTransform: "none",
                minWidth: 0,
                mr: isMobile ? 0 : 1,
                px: isMobile ? 1.2 : 2,
                fontSize: isMobile ? "0.93rem" : undefined
              }}
            >
              {refreshing ? "Opdaterer..." : "Opdater"}
            </Button>
          </span>
        </Tooltip>
      </Box>
      <Card elevation={2} sx={{ borderRadius: isMobile ? 1.5 : 2, mb: 2 }}>
        <CardContent sx={{ px: isMobile ? 1 : undefined, py: isMobile ? 1.5 : undefined }}>
          <Box sx={{ display: "flex", alignItems: "center", mb: isMobile ? 0.5 : 1 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: 0.5,
                fontSize: isMobile ? "1rem" : { xs: "1rem", sm: "1.15rem", md: "1.25rem" },
              }}
            >
              {client.name}
            </Typography>
          </Box>
          <Box mt={isMobile ? 1 : 2}>
            <TableContainer>
              <Table size="small" aria-label="client-details">
                <TableBody>
                  <TableRow sx={{ height: isMobile ? 32 : 40 }}>
                    <TableCell
                      sx={{
                        border: 0,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        pr: 0.5,
                        py: 0,
                        verticalAlign: "middle",
                        height: isMobile ? 32 : 40,
                        fontSize: isMobile ? 13 : 14,
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
                          fontSize: isMobile ? "0.86rem" : "0.9rem",
                          display: "inline",
                        }}
                      >
                        {client.id}
                      </Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ height: isMobile ? 32 : 40 }}>
                    <TableCell sx={{ border: 0, fontWeight: 600, whiteSpace: "nowrap", pr: 0.5, py: 0, verticalAlign: "middle", height: isMobile ? 32 : 40, fontSize: isMobile ? 13 : 14 }}>
                      Lokation:
                    </TableCell>
                    <TableCell sx={valueCellStyle}>
                      <Box sx={{
                        display: "flex",
                        alignItems: "center",
                        lineHeight: isMobile ? "32px" : "40px",
                        gap: isMobile ? "4px" : "8px"
                      }}>
                        <TextField
                          size="small"
                          value={locality}
                          onChange={handleLocalityChange}
                          sx={inputStyle}
                          disabled={savingLocality}
                          inputProps={{ style: { fontSize: isMobile ? 13 : undefined } }}
                        />
                        <CopyIconButton value={locality} disabled={!locality} iconSize={isMobile ? 13 : 15} isMobile={isMobile} />
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={handleLocalitySave}
                          disabled={savingLocality}
                          sx={{ minWidth: isMobile ? 34 : 44, maxWidth: isMobile ? 34 : 44, fontSize: isMobile ? "0.81rem" : undefined, height: isMobile ? 28 : 32 }}
                        >
                          {savingLocality ? <CircularProgress size={isMobile ? 13 : 16} /> : "Gem"}
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ height: isMobile ? 32 : 40 }}>
                    <TableCell sx={{ border: 0, fontWeight: 600, whiteSpace: "nowrap", pr: 0.5, py: 0, verticalAlign: "middle", height: isMobile ? 32 : 40, fontSize: isMobile ? 13 : 14 }}>
                      Kiosk browser status:
                    </TableCell>
                    <TableCell sx={valueCellStyle}>
                      <Box sx={{ display: "inline-flex", alignItems: "center", verticalAlign: "middle", lineHeight: isMobile ? "32px" : "40px" }}>
                        <ChromeStatusIcon status={liveChromeStatus} color={liveChromeColor} isMobile={isMobile} />
                      </Box>
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ height: isMobile ? 32 : 40 }}>
                    <TableCell sx={{ border: 0, fontWeight: 600, whiteSpace: "nowrap", pr: 0.5, py: 0, verticalAlign: "middle", height: isMobile ? 32 : 40, fontSize: isMobile ? 13 : 14 }}>
                      Kiosk URL:
                    </TableCell>
                    <TableCell sx={valueCellStyle}>
                      <Box sx={{
                        display: "flex",
                        alignItems: "center",
                        lineHeight: isMobile ? "32px" : "40px",
                        gap: isMobile ? "4px" : "8px"
                      }}>
                        <TextField
                          size="small"
                          value={kioskUrl}
                          onChange={handleKioskUrlChange}
                          sx={kioskInputStyle}
                          disabled={savingKioskUrl}
                          inputProps={{ style: { fontSize: isMobile ? 13 : undefined } }}
                        />
                        <CopyIconButton value={kioskUrl} disabled={!kioskUrl} iconSize={isMobile ? 13 : 15} isMobile={isMobile} />
                        <Button
                          size="small"
                          variant="outlined"
                          color="primary"
                          onClick={handleKioskUrlSave}
                          disabled={savingKioskUrl}
                          sx={{ minWidth: isMobile ? 34 : 44, maxWidth: isMobile ? 34 : 44, fontSize: isMobile ? "0.81rem" : undefined, height: isMobile ? 28 : 32 }}
                        >
                          {savingKioskUrl ? <CircularProgress size={isMobile ? 13 : 16} /> : "Gem"}
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
