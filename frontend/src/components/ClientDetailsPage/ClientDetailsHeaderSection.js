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
  Select,
  MenuItem,
  useMediaQuery,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RefreshIcon from "@mui/icons-material/Refresh";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/authcontext";

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
      <Typography variant="body2" sx={{ fontWeight: 400, textTransform: "none", fontSize: isMobile ? 12 : 14 }}>
        {text}
      </Typography>
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

function StateBadge({ state, isMobile = false }) {
  let color = "grey.400";
  let text = state || "ukendt";
  let animate = false;
  if (state) {
    switch (state.toLowerCase()) {
      case "normal":
        color = "#43a047";
        animate = true;
        break;
      case "sleep":
        color = "#1976d2";
        animate = true;
        break;
      case "maintenance":
        color = "#ffa000";
        animate = true;
        break;
      case "error":
        color = "#e53935";
        animate = true;
        break;
      case "offline":
        color = "#757575";
        animate = false;
        break;
      default:
        color = "grey.400";
        animate = false;
    }
  }
  return <StatusBadge color={color} text={text.toLowerCase()} animate={animate} isMobile={isMobile} />;
}

function OnlineStatusBadge({ isOnline, isMobile = false }) {
  const color = isOnline ? "#43a047" : "#e53935";
  const text = isOnline ? "online" : "offline";
  return <StatusBadge color={color} text={text} animate={true} isMobile={isMobile} />;
}

