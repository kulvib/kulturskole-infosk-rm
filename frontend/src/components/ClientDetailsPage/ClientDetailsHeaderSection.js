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

/*
  ClientDetailsHeaderSection - ændringer:
  - Flytter kun VALUE-kolonnerne tættere på LABEL-kolonnen (ingen ændring af label-kolonnen).
  - Value-celler er venstre-justerede (textAlign: 'left') og vi fjerner den horisontale TableCell-padding (px: 0)
    så de reducerede pl-værdier træder tydeligt i kraft.
  - Ingen ændring i kolonne-placering eller minWidth for label-kolonnen.
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

  // hex or rgb(a)
  if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(trimmed) || /^rgba?\(/i.test(trimmed)) {
    return trimmed;
  }

  const lower = trimmed.toLowerCase();

  // theme token like "grey.400" or "success.main"
  if (lower.includes(".")) {
    const [paletteKey, shade] = lower.split(".");
    const pal = theme.palette?.[paletteKey];
    if (pal) {
      if (shade && pal[shade]) return pal[shade];
      if (pal.main) return pal.main;
      if (typeof pal === "string") return pal;
    }
  }

  // theme direct key e.g. "success"
  if (theme.palette?.[lower]) {
    const pal = theme.palette[lower];
    if (typeof pal === "string") return pal;
    if (pal.main) return pal.main;
  }

  // map common names to hex
  if (COLOR_NAME_MAP[lower]) return COLOR_NAME_MAP[lower];

  // fallback to the raw trimmed string (may be valid CSS color)
  return trimmed;
}

// StatusBadge - dot + label. animation only transforms and opacity (no background)
// inline style is used to force background-color so global keyframes/styles can't override it.
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
          // use our unique animation name via sx (keeps theme-based style generation)
          animation: animate ? "pulsateStatusBadge 2s infinite" : "none",
          // keyframes animate only transform+opacity
          "@keyframes pulsateStatusBadge": {
            "0%": { transform: "scale(1)", opacity: 1 },
            "50%": { transform: "scale(1.25)", opacity: 0.5 },
            "100%": { transform: "scale(1)", opacity: 1 }
          }
        }}
        // Inline style fallback to ensure the background color wins over any global keyframe that would overwrite it.
        style={{
          backgroundColor: resolvedBg,
          // enforce our animation properties inline as well so the element uses our unique keyframes
          animationName: animate ? "pulsateStatusBadge" : "none",
          animationDuration: animate ? "2s" : undefined,
          animationIterationCount: animate ? "infinite" : undefined,
          animationTimingFunction: animate ? "ease" : undefined
        }}
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

function ClientDetailsHeaderSection({
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

  // Schools state (prefer prop)
  const [schoolsList, setSchoolsList] = React.useState(Array.isArray(schools) ? schools : []);
  const [loadingSchools, setLoadingSchools] = React.useState(false);
  const [schoolsError, setSchoolsError] = React.useState(null);

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
      setSchoolsError(null);
      try {
        const data = await apiGetSchools();
        if (cancelled) return;
        if (Array.isArray(data)) setSchoolsList(data);
        else if (Array.isArray(data?.schools)) setSchoolsList(data.schools);
      } catch (err) {
        if (cancelled) return;
        setSchoolsError(err?.message || "Fejl ved hentning af skoler");
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
        showSnackbar({ message: "Kunne ikke opdatere skole: " + (err?.message || err), severity: "error" });
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
  // Reduced padding to bring value-column closer to label-column and ensure left alignment.
  const valueStyle = {
    fontWeight: 400,
    pl: isMobile ? 0.5 : 0.75, // reduced from 1.5 -> 0.75 on desktop
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
        <TableCell sx={{ ...valueStyle, borderBottom: "none", textAlign: "left", px: 0 }}>{String(value)}</TableCell>
      </TableRow>
    ));
  }

  const getSelectedSchoolName = React.useCallback(() => {
    if (!selectedSchool) return "";
    const s = (schoolsList || []).find(x => String(x.id) === String(selectedSchool));
    return s ? s.name : String(selectedSchool);
  }, [selectedSchool, schoolsList]);

  // Render
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
        {/* Klient info */}
        <Box sx={{ width: isMobile ? "100%" : "50%", pr: isMobile ? 0 : 1, mb: isMobile ? 1 : 0 }}>
          <Card elevation={2} sx={{ borderRadius: isMobile ? 1 : 2, height: "100%" }}>
            <CardContent sx={{ px: isMobile ? 1 : 2, py: isMobile ? 1 : 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", mb: isMobile ? 0.5 : 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: isMobile ? 16 : 18 }}>Klient info</Typography>
                <Box sx={{ ml: 1 }}>
                  <OnlineStatusBadge isOnline={client?.isOnline} isMobile={isMobile} />
                </Box>
              </Box>

              <TableContainer>
                <Table size="small" aria-label="klient-info">
                  <TableBody>
                    <TableRow sx={{ height: isMobile ? 28 : 34 }}>
                      <TableCell sx={{ ...labelStyle, borderBottom: "none" }}>Klientnavn:</TableCell>
                      <TableCell sx={{ ...valueStyle, borderBottom: "none", textAlign: "left", px: 0 }}>{client?.name ?? <span style={{ color: "#888" }}>Ukendt navn</span>}</TableCell>
                    </TableRow>

                    {user?.role === "admin" && (
                      <TableRow sx={{ height: isMobile ? 28 : 34 }}>
                        <TableCell sx={{ ...labelStyle, borderBottom: "none" }}>Klient ID:</TableCell>
                        <TableCell sx={{ ...valueStyle, borderBottom: "none", textAlign: "left", px: 0 }}>{client?.id ?? "?"}</TableCell>
                      </TableRow>
                    )}

                    <TableRow sx={{ height: isMobile ? 36 : 44 }}>
                      <TableCell sx={{ ...labelStyle, borderBottom: "none" }}>Skole:</TableCell>
                      <TableCell sx={{ ...valueStyle, borderBottom: "none", textAlign: "left", px: 0 }}>
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

                          <Button variant="outlined" size="small" onClick={handleSchoolSave} disabled={savingSchool || String(selectedSchool) === String(client?.school_id)} sx={{ minWidth: 56 }}>
                            {savingSchool ? <CircularProgress size={isMobile ? 13 : 16} /> : "Gem"}
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>

                    <TableRow sx={{ height: isMobile ? 36 : 44 }}>
                      <TableCell sx={{ ...labelStyle, borderBottom: "none" }}>Lokation:</TableCell>
                      <TableCell sx={{ ...valueStyle, borderBottom: "none", textAlign: "left", px: 0 }}>
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
                          <Button variant="outlined" size="small" onClick={handleLocalitySave} disabled={savingLocality} sx={{ minWidth: 56 }}>
                            {savingLocality ? <CircularProgress size={isMobile ? 13 : 16} /> : "Gem"}
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

        {/* Kiosk info */}
        <Box sx={{ width: isMobile ? "100%" : "50%", pl: isMobile ? 0 : 1 }}>
          <Card elevation={2} sx={{ borderRadius: isMobile ? 1 : 2, height: "100%" }}>
            <CardContent sx={{ px: isMobile ? 1 : 2, py: isMobile ? 1 : 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", mb: isMobile ? 0.5 : 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: isMobile ? 16 : 18 }}>Kiosk info</Typography>
                <Box sx={{ ml: 1 }}><StateBadge state={client?.state} isMobile={isMobile} /></Box>
              </Box>

              <TableContainer>
                <Table size="small" aria-label="kiosk-info">
                  <TableBody>
                    <TableRow sx={{ height: isMobile ? 36 : 44 }}>
                      <TableCell sx={{ ...labelStyle, borderBottom: "none" }}>Kiosk URL:</TableCell>
                      <TableCell sx={{ ...valueStyle, borderBottom: "none", textAlign: "left", px: 0 }}>
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
                          <Button variant="outlined" size="small" onClick={handleKioskUrlSave} disabled={savingKioskUrl} sx={{ minWidth: 56 }}>
                            {savingKioskUrl ? <CircularProgress size={isMobile ? 13 : 16} /> : "Gem"}
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>

                    <TableRow sx={{ height: isMobile ? 28 : 34 }}>
                      <TableCell sx={{ ...labelStyle, borderBottom: "none" }}>Kiosk browser status:</TableCell>
                      <TableCell sx={{ ...valueStyle, borderBottom: "none", textAlign: "left", px: 0 }}>
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

// Custom shallow comparator for React.memo:
// Only re-render header when props that affect its UI actually change.
// We check a set of primitives and a few client fields that header displays.
function propsAreEqual(prev, next) {
  // Compare simple primitive props
  const simpleKeys = [
    "locality",
    "localityDirty",
    "savingLocality",
    "kioskUrl",
    "kioskUrlDirty",
    "savingKioskUrl",
    "liveChromeStatus",
    "liveChromeColor",
    "refreshing",
    // optional token if parent provides it (useful if you want explicit change detection)
    "liveChromeTimestamp"
  ];
  for (const k of simpleKeys) {
    if (prev[k] !== next[k]) return false;
  }

  // Compare client fields we care about shallowly
  const prevClient = prev.client || {};
  const nextClient = next.client || {};
  const clientKeys = ["id", "name", "isOnline", "school_id", "state", "chrome_status", "chrome_color"];
  for (const k of clientKeys) {
    if (prevClient[k] !== nextClient[k]) return false;
  }

  // Compare schools length and basic identity to detect meaningful changes
  const prevSchools = prev.schools || [];
  const nextSchools = next.schools || [];
  if (prevSchools.length !== nextSchools.length) return false;
  for (let i = 0; i < prevSchools.length; i++) {
    if ((prevSchools[i]?.id ?? null) !== (nextSchools[i]?.id ?? null)) return false;
  }

  // Compare kioskBrowserData shallowly by keys/values
  const prevKbd = prev.kioskBrowserData || {};
  const nextKbd = next.kioskBrowserData || {};
  const prevKbdKeys = Object.keys(prevKbd);
  const nextKbdKeys = Object.keys(nextKbd);
  if (prevKbdKeys.length !== nextKbdKeys.length) return false;
  for (const key of prevKbdKeys) {
    if (prevKbd[key] !== nextKbd[key]) return false;
  }

  // If we've reached here, treat props as equal (no re-render needed)
  return true;
}

export default React.memo(ClientDetailsHeaderSection, propsAreEqual);
