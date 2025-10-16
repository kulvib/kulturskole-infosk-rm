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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  useMediaQuery
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RefreshIcon from "@mui/icons-material/Refresh";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/authcontext";

// Simpel copy-knap
function CopyIconButton({ value, disabled }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (err) {}
  };
  return (
    <Tooltip title={copied ? "Kopieret!" : "Kopiér"}>
      <span>
        <Button size="small" onClick={handleCopy} disabled={disabled} sx={{ minWidth: 24, p: 0 }}>
          <ContentCopyIcon fontSize="small" color={copied ? "success" : "inherit"} />
        </Button>
      </span>
    </Tooltip>
  );
}

// StatusBadge (bruges kun til online-status og state)
function StatusBadge({ color, text, animate = false, isMobile = false }) {
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", ml: 2 }}>
      <Box
        sx={{
          width: isMobile ? 8 : 10,
          height: isMobile ? 8 : 10,
          borderRadius: "50%",
          bgcolor: color,
          border: "1px solid #ddd",
          mr: 1,
          animation: animate ? "pulsate 2s infinite" : "none"
        }}
      />
      <Typography variant="body2" sx={{ fontWeight: 400, fontSize: isMobile ? 12 : 14 }}>
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
  let color = "#757575", animate = false;
  if (state) {
    switch (state.toLowerCase()) {
      case "normal": color = "#43a047"; animate = true; break;
      case "sleep": color = "#1976d2"; animate = true; break;
      case "maintenance": color = "#ffa000"; animate = true; break;
      case "error": color = "#e53935"; animate = true; break;
      case "offline": color = "#757575"; animate = false; break;
      default: color = "#757575"; animate = false;
    }
  }
  return <StatusBadge color={color} text={state || "ukendt"} animate={animate} isMobile={isMobile} />;
}
function OnlineStatusBadge({ isOnline, isMobile = false }) {
  const color = isOnline ? "#43a047" : "#e53935";
  const text = isOnline ? "online" : "offline";
  return <StatusBadge color={color} text={text} animate={true} isMobile={isMobile} />;
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
}) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { user } = useAuth();

  return (
    <Box sx={{ width: "100%" }}>
      {/* Topbar */}
      <Box sx={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        justifyContent: "space-between",
        alignItems: isMobile ? "stretch" : "center",
        mb: 1
      }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon fontSize="small" />}
          onClick={() => navigate("/clients")}
          sx={{ textTransform: "none", fontWeight: 500, px: 2 }}
        >
          Tilbage til klientoversigt
        </Button>
        <Tooltip title="Opdater klient">
          <span>
            <Button
              startIcon={refreshing ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
              disabled={refreshing}
              color="primary"
              onClick={handleRefresh}
              sx={{ fontWeight: 500, textTransform: "none", px: 2 }}
            >
              {refreshing ? "Opdaterer..." : "Opdater"}
            </Button>
          </span>
        </Tooltip>
      </Box>
      <Card elevation={2} sx={{ borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            Kiosk browser info
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>Klientnavn:</TableCell>
                  <TableCell>{client.name}</TableCell>
                </TableRow>
                {user?.role === "admin" && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>Klient ID:</TableCell>
                    <TableCell>{client.id}</TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>Lokation:</TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <TextField
                        size="small"
                        value={locality}
                        onChange={handleLocalityChange}
                        disabled={savingLocality}
                        onKeyDown={e => { if (e.key === "Enter") { handleLocalitySave(); } }}
                        sx={{ minWidth: 120 }}
                      />
                      <CopyIconButton value={locality} disabled={!locality} />
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={handleLocalitySave}
                        disabled={savingLocality}
                      >
                        {savingLocality ? <CircularProgress size={15} /> : "Gem"}
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>Kiosk URL:</TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <TextField
                        size="small"
                        value={kioskUrl}
                        onChange={handleKioskUrlChange}
                        disabled={savingKioskUrl}
                        onKeyDown={e => { if (e.key === "Enter") { handleKioskUrlSave(); } }}
                        sx={{ minWidth: 120 }}
                      />
                      <CopyIconButton value={kioskUrl} disabled={!kioskUrl} />
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={handleKioskUrlSave}
                        disabled={savingKioskUrl}
                      >
                        {savingKioskUrl ? <CircularProgress size={15} /> : "Gem"}
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>Kiosk browser status:</TableCell>
                  <TableCell>{liveChromeStatus}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