function ChromeStatusBadge({ status, color, isMobile = false }) {
  let fallbackColor = "grey.400";
  let text = status || "ukendt";
  let dotColor = color || fallbackColor;
  const animate = true;
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center" }}>
      <StatusBadge color={dotColor} text={text} animate={animate} isMobile={isMobile} />
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
            minHeight: 32,
            maxHeight: 32,
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
  schools = [],
  schoolSelection,
  handleSchoolChange,
  schoolDirty,
  savingSchool,
  handleSchoolSave,
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
  kioskBrowserData = {},
}) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { user } = useAuth();

  const labelStyle = {
    fontWeight: 600,
    whiteSpace: "nowrap",
    minWidth: 120,
    pr: isMobile ? 0.25 : 0.5,
    py: 0,
    verticalAlign: "middle",
    fontSize: isMobile ? 12 : 14,
  };
  const inputLikeStyle = {
    fontWeight: 400,
    pl: isMobile ? 1 : 2,
    py: 0,
    verticalAlign: "middle",
    fontSize: isMobile ? 12 : 14,
    minWidth: 120,
    height: 32,
    display: "flex",
    alignItems: "center"
  };

  const inputStyle = {
    width: "100%",
    height: 32,
    "& .MuiInputBase-input": {
      fontSize: isMobile ? 12 : 14,
      height: "32px",
      boxSizing: "border-box",
      padding: isMobile ? "6px 10px" : "8px 14px"
    },
    "& .MuiInputBase-root": { height: "32px" },
  };

  function renderKioskBrowserData(data) {
    if (!data || typeof data !== "object") return null;
    return Object.entries(data).map(([key, value]) => (
      <Box key={key} sx={{ display: "flex", alignItems: "center", mb: isMobile ? 0.5 : 1 }}>
        <Typography sx={labelStyle}>{key}:</Typography>
        <Typography sx={inputLikeStyle}>{String(value)}</Typography>
      </Box>
    ));
  }

  return (
    <Box sx={{ width: "100%" }}>
      {/* Topbar */}
      <Box sx={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", mb: isMobile ? 0.5 : 1, gap: isMobile ? 1 : 0 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon sx={{ fontSize: isMobile ? 19 : 20 }} />}
          onClick={() => navigate("/clients")}
          sx={{
            textTransform: "none",
            fontWeight: 500,
            minWidth: 0,
            px: isMobile ? 1.2 : 2,
            fontSize: isMobile ? "0.93rem" : 14,
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
                fontSize: isMobile ? "0.93rem" : 14
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
          <Card elevation={2} sx={{ borderRadius: isMobile ? 1 : 2, height: "100%" }}>
            <CardContent sx={{ px: isMobile ? 1 : 2, py: isMobile ? 1 : 2 }}>
              {/* Klient info overskrift + Netværksinfo badge aligned med værdier */}
              <Box sx={{ display: "flex", alignItems: "center", mb: isMobile ? 0.5 : 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: isMobile ? 16 : 18 }}>
                  Klient info
                </Typography>
                <Box sx={{ pl: isMobile ? 1 : 2 }}>
                  <OnlineStatusBadge isOnline={client.isOnline} isMobile={isMobile} />
                </Box>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", mb: isMobile ? 0.5 : 1 }}>
                <Typography sx={labelStyle}>Klientnavn:</Typography>
                <Typography sx={inputLikeStyle}>{client.name}</Typography>
              </Box>
              {user?.role === "admin" && (
                <Box sx={{ display: "flex", alignItems: "center", mb: isMobile ? 0.5 : 1 }}>
                  <Typography sx={labelStyle}>Klient ID:</Typography>
                  <Typography sx={inputLikeStyle}>{client.id}</Typography>
                </Box>
              )}
              <Box sx={{ display: "flex", alignItems: "center", mb: isMobile ? 0.5 : 1 }}>
                <Typography sx={labelStyle}>Skole:</Typography>
                <Box sx={inputLikeStyle}>
                  <Select
                    size="small"
                    value={schoolSelection ?? client.school_id ?? ""}
                    displayEmpty
                    onChange={e => handleSchoolChange(e.target.value)}
                    sx={{
                      minWidth: 120,
                      fontSize: isMobile ? 12 : 14,
                      height: "32px",
                      "& .MuiSelect-select": { height: "32px", display: "flex", alignItems: "center" }
                    }}
                  >
                    <MenuItem value="">Vælg skole</MenuItem>
                    {schools.map(school => (
                      <MenuItem key={school.id} value={school.id}>{school.name}</MenuItem>
                    ))}
                  </Select>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleSchoolSave}
                    disabled={savingSchool || !schoolDirty}
                    sx={{ minWidth: 56, ml: 1, height: "32px" }}
                  >
                    {savingSchool ? <CircularProgress size={isMobile ? 13 : 16} /> : "Gem"}
                  </Button>
                </Box>
              </Box>
              {/* Lokation er nu flyttet til Paper 2 */}
            </CardContent>
          </Card>
        </Box>
        {/* Paper 2 */}
        <Box sx={{ width: isMobile ? "100%" : "50%", pl: isMobile ? 0 : 1 }}>
          <Card elevation={2} sx={{ borderRadius: isMobile ? 1 : 2, height: "100%" }}>
            <CardContent sx={{ px: isMobile ? 1 : 2, py: isMobile ? 1 : 2 }}>
              {/* Kiosk info overskrift + Systeminfo badge */}
              <Box sx={{ display: "flex", alignItems: "center", mb: isMobile ? 0.5 : 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: isMobile ? 16 : 18 }}>
                  Kiosk info
                </Typography>
                <Box sx={{ ml: 2 }}>
                  <StateBadge state={client.state} isMobile={isMobile} />
                </Box>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", mb: isMobile ? 0.5 : 1 }}>
                <Typography sx={labelStyle}>Kiosk URL:</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", mb: isMobile ? 0.5 : 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", flex: 1, gap: 1, ...inputLikeStyle }}>
                  <TextField
                    size="small"
                    value={kioskUrl}
                    onChange={handleKioskUrlChange}
                    sx={{
                      ...inputStyle,
                      height: "32px",
                      "& .MuiInputBase-root": { height: "32px" }
                    }}
                    disabled={savingKioskUrl}
                    inputProps={{ style: { fontSize: isMobile ? 12 : 14 } }}
                    onKeyDown={e => { if (e.key === "Enter") handleKioskUrlSave(); }}
                    error={!!kioskUrlDirty}
                  />
                  <CopyIconButton value={kioskUrl} disabled={!kioskUrl} iconSize={isMobile ? 13 : 15} isMobile={isMobile} />
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleKioskUrlSave}
                    disabled={savingKioskUrl}
                    sx={{ minWidth: 56, height: "32px" }}
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
              <Box sx={{ display: "flex", alignItems: "center", mb: isMobile ? 0.5 : 1 }}>
                <Typography sx={labelStyle}>Kiosk browser status:</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", mb: isMobile ? 0.5 : 1 }}>
                <ChromeStatusBadge status={liveChromeStatus} color={liveChromeColor} isMobile={isMobile} />
              </Box>
              {/* Lokation felt placeret her */}
              <Box sx={{ display: "flex", alignItems: "center", mb: isMobile ? 0.5 : 1 }}>
                <Typography sx={labelStyle}>Lokation:</Typography>
                <Box sx={{ display: "flex", alignItems: "center", flex: 1, ml: 1, gap: 1, ...inputLikeStyle }}>
                  <TextField
                    size="small"
                    value={locality}
                    onChange={handleLocalityChange}
                    sx={{
                      ...inputStyle,
                      height: "32px",
                      "& .MuiInputBase-root": { height: "32px" }
                    }}
                    disabled={savingLocality}
                    inputProps={{ style: { fontSize: isMobile ? 12 : 14 } }}
                    onKeyDown={e => { if (e.key === "Enter") handleLocalitySave(); }}
                    error={!!localityDirty}
                  />
                  <CopyIconButton value={locality} disabled={!locality} iconSize={isMobile ? 13 : 15} isMobile={isMobile} />
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleLocalitySave}
                    disabled={savingLocality}
                    sx={{ minWidth: 56, height: "32px" }}
                  >
                    {savingLocality ? <CircularProgress size={isMobile ? 13 : 16} /> : "Gem"}
                  </Button>
                </Box>
              </Box>
              {(localityDirty || schoolDirty) && (
                <Typography variant="caption" color="warning.main" sx={{ pl: 1, mt: 0.5 }}>
                  Husk at gemme din ændring!
                </Typography>
              )}
              <Box sx={{ mt: 1 }}>
                {renderKioskBrowserData(kioskBrowserData)}
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}
