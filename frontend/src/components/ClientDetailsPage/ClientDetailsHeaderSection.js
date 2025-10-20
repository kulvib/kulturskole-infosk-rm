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
import { getSchools as apiGetSchools, updateClient as apiUpdateClient, pushKioskUrl as apiPushKioskUrl } from "../../api";

/*
  ClientDetailsHeaderSection.js

  - Gem-logik for skole, lokation og kiosk-URL udføres lokalt i denne komponent.
  - Header skriver direkte til backend og viser snackbar via showSnackbar.
  - Header kalder IKKE parent-handlere for disse saves, så parent.clientState ikke overskrives.
*/

const COLOR_NAME_MAP = {
  red: "#e53935",
  green: "#43a047",
  yellow: "#ffa000",
  orange: "#ff9800",
  blue: "#1976d2",
  grey: "#9e9e9e",
  gray: "#9e9e9e",
  black: "#000000",
  white: "#ffffff"
};

function resolveColor(theme, color) {
  if (!color) return theme.palette?.grey?.[400] || "#bdbdbd";
  if (typeof color === "object") {
    try { return String(color); } catch (e) { return theme.palette?.grey?.[400] || "#bdbdbd"; }
  }
  if (typeof color !== "string") return String(color);

  const trimmed = color.trim();
  if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(trimmed) || /^rgba?\(/i.test(trimmed)) {
    return trimmed;
  }
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
          width: isMobile ? 8 : 10,
          height: isMobile ? 8 : 10,
          borderRadius: "50%",
          boxShadow: "0 0 2px rgba(0,0,0,0.12)",
          border: "1px solid #ddd",
          mr: 1,
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
  const color = isOnline ? "#43a047" : "#e53935";
  const text = isOnline ? "online" : "offline";
  return <StatusBadge color={color} text={text} animate={true} isMobile={isMobile} />;
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
  return <StatusBadge color={color} text={String(text).toLowerCase()} animate={animate} isMobile={isMobile} />;
}

