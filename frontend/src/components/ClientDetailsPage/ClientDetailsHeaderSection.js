import React, { useState, useEffect } from "react";
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
  useMediaQuery,
  Snackbar,
  Alert,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RefreshIcon from "@mui/icons-material/Refresh";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/authcontext";

// StatusBadge med 2s puls animation hvis animate=true
function StatusBadge({ color, text, animate = false, isMobile = false, showText = true }) {
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", ml: isMobile ? 1 : 2 }}>
      <Box sx={{
        width: isMobile ? 8 : 10,
        height: isMobile ? 8 : 10,
        borderRadius: "50%",
        bgcolor: color,
        boxShadow: "0 0 2px rgba(0,0,0,0.12)",
        border: "1px solid #ddd",
        mr: showText ? 1 : 0,
        animation: animate ? "pulsate 2s infinite" : "none"
      }} />
      {showText && (
        <Typography variant="body2" sx={{ fontWeight: 400, textTransform: "none", fontSize: isMobile ? 12 : undefined }}>
          {text}
        </Typography>
      )}
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

// Kiosk status badge med tekst og bounce for ALLE statuser
function ChromeStatusBadge({ status, color, isMobile = false }) {
  let fallbackColor = "grey.400";
  let text = status || "ukendt";
  let dotColor = color || fallbackColor;

  // Bounce for alle statuser
  const animate = true;

  return (
    <Box sx={{ display: "inline-flex", alignItems: "center" }}>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 400,
          textTransform: "none",
          fontSize: isMobile ? 12 : undefined,
          mr: 1, // Samme afstand som i referencefilen
        }}
      >
        {text}
      </Typography>
      <StatusBadge color={dotColor} animate={animate} isMobile={isMobile} showText={false} />
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

export default function ClientDetailsHeaderSection({
  client,
  locality,
  localityDirty, // still accepted from parent but component now tracks its own baseline too
  savingLocality, // accepted from parent but we also maintain internal saving while calling handlers
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
}) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { user } = useAuth(); // Hent bruger fra authcontext

  // Local editable state + baseline state so we can clear error immediately after save
  const [localLocality, setLocalLocality] = useState(locality ?? "");
  const [baselineLocality, setBaselineLocality] = useState(locality ?? "");
  const [localKioskUrl, setLocalKioskUrl] = useState(kioskUrl ?? "");
  const [baselineKioskUrl, setBaselineKioskUrl] = useState(kioskUrl ?? "");

  // Local saving flags (we also respect props saving flags if parent uses them)
  const [savingLocalityInternal, setSavingLocalityInternal] = useState(false);
  const [savingKioskUrlInternal, setSavingKioskUrlInternal] = useState(false);

  // Snackbar state
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState("success");

  // Sync incoming prop changes to local + baseline (parent may update after save)
  useEffect(() => {
    setLocalLocality(locality ?? "");
    setBaselineLocality(locality ?? "");
  }, [locality]);

  useEffect(() => {
    setLocalKioskUrl(kioskUrl ?? "");
    setBaselineKioskUrl(kioskUrl ?? "");
  }, [kioskUrl]);

  // Determine dirty based on baseline -> error handling via MUI error prop
  const localityIsDirty = localLocality !== baselineLocality;
  const kioskUrlIsDirty = localKioskUrl !== baselineKioskUrl;

  // Merge saving flag: show spinner if either parent or local is saving
  const localitySaving = savingLocalityInternal || !!savingLocality;
  const kioskSaving = savingKioskUrlInternal || !!savingKioskUrl;

  // input styles
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

  // Helper show snackbar
  const showSnackbar = (message, severity = "success") => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  // Wrapper save handlers that update baseline on success and show snackbar on success/error
  const onSaveLocality = async () => {
    if (!localityIsDirty || localitySaving) return;
    setSavingLocalityInternal(true);
    try {
      // Call parent handler; allow it to return saved value
      const result = await handleLocalitySave(localLocality);
      const saved = result !== undefined ? result : localLocality;
      setBaselineLocality(saved);
      setLocalLocality(saved);
      // Also call parent's change handler if provided so parent UI can sync
      if (typeof handleLocalityChange === "function") {
        try { handleLocalityChange({ target: { value: saved } }); } catch (e) { /* ignore */ }
      }
      showSnackbar("Lokation gemt", "success");
    } catch (err) {
      console.error("Fejl ved gem af Lokation:", err);
      // Try to extract useful server message if available
      const serverMsg = err?.response?.data?.message || err?.message || "Kunne ikke gemme lokation";
      showSnackbar(serverMsg, "error");
    } finally {
      setSavingLocalityInternal(false);
    }
  };

  const onSaveKioskUrl = async () => {
    if (!kioskUrlIsDirty || kioskSaving) return;
    setSavingKioskUrlInternal(true);
    try {
      const result = await handleKioskUrlSave(localKioskUrl);
      const saved = result !== undefined ? result : localKioskUrl;
      setBaselineKioskUrl(saved);
      setLocalKioskUrl(saved);
      if (typeof handleKioskUrlChange === "function") {
        try { handleKioskUrlChange({ target: { value: saved } }); } catch (e) { /* ignore */ }
      }
      showSnackbar("Kiosk URL gemt", "success");
    } catch (err) {
      console.error("Fejl ved gem af Kiosk URL:", err);
      const serverMsg = err?.response?.data?.message || err?.message || "Kunne ikke gemme Kiosk URL";
      showSnackbar(serverMsg, "error");
    } finally {
      setSavingKioskUrlInternal(false);
    }
  };

  // Handlers for onChange: update local state and also call parent's change handler if present
  const onLocalityChange = (e) => {
    const v = e?.target?.value ?? "";
    setLocalLocality(v);
    if (typeof handleLocalityChange === "function") {
      // preserve the original API: if parent expects event, forward it
      try { handleLocalityChange(e); } catch (err) { /* ignore parent errors */ }
    }
  };

  const onKioskUrlChange = (e) => {
    const v = e?.target?.value ?? "";
    setLocalKioskUrl(v);
    if (typeof handleKioskUrlChange === "function") {
      try { handleKioskUrlChange(e); } catch (err) { /* ignore parent errors */ }
    }
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
                fontSize: isMobile ? "1rem" : { xs: "1rem", sm: "1rem", md: "1.25rem" },
              }}
            >
              {client.name}
            </Typography>
          </Box>
          <Box mt={isMobile ? 1 : 2}>
            <TableContainer>
              <Table size="small" aria-label="client-details">
                <TableBody>
                  {/* Kun vis Klient ID hvis bruger er admin */}
                  {user?.role === "admin" && (
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
                  )}
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
                          value={localLocality}
                          onChange={onLocalityChange}
                          sx={inputStyle}
                          disabled={localitySaving}
                          error={localityIsDirty} // MUI-standard rød ramme når dirty (indtil gem)
                          inputProps={{ style: { fontSize: isMobile ? 13 : undefined } }}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              onSaveLocality();
                            }
                          }}
                        />
                        <CopyIconButton value={localLocality} disabled={!localLocality} iconSize={isMobile ? 13 : 15} isMobile={isMobile} />
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={onSaveLocality}
                          disabled={!localityIsDirty || localitySaving}
                          sx={{ minWidth: isMobile ? 34 : 44, maxWidth: isMobile ? 34 : 44, fontSize: isMobile ? "0.81rem" : undefined, height: isMobile ? 28 : 32 }}
                        >
                          {localitySaving ? <CircularProgress size={isMobile ? 13 : 16} /> : "Gem"}
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                  {/* Kiosk URL først */}
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
                          value={localKioskUrl}
                          onChange={onKioskUrlChange}
                          sx={kioskInputStyle}
                          disabled={kioskSaving}
                          error={kioskUrlIsDirty}
                          inputProps={{ style: { fontSize: isMobile ? 13 : undefined } }}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              onSaveKioskUrl();
                            }
                          }}
                        />
                        <CopyIconButton value={localKioskUrl} disabled={!localKioskUrl} iconSize={isMobile ? 13 : 15} isMobile={isMobile} />
                        <Button
                          size="small"
                          variant="outlined"
                          color="primary"
                          onClick={onSaveKioskUrl}
                          disabled={!kioskUrlIsDirty || kioskSaving}
                          sx={{ minWidth: isMobile ? 34 : 44, maxWidth: isMobile ? 34 : 44, fontSize: isMobile ? "0.81rem" : undefined, height: isMobile ? 28 : 32 }}
                        >
                          {kioskSaving ? <CircularProgress size={isMobile ? 13 : 16} /> : "Gem"}
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                  {/* Kiosk browser status: teksten først, derefter badge med bounce animation */}
                  <TableRow sx={{ height: isMobile ? 32 : 40 }}>
                    <TableCell sx={{ border: 0, fontWeight: 600, whiteSpace: "nowrap", pr: 0.5, py: 0, verticalAlign: "middle", height: isMobile ? 32 : 40, fontSize: isMobile ? 13 : 14 }}>
                      Kiosk browser status:
                    </TableCell>
                    <TableCell sx={valueCellStyle}>
                      <ChromeStatusBadge status={liveChromeStatus} color={liveChromeColor} isMobile={isMobile} />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </CardContent>
      </Card>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3500}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: "100%" }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
