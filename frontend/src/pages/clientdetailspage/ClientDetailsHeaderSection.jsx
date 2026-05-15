import React from "react";
import {
  Box, Card, CardContent, Typography, Button, CircularProgress,
  Tooltip, TextField, useMediaQuery, Table, TableBody, TableCell,
  TableContainer, TableRow, MenuItem
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RefreshIcon from "@mui/icons-material/Refresh";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/authcontext";
import {
  getSchools as apiGetSchools,
  updateClient as apiUpdateClient,
  pushKioskUrl as apiPushKioskUrl
} from "../../api";

const COLOR_NAME_MAP = {
  red: "#e53935", green: "#43a047", yellow: "#ffa000", orange: "#ff9800",
  blue: "#1976d2", grey: "#9e9e9e", gray: "#9e9e9e", black: "#000000", white: "#ffffff"
};

function resolveColor(theme, color) {
  if (!color) return theme.palette?.grey?.[400] || "#bdbdbd";
  if (typeof color === "object") { try { return String(color); } catch { return theme.palette?.grey?.[400] || "#bdbdbd"; } }
  if (typeof color !== "string") return String(color);
  const trimmed = color.trim();
  if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(trimmed) || /^rgba?\(/i.test(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  if (lower.includes(".")) {
    const [paletteKey, shade] = lower.split(".");
    const pal = theme.palette?.[paletteKey];
    if (pal) {
      if (shade && pal[shade]) return pal[shade];
      if (pal.main) return pal.main;
      if (typeof pal === "string") return pal;
    }
  }
  if (theme.palette?.[lower]) {
    const pal = theme.palette[lower];
    if (typeof pal === "string") return pal;
    if (pal.main) return pal.main;
  }
  if (COLOR_NAME_MAP[lower]) return COLOR_NAME_MAP[lower];
  return trimmed;
}

function StatusBadge({ color, text, animate = false, isMobile = false }) {
  const theme = useTheme();
  const resolvedBg = React.useMemo(() => resolveColor(theme, color), [color, theme]);
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", ml: isMobile ? 1 : 2 }}>
      <Box
        sx={{
          width: isMobile ? 8 : 10, height: isMobile ? 8 : 10,
          borderRadius: "50%", boxShadow: "0 0 2px rgba(0,0,0,0.12)",
          border: "1px solid #ddd", mr: 1,
          animation: animate ? "pulsateStatusBadge 2s infinite" : "none",
          "@keyframes pulsateStatusBadge": {
            "0%": { transform: "scale(1)", opacity: 1 },
            "50%": { transform: "scale(1.25)", opacity: 0.5 },
            "100%": { transform: "scale(1)", opacity: 1 }
          }
        }}
        style={{ backgroundColor: resolvedBg }}
      />
      <Typography variant="body2" sx={{ fontWeight: 400, textTransform: "none", fontSize: isMobile ? 12 : 14 }}>
        {text}
      </Typography>
    </Box>
  );
}

function OnlineStatusBadge({ isOnline, isMobile = false }) {
  return <StatusBadge color={isOnline ? "#43a047" : "#e53935"} text={isOnline ? "online" : "offline"} animate={true} isMobile={isMobile} />;
}

function StateBadge({ state, isMobile = false }) {
  let color = "grey.400", text = state || "ukendt", animate = false;
  if (state) {
    const s = String(state).toLowerCase().trim();
    if (s.startsWith("sleep")) { color = "#1976d2"; animate = true; }
    else {
      switch (s) {
        case "normal": color = "#43a047"; animate = true; break;
        case "maintenance": color = "#ffa000"; animate = true; break;
        case "error": color = "#e53935"; animate = true; break;
        case "offline": color = "#757575"; animate = false; break;
        default: color = "grey.400"; animate = false;
      }
    }
  }
  return <StatusBadge color={color} text={String(text).toLowerCase()} animate={animate} isMobile={isMobile} />;
}

function ChromeStatusBadge({ status, color, isMobile = false }) {
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center" }}>
      <StatusBadge color={color} text={status || "ukendt"} animate={true} isMobile={isMobile} />
    </Box>
  );
}

function CopyIconButton({ value, disabled, iconSize = 16, isMobile = false }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = async () => {
    if (!value) return;
    try {
      if (navigator.clipboard?.writeText) {
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
    } catch { }
  };
  return (
    <Tooltip title={copied ? "Kopieret!" : "Kopiér"}>
      <span>
        <Button
          size="small" onClick={handleCopy} disabled={disabled}
          sx={{
            minWidth: isMobile ? 20 : 24, maxWidth: isMobile ? 20 : 24,
            minHeight: isMobile ? 20 : 24, maxHeight: isMobile ? 20 : 24,
            p: 0, m: 0, display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <ContentCopyIcon style={{ fontSize: isMobile ? 13 : iconSize }} color={copied ? "success" : "inherit"} />
        </Button>
      </span>
    </Tooltip>
  );
}

const NO_SCROLL_SX = {
  overflowX: "hidden", overflowY: "hidden",
  "-ms-overflow-style": "none", scrollbarWidth: "none",
  "&::-webkit-scrollbar": { display: "none" }
};

function ClientDetailsHeaderSection({
  client,
  schools = [],
  liveChromeStatus,
  liveChromeColor,
  refreshing,
  handleRefresh,
  kioskBrowserData = {},
  showSnackbar,
}) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "md"));
  const { user } = useAuth();
  const isDesktop = !isMobile && !isTablet;

  const [localLocality, setLocalLocality] = React.useState(client?.locality ?? "");
  const [localKioskUrl, setLocalKioskUrl] = React.useState(client?.kiosk_url ?? "");
  const initialLocalityRef = React.useRef(client?.locality ?? "");
  const initialKioskUrlRef = React.useRef(client?.kiosk_url ?? "");

  const leftPaperWidth = isDesktop ? "40%" : isTablet ? "50%" : "100%";
  const rightPaperWidth = isDesktop ? "60%" : isTablet ? "50%" : "100%";
  const labelCellWidth = isDesktop ? 140 : isTablet ? 120 : 100;

  const [schoolsList, setSchoolsList] = React.useState(Array.isArray(schools) ? schools : []);
  const [loadingSchools, setLoadingSchools] = React.useState(false);
  const [selectedSchool, setSelectedSchool] = React.useState(client?.school_id ?? "");
  const [savingSchool, setSavingSchool] = React.useState(false);
  const [selectedSchoolDirty, setSelectedSchoolDirty] = React.useState(false);
  const initialSelectedSchoolRef = React.useRef(client?.school_id ?? "");

  const [savingLocality, setSavingLocality] = React.useState(false);
  const [savingKiosk, setSavingKiosk] = React.useState(false);

  React.useEffect(() => {
    if (Array.isArray(schools) && schools.length) setSchoolsList(schools);
  }, [schools]);

  React.useEffect(() => {
    setSelectedSchool(client?.school_id ?? "");
    initialSelectedSchoolRef.current = client?.school_id ?? "";
    setSelectedSchoolDirty(false);
  }, [client?.school_id]);

  React.useEffect(() => {
    setLocalLocality(client?.locality ?? "");
    initialLocalityRef.current = client?.locality ?? "";
    setLocalKioskUrl(client?.kiosk_url ?? "");
    initialKioskUrlRef.current = client?.kiosk_url ?? "";
  }, [client?.id, client?.locality, client?.kiosk_url]);

  const localityChanged = String(localLocality ?? "") !== String(initialLocalityRef.current ?? "");
  const kioskUrlChanged = String(localKioskUrl ?? "") !== String(initialKioskUrlRef.current ?? "");

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      if (Array.isArray(schools) && schools.length) return;
      setLoadingSchools(true);
      try {
        const data = await apiGetSchools();
        if (cancelled) return;
        if (Array.isArray(data)) setSchoolsList(data);
        else if (Array.isArray(data?.schools)) setSchoolsList(data.schools);
      } catch { } finally {
        if (!cancelled) setLoadingSchools(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [schools]);

  const handleSchoolSelectChange = (e) => {
    const newVal = e.target.value;
    setSelectedSchool(newVal);
    setSelectedSchoolDirty(String(newVal) !== String(initialSelectedSchoolRef.current));
  };

  const handleSchoolSave = async () => {
    if (!client?.id) return;
    if (String(selectedSchool) === String(initialSelectedSchoolRef.current)) {
      setSelectedSchoolDirty(false); return;
    }
    setSavingSchool(true);
    try {
      await apiUpdateClient(client.id, { school_id: selectedSchool });
      if (typeof showSnackbar === "function") showSnackbar({ message: "Skole gemt", severity: "success" });
      initialSelectedSchoolRef.current = selectedSchool;
      setSelectedSchoolDirty(false);
    } catch (err) {
      if (typeof showSnackbar === "function") showSnackbar({ message: "Kunne ikke opdatere skole: " + (err?.message || err), severity: "error" });
    } finally {
      setSavingSchool(false);
    }
  };

  const handleLocalitySave = async () => {
    if (!client?.id || !localityChanged) return;
    setSavingLocality(true);
    try {
      await apiUpdateClient(client.id, { locality: localLocality });
      if (typeof showSnackbar === "function") showSnackbar({ message: "Lokation gemt", severity: "success" });
      initialLocalityRef.current = localLocality;
    } catch (err) {
      if (typeof showSnackbar === "function") showSnackbar({ message: "Kunne ikke gemme lokation: " + (err?.message || err), severity: "error" });
    } finally {
      setSavingLocality(false);
    }
  };

  const handleKioskUrlSave = async () => {
    if (!client?.id || !kioskUrlChanged) return;
    setSavingKiosk(true);
    try {
      await apiPushKioskUrl(client.id, localKioskUrl);
      if (typeof showSnackbar === "function") showSnackbar({ message: "Kiosk webadresse gemt", severity: "success" });
      initialKioskUrlRef.current = localKioskUrl;
    } catch (err) {
      if (typeof showSnackbar === "function") showSnackbar({ message: "Kunne ikke opdatere kiosk webadresse: " + (err?.message || err), severity: "error" });
    } finally {
      setSavingKiosk(false);
    }
  };

  // FIX: Kun render kioskBrowserData hvis der faktisk er data
  function renderKioskBrowserDataRows(data) {
    if (!data || typeof data !== "object" || Object.keys(data).length === 0) return null;
    return Object.entries(data).map(([key, value]) => (
      <TableRow key={key} sx={{ height: isMobile ? 28 : 34 }}>
        <TableCell sx={{
          fontWeight: 600, whiteSpace: "nowrap", pr: isMobile ? 0.5 : 1, py: 0,
          verticalAlign: "middle", fontSize: isMobile ? 12 : 14, borderBottom: "none",
          width: labelCellWidth, minWidth: labelCellWidth,
        }}>
          {key}:
        </TableCell>
        <TableCell sx={{ fontWeight: 400, pl: isMobile ? 0.5 : 1.5, py: 0, verticalAlign: "middle", fontSize: isMobile ? 12 : 14, borderBottom: "none" }}>
          {String(value)}
        </TableCell>
      </TableRow>
    ));
  }

  const getSelectedSchoolName = React.useCallback(() => {
    if (!selectedSchool) return "";
    const s = (schoolsList || []).find(x => String(x.id) === String(selectedSchool));
    return s ? s.name : String(selectedSchool);
  }, [selectedSchool, schoolsList]);

  const isOffline = client?.isOnline === false;
  const rightPaperDisabledStyle = isOffline ? { opacity: 0.7, filter: "grayscale(30%)", bgcolor: "#fafafa" } : {};

  const selectSx = {
    width: "100%",
    "& .MuiOutlinedInput-root": { height: isMobile ? 30 : 32, padding: 0, boxSizing: "border-box" },
    "& .MuiInputBase-input": {
      fontSize: isMobile ? 12 : 14, height: isMobile ? "28px" : "32px",
      boxSizing: "border-box", padding: isMobile ? "6px 8px" : "8px 14px",
      display: "flex", alignItems: "center"
    },
    "& .MuiSelect-select": { height: "100%", display: "flex", alignItems: "center", padding: isMobile ? "6px 8px" : "8px 14px" },
    "& .MuiSelect-icon": { top: "50%", transform: "translateY(-50%)" }
  };

  const textFieldSx = {
    width: "100%", height: isMobile ? 30 : 32,
    "& .MuiInputBase-input": {
      fontSize: isMobile ? 12 : 14, height: isMobile ? "28px" : "32px",
      boxSizing: "border-box", padding: isMobile ? "6px 8px" : "8px 14px"
    }
  };

  return (
    <Box sx={{ width: "100%" }} data-testid="client-details-header">
      {/* Topbar */}
      <Box sx={{
        display: "flex", flexDirection: isMobile ? "column" : "row",
        justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center",
        mb: isMobile ? 0.5 : 1, gap: isMobile ? 1 : 0
      }}>
        <Button
          variant="outlined" startIcon={<ArrowBackIcon sx={{ fontSize: isMobile ? 19 : 20 }} />}
          onClick={() => navigate("/clients")}
          sx={{ textTransform: "none", fontWeight: 500, minWidth: 0, px: isMobile ? 1.2 : 2, fontSize: isMobile ? "0.93rem" : 14, mb: isMobile ? 0.5 : 0 }}
        >
          Tilbage til klientoversigt
        </Button>
        <Tooltip title="Opdater klient">
          <span>
            <Button
              startIcon={refreshing ? <CircularProgress size={isMobile ? 15 : 18} /> : <RefreshIcon fontSize={isMobile ? "small" : "medium"} />}
              disabled={refreshing} color="primary" onClick={handleRefresh}
              sx={{ fontWeight: 500, textTransform: "none", minWidth: 0, mr: isMobile ? 0 : 1, px: isMobile ? 1.2 : 2, fontSize: isMobile ? "0.93rem" : 14 }}
            >
              {refreshing ? "Opdaterer..." : "Opdater"}
            </Button>
          </span>
        </Tooltip>
      </Box>

      {/* Papers */}
      <Box sx={{ display: "flex", flexDirection: isMobile ? "column" : "row", width: "100%", alignItems: "stretch" }}>
        {/* Klient info (left) */}
        <Box sx={{ width: leftPaperWidth, pr: isMobile ? 0 : 1, mb: isMobile ? 1 : 0, display: "flex", flexDirection: "column" }}>
          <Card elevation={2} sx={{ borderRadius: isMobile ? 1 : 2, height: "auto", overflow: "hidden", display: "flex", flexDirection: "column", flex: 1 }}>
            <CardContent sx={{ px: isMobile ? 1 : 2, py: isMobile ? 1 : 2, ...NO_SCROLL_SX, display: "flex", flexDirection: "column", flex: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", mb: isMobile ? 0.5 : 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: isMobile ? 16 : 18 }}>Klient info</Typography>
                <Box sx={{ ml: 1 }}><OnlineStatusBadge isOnline={client?.isOnline} isMobile={isMobile} /></Box>
              </Box>
              <TableContainer sx={{ width: "100%", ...NO_SCROLL_SX }}>
                <Table size="small" aria-label="klient-info" sx={{ tableLayout: "fixed", width: "100%" }}>
                  <TableBody>
                    <TableRow sx={{ height: isMobile ? 28 : 34 }}>
                      <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap", pr: isMobile ? 0.5 : 1, py: 0, verticalAlign: "middle", fontSize: isMobile ? 12 : 14, borderBottom: "none", width: labelCellWidth, minWidth: labelCellWidth }}>
                        Klientnavn:
                      </TableCell>
                      <TableCell sx={{ fontWeight: 400, pl: isMobile ? 0.5 : 1.5, py: 0, verticalAlign: "middle", fontSize: isMobile ? 12 : 14, borderBottom: "none" }}>
                        {client?.name ?? <span style={{ color: "#888" }}>Ukendt navn</span>}
                      </TableCell>
                    </TableRow>

                    {(user?.role === "admin" || user?.role === "superadmin") && (
                      <TableRow sx={{ height: isMobile ? 28 : 34 }}>
                        <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap", pr: isMobile ? 0.5 : 1, py: 0, verticalAlign: "middle", fontSize: isMobile ? 12 : 14, borderBottom: "none", width: labelCellWidth, minWidth: labelCellWidth }}>
                          Klient ID:
                        </TableCell>
                        <TableCell sx={{ fontWeight: 400, pl: isMobile ? 0.5 : 1.5, py: 0, verticalAlign: "middle", fontSize: isMobile ? 12 : 14, borderBottom: "none" }}>
                          {client?.id ?? "?"}
                        </TableCell>
                      </TableRow>
                    )}

                    {(user?.role === "admin" || user?.role === "superadmin") && (
                      <TableRow sx={{ height: isMobile ? 36 : 44 }}>
                        <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap", pr: isMobile ? 0.5 : 1, py: 0, verticalAlign: "middle", fontSize: isMobile ? 12 : 14, borderBottom: "none", width: labelCellWidth, minWidth: labelCellWidth }}>
                          Skole:
                        </TableCell>
                        <TableCell sx={{ fontWeight: 400, pl: isMobile ? 0.5 : 1.5, py: 0, verticalAlign: "middle", fontSize: isMobile ? 12 : 14, borderBottom: "none" }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <TextField
                              select size="small" value={selectedSchool ?? ""}
                              onChange={handleSchoolSelectChange}
                              disabled={loadingSchools} fullWidth
                              SelectProps={{ MenuProps: { disablePortal: true } }}
                              inputProps={{ "aria-label": "Skole" }}
                              error={!!selectedSchoolDirty}
                              onKeyDown={e => { if (e.key === "Enter") handleSchoolSave(); }}
                              sx={selectSx}
                            >
                              <MenuItem value=""><em>Ingen skole</em></MenuItem>
                              {(schoolsList || []).map(s => (<MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>))}
                            </TextField>
                            <CopyIconButton value={getSelectedSchoolName()} disabled={!getSelectedSchoolName()} iconSize={isMobile ? 13 : 15} isMobile={isMobile} />
                            <Button variant="outlined" size="small" onClick={handleSchoolSave} disabled={savingSchool || !selectedSchoolDirty} sx={{ minWidth: isMobile ? 48 : 56 }}>
                              {savingSchool ? <CircularProgress size={isMobile ? 13 : 16} /> : "Gem"}
                            </Button>
                          </Box>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Box>

        {/* Infoskærm status (right) */}
        <Box sx={{ width: rightPaperWidth, pl: isMobile ? 0 : 1, display: "flex", flexDirection: "column" }}>
          <Card elevation={2} sx={{ borderRadius: isMobile ? 1 : 2, height: "auto", overflow: "hidden", ...rightPaperDisabledStyle, display: "flex", flexDirection: "column", flex: 1 }}>
            <CardContent sx={{ px: isMobile ? 1 : 2, py: isMobile ? 1 : 2, ...NO_SCROLL_SX, display: "flex", flexDirection: "column", flex: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", mb: isMobile ? 0.5 : 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: isMobile ? 16 : 18 }}>Infoskærm status</Typography>
                {client?.isOnline !== false && (
                  <Box sx={{ ml: 1 }}><StateBadge state={client?.state} isMobile={isMobile} /></Box>
                )}
              </Box>
              <TableContainer sx={{ width: "100%", ...NO_SCROLL_SX }}>
                <Table size="small" aria-label="kiosk-info" sx={{ tableLayout: "fixed", width: "100%" }}>
                  <TableBody>
                    {/* Lokation */}
                    <TableRow sx={{ height: isMobile ? 36 : 44 }}>
                      <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap", pr: isMobile ? 0.5 : 1, py: 0, verticalAlign: "middle", fontSize: isMobile ? 12 : 14, borderBottom: "none", width: labelCellWidth, minWidth: labelCellWidth }}>
                        Lokation:
                      </TableCell>
                      <TableCell sx={{ fontWeight: 400, pl: isMobile ? 0.5 : 1.5, py: 0, verticalAlign: "middle", fontSize: isMobile ? 12 : 14, borderBottom: "none" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <TextField
                            size="small" value={localLocality ?? ""} fullWidth
                            onChange={e => setLocalLocality(e.target.value)}
                            sx={textFieldSx} disabled={isOffline}
                            inputProps={{ style: { fontSize: isMobile ? 12 : 14 } }}
                            onKeyDown={e => { if (e.key === "Enter") handleLocalitySave(); }}
                            error={!!localityChanged}
                          />
                          <CopyIconButton value={localLocality ?? ""} disabled={!localLocality} iconSize={isMobile ? 13 : 15} isMobile={isMobile} />
                          <Button variant="outlined" size="small" onClick={handleLocalitySave}
                            disabled={!localityChanged || isOffline || savingLocality}
                            sx={{ minWidth: isMobile ? 48 : 56 }}>
                            {savingLocality ? <CircularProgress size={isMobile ? 13 : 16} /> : "Gem"}
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>

                    {/* Kiosk URL */}
                    <TableRow sx={{ height: isMobile ? 36 : 44 }}>
                      <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap", pr: isMobile ? 0.5 : 1, py: 0, verticalAlign: "middle", fontSize: isMobile ? 12 : 14, borderBottom: "none", width: labelCellWidth, minWidth: labelCellWidth }}>
                        Kiosk URL:
                      </TableCell>
                      <TableCell sx={{ fontWeight: 400, pl: isMobile ? 0.5 : 1.5, py: 0, verticalAlign: "middle", fontSize: isMobile ? 12 : 14, borderBottom: "none" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <TextField
                            size="small" value={localKioskUrl ?? ""} fullWidth
                            onChange={e => setLocalKioskUrl(e.target.value)}
                            sx={textFieldSx} disabled={isOffline}
                            inputProps={{ style: { fontSize: isMobile ? 12 : 14 } }}
                            onKeyDown={e => { if (e.key === "Enter") handleKioskUrlSave(); }}
                            error={!!kioskUrlChanged}
                          />
                          <CopyIconButton value={localKioskUrl ?? ""} disabled={!localKioskUrl} iconSize={isMobile ? 13 : 15} isMobile={isMobile} />
                          <Button variant="outlined" size="small" onClick={handleKioskUrlSave}
                            disabled={!kioskUrlChanged || isOffline || savingKiosk}
                            sx={{ minWidth: isMobile ? 48 : 56 }}>
                            {savingKiosk ? <CircularProgress size={isMobile ? 13 : 16} /> : "Gem"}
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>

                    {/* Kiosk browser status */}
                    <TableRow sx={{ height: isMobile ? 36 : 44 }}>
                      <TableCell sx={{ fontWeight: 600, whiteSpace: isMobile ? "nowrap" : "normal", overflow: isMobile ? "hidden" : "visible", textOverflow: isMobile ? "ellipsis" : "clip", borderBottom: "none", width: labelCellWidth, minWidth: labelCellWidth }}>
                        Kiosk browser status:
                      </TableCell>
                      <TableCell sx={{ fontWeight: 400, pl: isMobile ? 0.5 : 1.5, py: 0, verticalAlign: "middle", fontSize: isMobile ? 12 : 14, borderBottom: "none" }}>
                        <ChromeStatusBadge status={liveChromeStatus} color={liveChromeColor} isMobile={isMobile} />
                      </TableCell>
                    </TableRow>

                    {/* FIX: Kun render kioskBrowserData rows hvis der er data */}
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

export default React.memo(ClientDetailsHeaderSection);
