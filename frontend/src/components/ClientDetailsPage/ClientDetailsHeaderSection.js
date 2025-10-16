import React, { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  TextField,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  useMediaQuery
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/authcontext";

// StatusBadge
function StatusBadge({ color, text, animate = false, isMobile = false }) {
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", ml: 0.5 }}>
      <Box
        sx={{
          width: isMobile ? 8 : 10,
          height: isMobile ? 8 : 10,
          borderRadius: "50%",
          bgcolor: color,
          border: "1px solid #ddd",
          mr: 0.5,
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
  let color = "grey.400";
  let text = state || "ukendt";
  let animate = false;
  if (state) {
    switch (state.toLowerCase()) {
      case "normal": color = "#43a047"; animate = true; break;
      case "sleep": color = "#1976d2"; animate = true; break;
      case "maintenance": color = "#ffa000"; animate = true; break;
      case "error": color = "#e53935"; animate = true; break;
      case "offline": color = "#757575"; animate = false; break;
      default: color = "grey.400"; animate = false;
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

export default function ClientDetailsHeaderSection({
  client,
  schools = [],
  schoolSelection,
  handleSchoolSave,
  locality,
  handleLocalitySave,
  kioskUrl,
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

  // Local state for inputs and saving
  const [localLocality, setLocalLocality] = useState(locality ?? "");
  const [localKioskUrl, setLocalKioskUrl] = useState(kioskUrl ?? "");
  const [localSchoolSelection, setLocalSchoolSelection] = useState(schoolSelection ?? client.school_id ?? "");
  const [savingLocality, setSavingLocality] = useState(false);
  const [savingKioskUrl, setSavingKioskUrl] = useState(false);
  const [savingSchool, setSavingSchool] = useState(false);

  // Sync props to local state if changed externally
  useEffect(() => { setLocalLocality(locality ?? ""); }, [locality]);
  useEffect(() => { setLocalKioskUrl(kioskUrl ?? ""); }, [kioskUrl]);
  useEffect(() => { setLocalSchoolSelection(schoolSelection ?? client.school_id ?? ""); }, [schoolSelection, client.school_id]);

  // Dirty states
  const localityDirty = localLocality !== (locality ?? "");
  const kioskUrlDirty = localKioskUrl !== (kioskUrl ?? "");
  const schoolDirty = localSchoolSelection !== (schoolSelection ?? client.school_id ?? "");

  // Handlers with spinner effect
  const onSaveLocality = async () => {
    setSavingLocality(true);
    await handleLocalitySave(localLocality);
    setSavingLocality(false);
  };
  const onSaveKioskUrl = async () => {
    setSavingKioskUrl(true);
    await handleKioskUrlSave(localKioskUrl);
    setSavingKioskUrl(false);
  };
  const onSaveSchool = async () => {
    setSavingSchool(true);
    await handleSchoolSave(localSchoolSelection);
    setSavingSchool(false);
  };

  // Fælles cell style for begge papers!
  const cellStyle = {
    border: 0,
    fontWeight: 600,
    whiteSpace: "nowrap",
    pr: 0.1,
    py: 0,
    verticalAlign: "middle",
    height: isMobile ? 22 : 30,
    fontSize: isMobile ? 12 : 14,
  };
  const valueCellStyle = {
    border: 0,
    pl: 0.1,
    py: 0,
    verticalAlign: "middle",
    height: isMobile ? 22 : 30,
    fontSize: isMobile ? 12 : 14,
  };

  // Input style for textfields and dropdown, + rød ramme hvis dirty
  const inputStyle = (dirty) => ({
    width: "100%",
    height: isMobile ? 22 : 30,
    textAlign: "left",
    "& .MuiInputBase-input": {
      fontSize: isMobile ? 12 : 14,
      height: isMobile ? "22px" : "30px",
      boxSizing: "border-box",
      padding: isMobile ? "4px 10px" : "6px 14px",
      textAlign: "left",
    },
    "& .MuiInputBase-root": {
      height: isMobile ? "22px" : "30px",
      textAlign: "left",
      ...(dirty && { border: "2px solid red", borderRadius: "6px" }),
    },
    ...(dirty && { border: "2px solid red", borderRadius: "6px" }),
  });

  function renderKioskBrowserData(data) {
    if (!data || typeof data !== "object") return null;
    return Object.entries(data).map(([key, value]) => (
      <TableRow key={key} sx={{ height: isMobile ? 22 : 30 }}>
        <TableCell sx={cellStyle}>{key}:</TableCell>
        <TableCell sx={valueCellStyle}>{String(value)}</TableCell>
      </TableRow>
    ));
  }

  // Paper width styling (40% / 60%) og automatisk tilpasning – ingen minWidth/overflow!
  const paper1Width = isMobile ? "100%" : "40%";
  const paper2Width = isMobile ? "100%" : "60%";

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
        <Button
          startIcon={<RefreshIcon fontSize={isMobile ? "small" : "medium"} />}
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
      </Box>
      <Box sx={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        width: "100%",
        alignItems: "flex-start",
      }}>
        {/* Paper 1 */}
        <Box sx={{
          width: paper1Width,
          pr: isMobile ? 0 : 1,
          minWidth: 0,
          overflow: "visible",
          flex: "0 1 auto",
        }}>
          <Card elevation={2} sx={{
            borderRadius: isMobile ? 1 : 2,
            minWidth: 0,
            overflow: "visible",
          }}>
            <CardContent
              sx={{
                px: isMobile ? 1 : 2,
                py: isMobile ? 1 : 2,
              }}
            >
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: isMobile ? 16 : 18 }}>
                  Klient info
                </Typography>
                <OnlineStatusBadge isOnline={client.isOnline} isMobile={isMobile} />
              </Box>
              <TableContainer sx={{ overflow: "visible" }}>
                <Table size="small" aria-label="klientinfo">
                  <TableBody>
                    <TableRow sx={{ height: isMobile ? 22 : 30 }}>
                      <TableCell sx={cellStyle}>Klientnavn:</TableCell>
                      <TableCell sx={valueCellStyle}>{client.name}</TableCell>
                    </TableRow>
                    {user?.role === "admin" && (
                      <TableRow sx={{ height: isMobile ? 22 : 30 }}>
                        <TableCell sx={cellStyle}>Klient ID:</TableCell>
                        <TableCell sx={valueCellStyle}>{client.id}</TableCell>
                      </TableRow>
                    )}
                    <TableRow sx={{ height: isMobile ? 22 : 30 }}>
                      <TableCell sx={cellStyle}>Skole:</TableCell>
                      <TableCell sx={valueCellStyle}>
                        <Box sx={{ display: "flex", alignItems: "center", width: "100%" }}>
                          <Select
                            size="small"
                            value={localSchoolSelection}
                            displayEmpty
                            onChange={e => setLocalSchoolSelection(e.target.value)}
                            sx={{
                              ...inputStyle(schoolDirty),
                              "& .MuiSelect-select": {
                                ...inputStyle(schoolDirty)["& .MuiInputBase-input"],
                                textAlign: "left",
                                paddingLeft: isMobile ? "10px" : "14px",
                              }
                            }}
                            MenuProps={{
                              PaperProps: {
                                sx: {
                                  fontSize: isMobile ? 12 : 14,
                                  fontWeight: 400,
                                  background: "white",
                                  textAlign: "left",
                                }
                              }
                            }}
                          >
                            <MenuItem value="" sx={{ textAlign: "left", fontWeight: 400, fontSize: isMobile ? 12 : 14 }}>
                              Vælg skole
                            </MenuItem>
                            {schools.map(school => (
                              <MenuItem key={school.id} value={school.id} sx={{ textAlign: "left", fontWeight: 400, fontSize: isMobile ? 12 : 14 }}>
                                {school.name}
                              </MenuItem>
                            ))}
                          </Select>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={onSaveSchool}
                            disabled={savingSchool}
                            sx={{
                              minWidth: 56,
                              ml: 1,
                              height: isMobile ? "22px" : "30px"
                            }}
                          >
                            {savingSchool ? <CircularProgress size={14} /> : "Gem"}
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Box>
        {/* Paper 2 */}
        <Box sx={{
          width: paper2Width,
          pl: isMobile ? 0 : 1,
          minWidth: 0,
          overflow: "visible",
          flex: "0 1 auto",
        }}>
          <Card elevation={2} sx={{
            borderRadius: isMobile ? 1 : 2,
            minWidth: 0,
            overflow: "visible",
          }}>
            <CardContent
              sx={{
                px: isMobile ? 1 : 2,
                py: isMobile ? 1 : 2,
              }}
            >
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: isMobile ? 16 : 18 }}>
                  Kiosk browser info
                </Typography>
                <StateBadge state={client.state} isMobile={isMobile} />
              </Box>
              <TableContainer sx={{ overflow: "visible" }}>
                <Table size="small" aria-label="kioskinfo">
                  <TableBody>
                    {/* Lokation først, ovenover Kiosk URL */}
                    <TableRow sx={{ height: isMobile ? 22 : 30 }}>
                      <TableCell sx={cellStyle}>Lokation:</TableCell>
                      <TableCell sx={valueCellStyle}>
                        <Box sx={{ display: "flex", alignItems: "center", width: "100%" }}>
                          <TextField
                            size="small"
                            value={localLocality}
                            onChange={e => setLocalLocality(e.target.value)}
                            sx={inputStyle(localityDirty)}
                          />
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={onSaveLocality}
                            disabled={savingLocality}
                            sx={{ minWidth: 56, height: isMobile ? "22px" : "30px", ml: 1 }}
                          >
                            {savingLocality ? <CircularProgress size={14} /> : "Gem"}
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ height: isMobile ? 22 : 30 }}>
                      <TableCell sx={cellStyle}>Kiosk URL:</TableCell>
                      <TableCell sx={valueCellStyle}>
                        <Box sx={{ display: "flex", alignItems: "center", width: "100%" }}>
                          <TextField
                            size="small"
                            value={localKioskUrl}
                            onChange={e => setLocalKioskUrl(e.target.value)}
                            sx={inputStyle(kioskUrlDirty)}
                          />
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={onSaveKioskUrl}
                            disabled={savingKioskUrl}
                            sx={{ minWidth: 56, height: isMobile ? "22px" : "30px", ml: 1 }}
                          >
                            {savingKioskUrl ? <CircularProgress size={14} /> : "Gem"}
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ height: isMobile ? 22 : 30 }}>
                      <TableCell sx={cellStyle}>Kiosk browser status:</TableCell>
                      <TableCell sx={valueCellStyle}>
                        <ChromeStatusBadge status={liveChromeStatus} color={liveChromeColor} isMobile={isMobile} />
                      </TableCell>
                    </TableRow>
                    {renderKioskBrowserData(kioskBrowserData)}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}
