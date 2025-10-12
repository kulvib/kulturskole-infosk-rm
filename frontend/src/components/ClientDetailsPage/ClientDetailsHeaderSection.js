import React from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Tooltip,
  TextField,
  useMediaQuery,
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
              0% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.25); opacity: 0.5; }
              100% { transform: scale(1); opacity: 1; }
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
  const animate = true;
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center" }}>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 400,
          textTransform: "none",
          fontSize: isMobile ? 12 : undefined,
          mr: 1,
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
          sx={{
            minWidth: isMobile ? 20 : 24,
            maxWidth: isMobile ? 20 : 24,
            minHeight: isMobile ? 20 : 24,
            maxHeight: isMobile ? 20 : 24,
            p: 0,
            m: 0,
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
  kioskBrowserData = {}, // ekstra data til browseren, hvis du har det
}) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { user } = useAuth();

  const inputStyle = {
    width: "100%",
    height: 32,
    "& .MuiInputBase-input": {
      fontSize: isMobile ? "0.90rem" : "0.95rem",
      height: isMobile ? "30px" : "32px",
      boxSizing: "border-box",
      padding: isMobile ? "6px 10px" : "8px 14px"
    },
    "& .MuiInputBase-root": { height: isMobile ? "30px" : "32px" },
  };

  function renderKioskBrowserData(data) {
    if (!data || typeof data !== "object") return null;
    return Object.entries(data).map(([key, value]) => (
      <Box key={key} sx={{ display: "flex", gap: 1, mb: 0.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 90, fontWeight: 400 }}>
          {key}:
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>{String(value)}</Typography>
      </Box>
    ));
  }

  return (
    <Box sx={{ width: "100%" }}>
      {/* Topbar */}
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
      {/* Papers */}
      <Box sx={{ display: "flex", flexDirection: isMobile ? "column" : "row", width: "100%" }}>
        {/* Paper 1 */}
        <Box sx={{ width: isMobile ? "100%" : "50%", pr: isMobile ? 0 : 1 }}>
          <Card elevation={3} sx={{ borderRadius: 2, height: "100%" }}>
            <CardContent>
              {/* Klientnavn */}
              <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                <Typography variant="body2" fontWeight={600} sx={{ minWidth: 120 }}>
                  Klientnavn:
                </Typography>
                <Typography variant="body2" sx={{ ml: 1 }}>
                  {client.name}
                </Typography>
              </Box>
              {/* Klient ID */}
              <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                <Typography variant="body2" fontWeight={600} sx={{ minWidth: 120 }}>
                  Klient ID:
                </Typography>
                <Typography variant="body2" sx={{ ml: 1 }}>
                  {client.id}
                </Typography>
              </Box>
              {/* Skole */}
              <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                <Typography variant="body2" fontWeight={600} sx={{ minWidth: 120 }}>
                  Skole:
                </Typography>
                <Typography variant="body2" sx={{ ml: 1 }}>
                  {client.school}
                </Typography>
              </Box>
              {/* Lokation indtastningsfelt, kopiikon, gem knap */}
              <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                <Typography variant="body2" fontWeight={600} sx={{ minWidth: 120 }}>
                  Lokation:
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", flex: 1, ml: 1, gap: 1 }}>
                  <TextField
                    size="small"
                    value={locality}
                    onChange={handleLocalityChange}
                    sx={inputStyle}
                    disabled={savingLocality}
                    inputProps={{ style: { fontSize: isMobile ? 13 : undefined } }}
                    onKeyDown={e => { if (e.key === "Enter") handleLocalitySave(); }}
                    error={!!localityDirty}
                  />
                  <CopyIconButton value={locality} disabled={!locality} iconSize={isMobile ? 13 : 15} isMobile={isMobile} />
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleLocalitySave}
                    disabled={savingLocality}
                    sx={{ minWidth: 56 }}
                  >
                    {savingLocality ? <CircularProgress size={isMobile ? 13 : 16} /> : "Gem"}
                  </Button>
                </Box>
              </Box>
              {localityDirty && (
                <Typography variant="caption" color="warning.main" sx={{ pl: 1, mt: 0.5 }}>
                  Husk at gemme din ændring!
                </Typography>
              )}
            </CardContent>
          </Card>
        </Box>
        {/* Paper 2 */}
        <Box sx={{ width: isMobile ? "100%" : "50%", pl: isMobile ? 0 : 1 }}>
          <Card elevation={3} sx={{ borderRadius: 2, height: "100%" }}>
            <CardContent>
              {/* Kiosk URL label */}
              <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                <Typography variant="body2" fontWeight={600} sx={{ minWidth: 120 }}>
                  Kiosk URL:
                </Typography>
              </Box>
              {/* Kiosk URL indtastningsfelt, kopiikon, gem-knap */}
              <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", flex: 1, gap: 1 }}>
                  <TextField
                    size="small"
                    value={kioskUrl}
                    onChange={handleKioskUrlChange}
                    sx={inputStyle}
                    disabled={savingKioskUrl}
                    inputProps={{ style: { fontSize: isMobile ? 13 : undefined } }}
                    onKeyDown={e => { if (e.key === "Enter") handleKioskUrlSave(); }}
                    error={!!kioskUrlDirty}
                  />
                  <CopyIconButton value={kioskUrl} disabled={!kioskUrl} iconSize={isMobile ? 13 : 15} isMobile={isMobile} />
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleKioskUrlSave}
                    disabled={savingKioskUrl}
                    sx={{ minWidth: 56 }}
                  >
                    {savingKioskUrl ? <CircularProgress size={isMobile ? 13 : 16} /> : "Gem"}
                  </Button>
                </Box>
              </Box>
              {kioskUrlDirty && (
                <Typography variant="caption" color="warning.main" sx={{ pl: 1, mt: 0.5 }}>
                  Husk at gemme din ændring!
                </Typography>
              )}
              {/* Kiosk browser status label */}
              <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                <Typography variant="body2" fontWeight={600} sx={{ minWidth: 120 }}>
                  Kiosk browser status:
                </Typography>
              </Box>
              {/* Selve browser status (badge/tekst) */}
              <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                <ChromeStatusBadge status={liveChromeStatus} color={liveChromeColor} isMobile={isMobile} />
              </Box>
              {/* Ekstra browser data, hvis du har det */}
              <Box sx={{ mt: 2 }}>
                {renderKioskBrowserData(kioskBrowserData)}
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}
