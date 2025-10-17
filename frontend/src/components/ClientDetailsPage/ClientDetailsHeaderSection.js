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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  MenuItem
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RefreshIcon from "@mui/icons-material/Refresh";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/authcontext";
import { getSchools as apiGetSchools, updateClient as apiUpdateClient } from "../../api";

// DEBUG flag: sæt true for at se raw/resolved farver i konsollen
const DEBUG_CHROME_COLOR = false;

// Fælles StatusBadge med 2s puls animation hvis animate=true
function StatusBadge({ color, text, animate = false, isMobile = false, showText = true }) {
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", ml: isMobile ? 1 : 2 }}>
      <Box
        sx={{
          width: isMobile ? 8 : 10,
          height: isMobile ? 8 : 10,
          borderRadius: "50%",
          bgcolor: color,
          boxShadow: "0 0 2px rgba(0,0,0,0.12)",
          border: "1px solid #ddd",
          mr: showText ? 1 : 0,
          animation: animate ? "pulsate 2s infinite" : "none"
        }}
      />
      {showText && (
        <Typography variant="body2" sx={{ fontWeight: 400, textTransform: "none", fontSize: isMobile ? 12 : 14 }}>
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

// Online/offline badge med 2s puls, grøn/rød
function OnlineStatusBadge({ isOnline, isMobile = false }) {
  const color = isOnline ? "#43a047" : "#e53935";
  const text = isOnline ? "online" : "offline";
  return <StatusBadge color={color} text={text} animate={true} isMobile={isMobile} />;
}

// State badge med 2s puls på farvede states, ikke på "ukendt"
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
  return <StatusBadge color={color} text={String(text).toLowerCase()} animate={animate} isMobile={isMobile} />;
}

// --- Helper: normaliser farveinput fra backend eller map baseret på status ---
function mapStatusToColor(status, theme) {
  const s = (status || "").toLowerCase();
  if (s.includes("error") || s.includes("fail") || s.includes("crash")) {
    return theme?.palette?.error?.main || "#e53935";
  }
  if (s.includes("offline") || s === "offline" || s === "off") {
    return theme?.palette?.grey?.[600] || "#757575";
  }
  if (s.includes("unknown") || s === "unknown" || !s) {
    return theme?.palette?.grey?.[400] || "#BDBDBD";
  }
  return theme?.palette?.success?.main || "#43a047";
}

function normalizeColorInput(colorInput, status, theme) {
  if (!colorInput) {
    if (DEBUG_CHROME_COLOR) console.debug("normalizeColorInput: empty input -> status fallback", status);
    return mapStatusToColor(status, theme);
  }

  // Strings: hex, rgb/hsl or palette keys or color names
  if (typeof colorInput === "string") {
    const s = colorInput.trim();
    // hex or rgb/hsl
    if (/^#([0-9A-Fa-f]{3,8})$/.test(s) || /^rgb/i.test(s) || /^hsl/i.test(s)) {
      return s;
    }
    // simple color name like "red"
    if (/^[a-zA-Z]+$/.test(s)) {
      return s;
    }
    // theme.palette keys: e.g. "success" or "success.main" or "primary.dark"
    try {
      // direct key
      if (theme?.palette && theme.palette[s]) {
        const val = theme.palette[s];
        if (typeof val === "string") return val;
        if (val && val.main) return val.main;
      }
      // dotted path
      if (s.indexOf(".") >= 0 && theme?.palette) {
        const parts = s.split(".");
        let cur = theme.palette;
        for (const p of parts) {
          if (cur && cur[p] !== undefined) cur = cur[p];
          else {
            if (DEBUG_CHROME_COLOR) console.debug("normalizeColorInput: palette key not found:", s);
            return mapStatusToColor(status, theme);
          }
        }
        if (typeof cur === "string") return cur;
        if (cur && cur.main) return cur.main;
      }
    } catch (e) {
      if (DEBUG_CHROME_COLOR) console.debug("normalizeColorInput palette lookup error:", e);
      return mapStatusToColor(status, theme);
    }
    // fallback: return string (browser might accept it)
    return s;
  }

  // Object shapes (e.g. { main: "#fff" })
  if (typeof colorInput === "object") {
    if (colorInput.main) return colorInput.main;
    const keys = Object.keys(colorInput);
    if (keys.length && typeof colorInput[keys[0]] === "string") return colorInput[keys[0]];
  }

  // last fallback
  return mapStatusToColor(status, theme);
}

// ChromeStatusBadge opdateret til at normalisere farver via theme
function ChromeStatusBadge({ status, color, isMobile = false }) {
  const theme = useTheme();
  const resolvedColor = normalizeColorInput(color, status, theme);
  if (DEBUG_CHROME_COLOR) console.debug("ChromeStatusBadge:", { status, rawColor: color, resolvedColor });
  const text = status || "ukendt";
  // Bounce for alle statuser
  const animate = true;
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center" }}>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 400,
          textTransform: "none",
          fontSize: isMobile ? 12 : 14,
          mr: 1,
        }}
      >
        {text}
      </Typography>
      <StatusBadge color={resolvedColor} animate={animate} isMobile={isMobile} showText={false} />
    </Box>
  );
}