function ChromeStatusBadge({ status, color, isMobile = false }) {
  let text = status || "ukendt";
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center" }}>
      <StatusBadge color={color} text={text} animate={true} isMobile={isMobile} />
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
      // ignore copy errors
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

  // preserve desktop unchanged: if neither mobile nor tablet, we are on desktop
  const isDesktop = !isMobile && !isTablet;

  // Local state for inputs so we can detect "dirty" locally
  const [localLocality, setLocalLocality] = React.useState(client?.locality ?? "");
  const [localKioskUrl, setLocalKioskUrl] = React.useState(client?.kiosk_url ?? "");

  // Refs to store the initial values to compare against
  const initialLocalityRef = React.useRef(client?.locality ?? "");
  const initialKioskUrlRef = React.useRef(client?.kiosk_url ?? "");

  // Sync local state + initial refs when parent props change (e.g., on client switch or after save)
  React.useEffect(() => {
    setLocalLocality(client?.locality ?? "");
    initialLocalityRef.current = client?.locality ?? "";
    setLocalKioskUrl(client?.kiosk_url ?? "");
    initialKioskUrlRef.current = client?.kiosk_url ?? "";
  }, [client?.id, client?.locality, client?.kiosk_url]);

  // Compute dirty flags locally (string compare)
  const localityChanged = String(localLocality ?? "") !== String(initialLocalityRef.current ?? "");
  const kioskUrlChanged = String(localKioskUrl ?? "") !== String(initialKioskUrlRef.current ?? "");

  // Papers width per breakpoint (desktop must remain as before)
  const leftPaperWidth = isDesktop ? "40%" : isTablet ? "50%" : "100%";
  const rightPaperWidth = isDesktop ? "60%" : isTablet ? "50%" : "100%";

  // Label width (adjusted per breakpoint)
  const labelCellWidth = isDesktop ? 140 : isTablet ? 120 : 100;

  // Schools state (prefer prop)
  const [schoolsList, setSchoolsList] = React.useState(Array.isArray(schools) ? schools : []);
  const [loadingSchools, setLoadingSchools] = React.useState(false);

  const [selectedSchool, setSelectedSchool] = React.useState(client?.school_id ?? "");
  const [savingSchool, setSavingSchool] = React.useState(false);
  const [selectedSchoolDirty, setSelectedSchoolDirty] = React.useState(false);

  // Sync props -> state
  React.useEffect(() => {
    if (Array.isArray(schools) && schools.length) {
      setSchoolsList(schools);
    }
  }, [schools]);

  React.useEffect(() => {
    setSelectedSchool(client?.school_id ?? "");
    setSelectedSchoolDirty(false);
  }, [client?.school_id]);

  // fetch schools if not provided
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
      } catch {
        // ignore
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

  // Save school locally to backend only (do NOT call parent)
  const handleSchoolSave = async () => {
    if (!client || !client.id) return;
    if (String(selectedSchool) === String(client.school_id)) {
      setSelectedSchoolDirty(false);
      return;
    }
    setSavingSchool(true);
    try {
      await apiUpdateClient(client.id, { school_id: selectedSchool });
      if (typeof showSnackbar === "function") showSnackbar({ message: "Skole gemt", severity: "success" });
      setSelectedSchoolDirty(false);
      // keep local selectedSchool value so UI reflects user's choice
    } catch (err) {
      console.error("Fejl ved opdatering af skole:", err);
      if (typeof showSnackbar === "function") showSnackbar({ message: "Kunne ikke opdatere skole: " + (err?.message || err), severity: "error" });
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
    overflow: "hidden",
    textOverflow: "ellipsis",
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
    "& .MuiInputBase-input": {
      fontSize: isMobile ? 12 : 14,
      boxSizing: "border-box",
      padding: isMobile ? "6px 8px" : "8px 14px"
    },
  };

  // Locality handlers - local state + direct backend save (no parent updates)
  const onLocalityChange = (e) => {
    setLocalLocality(e?.target?.value ?? "");
  };

  const handleLocalitySaveLocal = async () => {
    if (!client || !client.id) return;
    if (!localityChanged) return;
    try {
      await apiUpdateClient(client.id, { locality: localLocality });
      initialLocalityRef.current = localLocality;
      if (typeof showSnackbar === "function") showSnackbar({ message: "Lokation gemt", severity: "success" });
    } catch (err) {
      console.error("Kunne ikke gemme lokation:", err);
      if (typeof showSnackbar === "function") showSnackbar({ message: "Kunne ikke gemme lokation: " + (err?.message || err), severity: "error" });
    }
  };

  // Kiosk URL handlers - local state + direct backend save (no parent updates)
  const onKioskUrlChange = (e) => {
    setLocalKioskUrl(e?.target?.value ?? "");
  };

  const handleKioskUrlSaveLocal = async () => {
    if (!client || !client.id) return;
    if (!kioskUrlChanged) return;
    try {
      if (typeof apiPushKioskUrl === "function") {
        await apiPushKioskUrl(client.id, localKioskUrl);
      } else {
        await apiUpdateClient(client.id, { kiosk_url: localKioskUrl });
      }
      initialKioskUrlRef.current = localKioskUrl;
      if (typeof showSnackbar === "function") showSnackbar({ message: "Kiosk webadresse gemt", severity: "success" });
    } catch (err) {
      console.error("Kunne ikke gemme kiosk URL:", err);
      if (typeof showSnackbar === "function") showSnackbar({ message: "Kunne ikke opdatere kiosk webadresse: " + (err?.message || err), severity: "error" });
    }
  };

  function renderKioskBrowserDataRows(data) {
    if (!data || typeof data !== "object") return null;
    return Object.entries(data).map(([key, value]) => (
      <TableRow key={key}>
        <TableCell sx={{ ...labelStyle, borderBottom: "none", width: labelCellWidth, minWidth: labelCellWidth }}>
          {key}:
        </TableCell>
        <TableCell sx={{ ...valueStyle, borderBottom: "none" }}>{String(value)}</TableCell>
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

  return (
    <Box sx={{ width: "100%" }} data-testid="client-details-header">
      {/* Topbar */}
      <Box sx={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", mb: isMobile ? 0.5 : 1, gap: isMobile ? 1 : 0 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon sx={{ fontSize: isMobile ? 19 : 20 }} />}
          onClick={() => navigate("/clients")}
          sx={{ textTransform: "none", fontWeight: 500, minWidth: 0, px: isMobile ? 1.2 : 2, fontSize: isMobile ? "0.93rem" : 14, mb: isMobile ? 0.5 : 0 }}
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
              sx={{ fontWeight: 500, textTransform: "none", minWidth: 0, mr: isMobile ? 0 : 1, px: isMobile ? 1.2 : 2, fontSize: isMobile ? "0.93rem" : 14 }}
            >
              {refreshing ? "Opdaterer..." : "Opdater"}
            </Button>
          </span>
        </Tooltip>
      </Box>

      {/* Papers */}
      <Box sx={{ display: "flex", flexDirection: isMobile ? "column" : "row", width: "100%" }}>
        {/* Klient info (left) */}
        <Box sx={{ width: leftPaperWidth, pr: isMobile ? 0 : 1, mb: isMobile ? 1 : 0 }}>
          <Card elevation={2} sx={{ borderRadius: isMobile ? 1 : 2 }}>
            <CardContent sx={{ px: isMobile ? 1 : 2, py: isMobile ? 1 : 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", mb: isMobile ? 0.5 : 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: isMobile ? 16 : 18 }}>Klient info</Typography>
                <Box sx={{ ml: 1 }}>
                  <OnlineStatusBadge isOnline={client?.isOnline} isMobile={isMobile} />
                </Box>
              </Box>

              <TableContainer>
                <Table size="small" aria-label="klient-info" sx={{ tableLayout: 'fixed', width: '100%' }}>
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ ...labelStyle, borderBottom: "none", width: labelCellWidth, minWidth: labelCellWidth }}>Klientnavn:</TableCell>
                      <TableCell sx={{ ...valueStyle, borderBottom: "none" }}>{client?.name ?? <span style={{ color: "#888" }}>Ukendt navn</span>}</TableCell>
                    </TableRow>

                    {user?.role === "admin" && (
                      <TableRow>
                        <TableCell sx={{ ...labelStyle, borderBottom: "none", width: labelCellWidth, minWidth: labelCellWidth }}>Klient ID:</TableCell>
                        <TableCell sx={{ ...valueStyle, borderBottom: "none" }}>{client?.id ?? "?"}</TableCell>
                      </TableRow>
                    )}

                    {user?.role === "admin" && (
                      <TableRow>
                        <TableCell sx={{ ...labelStyle, borderBottom: "none", width: labelCellWidth, minWidth: labelCellWidth }}>Skole:</TableCell>
                        <TableCell sx={{ ...valueStyle, borderBottom: "none" }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
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
                              <MenuItem value=""><em>Ingen skole</em></MenuItem>
                              {(schoolsList || []).map(s => (<MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>))}
                            </TextField>

                            <CopyIconButton value={getSelectedSchoolName()} disabled={!getSelectedSchoolName()} iconSize={isMobile ? 13 : 15} isMobile={isMobile} />

                            <Button
                              variant="outlined"
                              size="small"
                              onClick={handleSchoolSave}
                              disabled={savingSchool || String(selectedSchool) === String(client?.school_id)}
                              sx={{ minWidth: isMobile ? 48 : 56 }}
                            >
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
        <Box sx={{ width: rightPaperWidth, pl: isMobile ? 0 : 1 }}>
          <Card elevation={2} sx={{ borderRadius: isMobile ? 1 : 2, ...rightPaperDisabledStyle }}>
            <CardContent sx={{ px: isMobile ? 1 : 2, py: isMobile ? 1 : 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", mb: isMobile ? 0.5 : 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: isMobile ? 16 : 18 }}>Infoskærm status</Typography>
                {/* Hide state badge if client is explicitly offline */}
                {client?.isOnline !== false && (
                  <Box sx={{ ml: 1 }}><StateBadge state={client?.state} isMobile={isMobile} /></Box>
                )}
              </Box>

              <TableContainer>
                <Table size="small" aria-label="kiosk-info" sx={{ tableLayout: 'fixed', width: '100%' }}>
                  <TableBody>

                    {/* Lokation */}
                    <TableRow>
                      <TableCell sx={{ ...labelStyle, borderBottom: "none", width: labelCellWidth, minWidth: labelCellWidth }}>Lokation:</TableCell>
                      <TableCell sx={{ ...valueStyle, borderBottom: "none" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <TextField
                            size="small"
                            value={localLocality ?? ""}
                            onChange={onLocalityChange}
                            sx={inputStyle}
                            disabled={isOffline}
                            inputProps={{ style: { fontSize: isMobile ? 12 : 14 } }}
                            onKeyDown={e => { if (e.key === "Enter") handleLocalitySaveLocal(); }}
                            error={!!localityChanged}
                            fullWidth
                          />
                          <CopyIconButton value={localLocality ?? ""} disabled={!localLocality} iconSize={isMobile ? 13 : 15} isMobile={isMobile} />
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={handleLocalitySaveLocal}
                            disabled={!localityChanged || isOffline}
                            sx={{ minWidth: isMobile ? 48 : 56 }}
                          >
                            Gem
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>

                    {/* Kiosk URL */}
                    <TableRow>
                      <TableCell sx={{ ...labelStyle, borderBottom: "none", width: labelCellWidth, minWidth: labelCellWidth }}>Kiosk URL:</TableCell>
                      <TableCell sx={{ ...valueStyle, borderBottom: "none" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <TextField
                            size="small"
                            value={localKioskUrl ?? ""}
                            onChange={onKioskUrlChange}
                            sx={inputStyle}
                            disabled={isOffline}
                            inputProps={{ style: { fontSize: isMobile ? 12 : 14 } }}
                            onKeyDown={e => { if (e.key === "Enter") handleKioskUrlSaveLocal(); }}
                            error={!!kioskUrlChanged}
                            fullWidth
                          />
                          <CopyIconButton value={localKioskUrl ?? ""} disabled={!localKioskUrl} iconSize={isMobile ? 13 : 15} isMobile={isMobile} />
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={handleKioskUrlSaveLocal}
                            disabled={!kioskUrlChanged || isOffline}
                            sx={{ minWidth: isMobile ? 48 : 56 }}
                          >
                            Gem
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>

                    {/* Kiosk browser status */}
                    <TableRow>
                      <TableCell
                        sx={{
                          ...labelStyle,
                          whiteSpace: isMobile ? "nowrap" : "normal",
                          overflow: isMobile ? "hidden" : "visible",
                          textOverflow: isMobile ? "ellipsis" : "clip",
                          borderBottom: "none",
                          width: labelCellWidth,
                          minWidth: labelCellWidth,
                        }}
                      >
                        Kiosk browser status:
                      </TableCell>
                      <TableCell sx={{ ...valueStyle, borderBottom: "none" }}>
                        <ChromeStatusBadge status={liveChromeStatus} color={liveChromeColor} isMobile={isMobile} />
                      </TableCell>
                    </TableRow>

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