function CopyIconButton({ value, disabled, iconSize = 16, isMobile = false }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    if (!value) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      // ignore
    }
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
  schools = [],
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
  onSchoolUpdated,
  showSnackbar,
}) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { user } = useAuth();

  // School state
  const [schoolsList, setSchoolsList] = React.useState(Array.isArray(schools) ? schools : []);
  const [loadingSchools, setLoadingSchools] = React.useState(false);
  const [schoolsError, setSchoolsError] = React.useState(null);

  const [selectedSchool, setSelectedSchool] = React.useState(client?.school_id ?? "");
  const [savingSchool, setSavingSchool] = React.useState(false);
  const [selectedSchoolDirty, setSelectedSchoolDirty] = React.useState(false);

  React.useEffect(() => {
    if (Array.isArray(schools) && schools.length) {
      setSchoolsList(schools);
    }
  }, [schools]);

  React.useEffect(() => {
    setSelectedSchool(client?.school_id ?? "");
    setSelectedSchoolDirty(false);
  }, [client?.school_id]);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      if (Array.isArray(schools) && schools.length) return;
      setLoadingSchools(true);
      setSchoolsError(null);
      try {
        const data = await apiGetSchools();
        if (cancelled) return;
        if (Array.isArray(data)) setSchoolsList(data);
        else if (Array.isArray(data.schools)) setSchoolsList(data.schools);
      } catch (err) {
        if (cancelled) return;
        setSchoolsError(err.message || "Fejl ved hentning af skoler");
      } finally {
        if (!cancelled) setLoadingSchools(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [schools]);

  const handleSchoolSelectChange = (e) => {
    const newVal = e.target.value;
    setSelectedSchool(newVal);
    setSelectedSchoolDirty(String(newVal) !== String(client?.school_id));
  };

  const handleSchoolSave = async () => {
    if (!client || !client.id) return;
    if (String(selectedSchool) === String(client.school_id)) return;
    setSavingSchool(true);
    try {
      const updated = await apiUpdateClient(client.id, { school_id: selectedSchool });
      if (typeof onSchoolUpdated === "function") {
        onSchoolUpdated(updated || { ...client, school_id: selectedSchool });
      }
      if (typeof showSnackbar === "function") {
        showSnackbar({ message: "Skole opdateret", severity: "success" });
      }
      setSelectedSchoolDirty(false);
    } catch (err) {
      console.error("Fejl ved opdatering af skole:", err);
      if (typeof showSnackbar === "function") {
        showSnackbar({ message: "Kunne ikke opdatere skole: " + (err.message || err), severity: "error" });
      }
    } finally {
      setSavingSchool(false);
    }
  };

  const labelStyle = {
    fontWeight: 600,
    whiteSpace: "nowrap",
    pr: isMobile ? 0.5 : 1,
    py: 0,
    verticalAlign: "middle",
    fontSize: isMobile ? 12 : 14,
    minWidth: 140,
  };
  const valueStyle = {
    fontWeight: 400,
    pl: isMobile ? 0.5 : 1.5,
    py: 0,
    verticalAlign: "middle",
    fontSize: isMobile ? 12 : 14,
  };

  const inputStyle = {
    width: "100%",
    height: 32,
    "& .MuiInputBase-input": {
      fontSize: isMobile ? 12 : 14,
      height: isMobile ? "30px" : "32px",
      boxSizing: "border-box",
      padding: isMobile ? "6px 10px" : "8px 14px"
    },
    "& .MuiInputBase-root": { height: isMobile ? "30px" : "32px" },
  };

  function renderKioskBrowserDataRows(data) {
    if (!data || typeof data !== "object") return null;
    return Object.entries(data).map(([key, value]) => (
      <TableRow key={key} sx={{ height: isMobile ? 28 : 34 }}>
        <TableCell sx={{ ...labelStyle, borderBottom: "none" }}>{key}:</TableCell>
        <TableCell sx={{ ...valueStyle, borderBottom: "none" }}>{String(value)}</TableCell>
      </TableRow>
    ));
  }

  const getSelectedSchoolName = () => {
    if (!selectedSchool) return "";
    const s = (schoolsList || []).find(x => String(x.id) === String(selectedSchool));
    return s ? s.name : String(selectedSchool);
  };

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
        {/* Paper 1 - Klient info */}
        <Box sx={{ width: isMobile ? "100%" : "50%", pr: isMobile ? 0 : 1, mb: isMobile ? 1 : 0 }}>
          <Card elevation={2} sx={{ borderRadius: isMobile ? 1 : 2, height: "100%" }}>
            <CardContent sx={{ px: isMobile ? 1 : 2, py: isMobile ? 1 : 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", mb: isMobile ? 0.5 : 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: isMobile ? 16 : 18 }}>
                  Klient info
                </Typography>
                <Box sx={{ ml: 1 }}>
                  <OnlineStatusBadge isOnline={client?.isOnline} isMobile={isMobile} />
                </Box>
              </Box>

              <TableContainer>
                <Table size="small" aria-label="klient-info">
                  <TableBody>
                    <TableRow sx={{ height: isMobile ? 28 : 34 }}>
                      <TableCell sx={{ ...labelStyle, borderBottom: "none" }}>Klientnavn:</TableCell>
                      <TableCell sx={{ ...valueStyle, borderBottom: "none" }}>
                        {client?.name ?? <span style={{ color: "#888" }}>Ukendt navn</span>}
                      </TableCell>
                    </TableRow>

                    {user?.role === "admin" && (
                      <TableRow sx={{ height: isMobile ? 28 : 34 }}>
                        <TableCell sx={{ ...labelStyle, borderBottom: "none" }}>Klient ID:</TableCell>
                        <TableCell sx={{ ...valueStyle, borderBottom: "none" }}>
                          {client?.id ?? "?"}
                        </TableCell>
                      </TableRow>
                    )}

                    <TableRow sx={{ height: isMobile ? 36 : 44 }}>
                      <TableCell sx={{ ...labelStyle, borderBottom: "none" }}>Skole:</TableCell>
                      <TableCell sx={{ ...valueStyle, borderBottom: "none" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          {/* Brug TextField med select så ramme matcher Lokation's TextField */}
                          <TextField
                            select
                            size="small"
                            value={selectedSchool ?? ""}
                            onChange={handleSchoolSelectChange}
                            disabled={loadingSchools}
                            sx={{ ...inputStyle }}
                            fullWidth
                            SelectProps={{ MenuProps: { disablePortal: true } }}
                            inputProps={{ "aria-label": "Skole" }}
                            error={!!selectedSchoolDirty}
                            onKeyDown={e => { if (e.key === "Enter") handleSchoolSave(); }}
                          >
                            <MenuItem value="">
                              <em>Ingen skole</em>
                            </MenuItem>
                            {(schoolsList || []).map(s => (
                              <MenuItem key={s.id} value={s.id}>
                                {s.name}
                              </MenuItem>
                            ))}
                          </TextField>

                          <CopyIconButton
                            value={getSelectedSchoolName()}
                            disabled={!getSelectedSchoolName()}
                            iconSize={isMobile ? 13 : 15}
                            isMobile={isMobile}
                          />

                          <Button
                            variant="outlined"
                            size="small"
                            onClick={handleSchoolSave}
                            disabled={savingSchool || String(selectedSchool) === String(client?.school_id)}
                            sx={{ minWidth: 56 }}
                          >
                            {savingSchool ? <CircularProgress size={isMobile ? 13 : 16} /> : "Gem"}
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>

                    <TableRow sx={{ height: isMobile ? 36 : 44 }}>
                      <TableCell sx={{ ...labelStyle, borderBottom: "none" }}>Lokation:</TableCell>
                      <TableCell sx={{ ...valueStyle, borderBottom: "none" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <TextField
                            size="small"
                            value={locality ?? ""}
                            onChange={handleLocalityChange}
                            sx={inputStyle}
                            disabled={savingLocality}
                            inputProps={{ style: { fontSize: isMobile ? 12 : 14 } }}
                            onKeyDown={e => { if (e.key === "Enter") handleLocalitySave(); }}
                            error={!!localityDirty}
                            fullWidth
                          />
                          <CopyIconButton value={locality ?? ""} disabled={!locality} iconSize={isMobile ? 13 : 15} isMobile={isMobile} />
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
                      </TableCell>
                    </TableRow>

                    <TableRow sx={{ height: isMobile ? 36 : 44 }}>
                      <TableCell sx={{ ...labelStyle, borderBottom: "none" }}>Kiosk URL:</TableCell>
                      <TableCell sx={{ ...valueStyle, borderBottom: "none" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <TextField
                            size="small"
                            value={kioskUrl ?? ""}
                            onChange={handleKioskUrlChange}
                            sx={inputStyle}
                            disabled={savingKioskUrl}
                            inputProps={{ style: { fontSize: isMobile ? 12 : 14 } }}
                            onKeyDown={e => { if (e.key === "Enter") handleKioskUrlSave(); }}
                            error={!!kioskUrlDirty}
                            fullWidth
                          />
                          <CopyIconButton value={kioskUrl ?? ""} disabled={!kioskUrl} iconSize={isMobile ? 13 : 15} isMobile={isMobile} />
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
                      </TableCell>
                    </TableRow>

                    <TableRow sx={{ height: isMobile ? 32 : 40 }}>
                      <TableCell sx={{ ...labelStyle, borderBottom: "none" }}>Kiosk browser status:</TableCell>
                      <TableCell sx={{ ...valueStyle, borderBottom: "none" }}>
                        <ChromeStatusBadge status={liveChromeStatus} color={liveChromeColor} isMobile={isMobile} />
                      </TableCell>
                    </TableRow>

                    {/* Rækker for kioskBrowserData */}
                    {renderKioskBrowserDataRows(kioskBrowserData)}

                  </TableBody>
                </Table>
              </TableContainer>

            </CardContent>
          </Card>
        </Box>

        {/* Paper 2 - Kiosk info */}
        <Box sx={{ width: isMobile ? "100%" : "50%", pl: isMobile ? 0 : 1 }}>
          <Card elevation={2} sx={{ borderRadius: isMobile ? 1 : 2, height: "100%" }}>
            <CardContent sx={{ px: isMobile ? 1 : 2, py: isMobile ? 1 : 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", mb: isMobile ? 0.5 : 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: isMobile ? 16 : 18 }}>
                  Kiosk info
                </Typography>
                <Box sx={{ ml: 1 }}>
                  <StateBadge state={client?.state} isMobile={isMobile} />
                </Box>
              </Box>

              <TableContainer>
                <Table size="small" aria-label="kiosk-info">
                  <TableBody>
                    <TableRow sx={{ height: isMobile ? 36 : 44 }}>
                      <TableCell sx={{ ...labelStyle, borderBottom: "none" }}>Kiosk URL:</TableCell>
                      <TableCell sx={{ ...valueStyle, borderBottom: "none" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <TextField
                            size="small"
                            value={kioskUrl ?? ""}
                            onChange={handleKioskUrlChange}
                            sx={inputStyle}
                            disabled={savingKioskUrl}
                            inputProps={{ style: { fontSize: isMobile ? 12 : 14 } }}
                            onKeyDown={e => { if (e.key === "Enter") handleKioskUrlSave(); }}
                            error={!!kioskUrlDirty}
                            fullWidth
                          />
                          <CopyIconButton value={kioskUrl ?? ""} disabled={!kioskUrl} iconSize={isMobile ? 13 : 15} isMobile={isMobile} />
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
                      </TableCell>
                    </TableRow>

                    <TableRow sx={{ height: isMobile ? 28 : 34 }}>
                      <TableCell sx={{ ...labelStyle, borderBottom: "none" }}>Kiosk browser status:</TableCell>
                      <TableCell sx={{ ...valueStyle, borderBottom: "none" }}>
                        <ChromeStatusBadge status={liveChromeStatus} color={liveChromeColor} isMobile={isMobile} />
                      </TableCell>
                    </TableRow>

                    {/* Rækker for kioskBrowserData */}
                    {renderKioskBrowserDataRows(kioskBrowserData)}

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
